import { FastifyInstance, FastifyPluginCallback } from "fastify";
import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import logSymbols from "log-symbols";

import { logger } from "@cloudnux/utils";

import { JobExecution, ScheduledJob, SchedulerConfig, SchedulerPluginOptions, SchedulerService } from "./types";
import { detectExpressionType, convertRateToCron, parseCronExpression, getNextExecutions } from "./cron-utils";



const DEFAULT_CONFIG: SchedulerConfig = {
    persistence: {
        enabled: true,
        directory: './.develop/scheduler-data',
        saveInterval: 30000, // 30 seconds
    },
    execution: {
        maxConcurrent: 5,
        defaultTimeout: 300000, // 5 minutes
        retryOnError: false,
        maxRetries: 3,
    },
    cleanup: {
        maxExecutionHistory: 1000,
        cleanupInterval: 600000, // 10 minutes
    },
    restartBehavior: {
        preserveNaturalTiming: true,
        skipMissedRuns: true,
        maxTimingDrift: 60000, // 1 minute
        rapidRestartThreshold: 10000, // 10 seconds
    },
    cron: {
        defaultTimezone: undefined, // Use system timezone
        logCronDetails: true,
    }
};


function calculateNextRun(job: ScheduledJob, preserveNaturalTiming: boolean = true): Date {
    const now = new Date();

    if (job.cronExpression) {
        const result = parseCronExpression(job.cronExpression, job.lastRun, {
            preserveNaturalTiming,
            timezone: job.timezone,
            currentDate: preserveNaturalTiming && job.lastRun ? job.lastRun : now
        });

        if (!result.isValid) {
            //BREAKPOINT: LOGGING
            logger.warn(`${chalk.yellow('⚠️  Invalid cron expression for')} ${chalk.green(job.name)}: ${job.cronExpression}`);
            logger.warn(`${chalk.yellow('Using fallback timing:')} ${result.nextRun}`);
        }

        return result.nextRun;
    }

    if (job.intervalMs) {
        return new Date(now.getTime() + job.intervalMs);
    }

    if (job.delayMs) {
        return new Date(now.getTime() + job.delayMs);
    }

    // Default: 1 hour
    return new Date(now.getTime() + 3600000);
}

function calculateNextRunFromLastRun(job: ScheduledJob, lastRun: Date | undefined, config: SchedulerConfig): Date {
    const now = new Date();

    if (job.cronExpression) {
        const result = parseCronExpression(job.cronExpression, lastRun, {
            preserveNaturalTiming: config.restartBehavior.preserveNaturalTiming,
            timezone: job.timezone ?? config.cron.defaultTimezone
        });
        return result.nextRun;
    }

    if (job.intervalMs && lastRun) {
        let nextRun = new Date(lastRun.getTime() + job.intervalMs);

        if (config.restartBehavior.skipMissedRuns) {
            while (nextRun <= now) {
                nextRun = new Date(nextRun.getTime() + job.intervalMs);
            }
        } else {
            if (nextRun <= now) {
                nextRun = new Date(now.getTime() + job.intervalMs);
            }
        }

        return nextRun;
    }

    return calculateNextRun(job, config.restartBehavior.preserveNaturalTiming);
}

function generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}


export const schedulerPlugin: FastifyPluginCallback<SchedulerPluginOptions> = async (
    app: FastifyInstance,
    options: SchedulerPluginOptions
) => {

    const createSchedulerFunctionContext = options.functionContextFactory;

    const schedulers: Record<string, SchedulerService> = {};
    const executions: Record<string, JobExecution> = {};
    const executionHistory: JobExecution[] = [];

    const config: SchedulerConfig = { ...DEFAULT_CONFIG, ...options.config };

    let isShuttingDown = false;
    let runningExecutions = 0;
    let cleanupInterval: NodeJS.Timeout;
    const lastRestartTime = new Date();

    if (options.jobs) {
        for (const jobDef of options.jobs) {
            const expressionType = detectExpressionType(jobDef.cronExpression);
            if (expressionType === "unknown") {
                //BREAKPOINT: LOGGING
                logger.error(`${logSymbols.error} ${chalk.red('Invalid cron expression for job:')} ${jobDef.name}`);
                throw new Error(`Invalid cron expression for job: ${jobDef.name}`);
            }

            if (config.cron.logCronDetails) {
                const result = parseCronExpression(jobDef.cronExpression!, undefined, {
                    timezone: jobDef.timezone ?? config.cron.defaultTimezone
                });
                //BREAKPOINT: LOGGING
                logger.info(`${chalk.blue('📅 Job')} ${chalk.green(jobDef.name)}: ${result.description} - Next: ${chalk.cyan(result.nextRun.toLocaleString())}`);

                // Show next few executions for debugging
                const upcoming = getNextExecutions(jobDef.cronExpression!, 3, {
                    timezone: jobDef.timezone ?? config.cron.defaultTimezone
                });
                //BREAKPOINT: LOGGING
                logger.info(`${chalk.blue('   Upcoming:')} ${upcoming.map(d => d.toLocaleTimeString()).join(', ')}`);
            }

            const job: ScheduledJob = {
                id: generateJobId(),
                name: jobDef.name,
                cronExpression: expressionType === "rate" ? convertRateToCron(jobDef.cronExpression!).cronExpression : jobDef.cronExpression,
                intervalMs: jobDef.intervalMs,
                delayMs: jobDef.delayMs,
                nextRun: new Date(), // Will be calculated properly
                enabled: jobDef.enabled ?? true,
                runCount: 0,
                maxRuns: jobDef.maxRuns,
                metadata: jobDef.metadata,
                createdAt: new Date(),
            };

            // Calculate initial next run
            job.nextRun = calculateNextRun(job);

            schedulers[job.id] = {
                job,
                handler: jobDef.handler,
                isRunning: false,
            };
        }
    }

    // Initialize persistence and start jobs
    await initializeScheduler();


    async function initializeScheduler(): Promise<void> {
        try {
            if (config.persistence.enabled) {
                await fs.mkdir(config.persistence.directory, { recursive: true });
                await loadSchedulerState();

                // Save state periodically
                if (config.persistence.saveInterval > 0) {
                    setInterval(saveSchedulerState, config.persistence.saveInterval);
                }
            }

            // Start cleanup interval
            cleanupInterval = setInterval(cleanupExecutionHistory, config.cleanup.cleanupInterval);

            // Schedule all enabled jobs
            for (const scheduler of Object.values(schedulers)) {
                if (scheduler.job.enabled) {
                    scheduleJob(scheduler);
                }
            }

            // Setup graceful shutdown
            setupGracefulShutdown();

            //BREAKPOINT: LOGGING
            logger.debug(`${logSymbols.success} ${chalk.green('Scheduler initialized:')} ${Object.keys(schedulers).length} jobs loaded`);
        } catch (error: any) {
            //BREAKPOINT: LOGGING
            logger.error(`${logSymbols.error} ${chalk.red('Failed to initialize scheduler:')} ${error.message}`);
        }
    }

    function scheduleJob(scheduler: SchedulerService): void {
        if (isShuttingDown) return;

        const timeUntilNextRun = scheduler.job.nextRun.getTime() - Date.now();

        if (timeUntilNextRun <= 0) {
            // Should run now
            setImmediate(() => executeJob(scheduler));
        } else {
            // Schedule for future
            scheduler.timerId = setTimeout(() => {
                executeJob(scheduler);
            }, timeUntilNextRun);

            //BREAKPOINT: LOGGING
            logger.info(`${chalk.blue('📅 Scheduled job')} ${chalk.green(scheduler.job.name)} to run in ${chalk.cyan(Math.round(timeUntilNextRun / 1000))}s`);
        }
    }

    async function executeJob(scheduler: SchedulerService): Promise<void> {
        if (isShuttingDown || scheduler.isRunning) return;

        if (scheduler.job.maxRuns && scheduler.job.runCount >= scheduler.job.maxRuns) {
            //BREAKPOINT: LOGGING
            logger.info(`${chalk.yellow('⏹️  Job')} ${chalk.green(scheduler.job.name)} reached max runs (${scheduler.job.maxRuns})`);
            return;
        }

        if (runningExecutions >= config.execution.maxConcurrent) {
            //BREAKPOINT: LOGGING
            logger.warn(`${chalk.yellow('⚠️  Delaying job')} ${chalk.green(scheduler.job.name)} - max concurrent limit reached`);
            scheduler.job.nextRun = new Date(Date.now() + 30000);
            scheduleJob(scheduler);
            return;
        }

        const execution: JobExecution = {
            id: generateExecutionId(),
            jobId: scheduler.job.id,
            startTime: new Date(),
            status: 'running',
        };

        executions[execution.id] = execution;
        executionHistory.push(execution);
        scheduler.isRunning = true;
        runningExecutions++;

        //BREAKPOINT: LOGGING
        logger.info(`${chalk.blue('🚀 Executing job')} ${chalk.green(scheduler.job.name)} (${execution.id})`);

        try {
            const ctx = createSchedulerFunctionContext(scheduler.job, execution);
            const result = await Promise.race([
                scheduler.handler(ctx),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Job execution timeout')), config.execution.defaultTimeout)
                )
            ]);

            execution.endTime = new Date();
            execution.status = 'completed';
            execution.result = result;

            scheduler.job.lastRun = execution.startTime;
            scheduler.job.runCount++;

            //BREAKPOINT: LOGGING
            logger.debug(`${logSymbols.success} ${chalk.green('Job completed')} ${chalk.green(scheduler.job.name)} in ${execution.endTime.getTime() - execution.startTime.getTime()}ms`);

        } catch (error: any) {
            execution.endTime = new Date();
            execution.status = 'failed';
            execution.error = error.message;

            //BREAKPOINT: LOGGING
            logger.error(`${logSymbols.error} ${chalk.red('Job failed')} ${chalk.green(scheduler.job.name)}: ${error.message}`);
        } finally {
            scheduler.isRunning = false;
            runningExecutions--;

            if (scheduler.job.enabled && !isShuttingDown) {
                scheduler.job.nextRun = calculateNextRunFromLastRun(scheduler.job, scheduler.job.lastRun, config);
                scheduleJob(scheduler);
            }

            if (config.persistence.enabled) {
                await saveSchedulerState();
            }
        }
    }

    function setupGracefulShutdown(): void {
        const shutdownHandler = async () => {
            //BREAKPOINT: LOGGING
            logger.info(`${chalk.yellow('🛑 Enhanced scheduler shutting down...')}`);
            isShuttingDown = true;

            for (const scheduler of Object.values(schedulers)) {
                if (scheduler.timerId) {
                    clearTimeout(scheduler.timerId);
                    scheduler.timerId = undefined;
                }
            }

            if (cleanupInterval) {
                clearInterval(cleanupInterval);
            }

            const maxWaitTime = 30000;
            const startTime = Date.now();

            while (runningExecutions > 0 && (Date.now() - startTime) < maxWaitTime) {
                //BREAKPOINT: LOGGING
                logger.info(`${chalk.yellow('⏳ Waiting for')} ${runningExecutions} running jobs to complete...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            if (config.persistence.enabled) {
                await saveSchedulerState();
            }

            //BREAKPOINT: LOGGING
            logger.debug(`${logSymbols.success} ${chalk.green('Enhanced scheduler shutdown complete')}`);
        };

        //TODO: check this if process is the parent process (tsup watch) or the child process (fastify server)
        process.on('SIGINT', shutdownHandler);
        process.on('SIGTERM', shutdownHandler);
        app.addHook('onClose', async () => {
            await shutdownHandler();
        });
    }


    async function saveSchedulerState(): Promise<void> {
        try {
            const state = {
                jobs: Object.values(schedulers).map(s => s.job),
                executions: executionHistory.slice(-100),
                savedAt: new Date(),
                version: '1.0' // Version for migration purposes
            };

            const stateFile = path.join(config.persistence.directory, 'scheduler-state.json');
            const tempFile = path.join(config.persistence.directory, `scheduler-state.${Date.now()}.temp.json`);

            await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8');
            await fs.rename(tempFile, stateFile);

            //BREAKPOINT: LOGGING
            logger.info(`${logSymbols.info} ${chalk.blue('Enhanced scheduler state saved')}`);
        } catch (error: any) {
            //BREAKPOINT: LOGGING
            logger.error('Failed to save scheduler state:', error);
        }
    }

    async function loadSchedulerState(): Promise<void> {
        try {
            const stateFile = path.join(config.persistence.directory, 'scheduler-state.json');
            const data = await fs.readFile(stateFile, 'utf8');
            const state = JSON.parse(data);

            for (const savedJob of state.jobs) {
                const existingScheduler = Object.values(schedulers).find(s => s.job.name === savedJob.name);

                if (existingScheduler) {
                    const definitionChanged = hasJobDefinitionChanged(existingScheduler.job, savedJob);

                    existingScheduler.job.runCount = savedJob.runCount;
                    existingScheduler.job.lastRun = savedJob.lastRun ? new Date(savedJob.lastRun) : undefined;

                    if (definitionChanged) {
                        //BREAKPOINT: LOGGING
                        logger.info(`${chalk.yellow('🔄 Job definition changed:')} ${chalk.green(savedJob.name)} - recalculating schedule`);
                        existingScheduler.job.nextRun = calculateNextRunFromLastRun(existingScheduler.job, existingScheduler.job.lastRun, config);
                    } else {
                        const savedNextRun = savedJob.nextRun ? new Date(savedJob.nextRun) : undefined;
                        existingScheduler.job.nextRun = validateAndAdjustNextRun(existingScheduler.job, savedNextRun);
                    }

                    if (config.cron.logCronDetails && existingScheduler.job.cronExpression) {
                        const result = parseCronExpression(existingScheduler.job.cronExpression, existingScheduler.job.lastRun, {
                            timezone: existingScheduler.job.timezone
                        });
                        //BREAKPOINT: LOGGING
                        logger.info(`${chalk.blue('📅 Job restored:')} ${chalk.green(savedJob.name)} - ${result.description} - next: ${chalk.cyan(existingScheduler.job.nextRun.toLocaleString())}`);
                    }
                }
            }

            if (state.executions) {
                executionHistory.push(...state.executions.map((exec: any) => ({
                    ...exec,
                    startTime: new Date(exec.startTime),
                    endTime: exec.endTime ? new Date(exec.endTime) : undefined,
                })));
            }

            //BREAKPOINT: LOGGING
            logger.debug(`${logSymbols.success} ${chalk.green('Enhanced scheduler state loaded')} (saved at ${state.savedAt})`);
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                //BREAKPOINT: LOGGING
                logger.info(`${chalk.blue('No previous scheduler state found - starting fresh')}`);
            } else {
                //BREAKPOINT: LOGGING
                logger.error('Failed to load scheduler state:', error);
            }
        }
    }

    function hasJobDefinitionChanged(currentJob: ScheduledJob, savedJob: any): boolean {
        return (
            currentJob.cronExpression !== savedJob.cronExpression ||
            currentJob.intervalMs !== savedJob.intervalMs ||
            currentJob.delayMs !== savedJob.delayMs ||
            currentJob.maxRuns !== savedJob.maxRuns ||
            currentJob.timezone !== savedJob.timezone
        );
    }

    function validateAndAdjustNextRun(job: ScheduledJob, savedNextRun?: Date): Date {
        const now = new Date();

        if (!savedNextRun) {
            return calculateNextRun(job, config.restartBehavior.preserveNaturalTiming);
        }

        if (savedNextRun <= now) {
            //BREAKPOINT: LOGGING
            logger.info(`${chalk.yellow('⏰ Saved next run is in the past for')} ${chalk.green(job.name)} - recalculating`);
            return calculateNextRunFromLastRun(job, job.lastRun, config);
        }

        const timeSinceRestart = now.getTime() - lastRestartTime.getTime();
        const isRapidRestart = timeSinceRestart < config.restartBehavior.rapidRestartThreshold;

        if (isRapidRestart) {
            //BREAKPOINT: LOGGING
            logger.info(`${chalk.blue('⚡ Rapid restart detected for')} ${chalk.green(job.name)} - preserving saved timing`);
            return savedNextRun;
        }

        if (job.cronExpression || job.intervalMs) {
            const expectedNextRun = calculateNextRunFromLastRun(job, job.lastRun, config);
            const timeDiff = Math.abs(savedNextRun.getTime() - expectedNextRun.getTime());

            if (timeDiff > config.restartBehavior.maxTimingDrift) {
                //BREAKPOINT: LOGGING
                logger.info(`${chalk.yellow('🔧 Adjusting timing for')} ${chalk.green(job.name)} - drift of ${Math.round(timeDiff / 1000)}s detected`);
                return expectedNextRun;
            }
        }

        return savedNextRun;
    }

    function cleanupExecutionHistory(): void {
        if (executionHistory.length > config.cleanup.maxExecutionHistory) {
            const removed = executionHistory.splice(0, executionHistory.length - config.cleanup.maxExecutionHistory);
            //BREAKPOINT: LOGGING
            logger.info(`${chalk.blue('🧹 Cleaned up')} ${removed.length} old execution records`);
        }
    }

    app.get("/dashboard", async function (_, reply) {
        const jobs = Object.values(schedulers).map(s => {
            const nextExecutions = s.job.cronExpression ?
                getNextExecutions(s.job.cronExpression, 3, { timezone: s.job.timezone }) : [];

            return {
                ...s.job,
                isRunning: s.isRunning,
                timeUntilNextRun: s.job.nextRun.getTime() - Date.now(),
                upcomingExecutions: nextExecutions,
                cronDescription: s.job.cronExpression ?
                    parseCronExpression(s.job.cronExpression, undefined, { timezone: s.job.timezone }).description :
                    undefined
            };
        });

        return reply.status(200).send({ jobs, runningExecutions });
    });

    app.get("/executions", async function (_, reply) {
        return reply.status(200).send({
            executions: executionHistory.slice(-50), // Last 50 executions
            running: Object.values(executions).filter(e => e.status === 'running'),
        });
    });

    app.post<{ Params: { jobId: string } }>("/jobs/:jobId/trigger", async function (request, reply) {
        const scheduler = schedulers[request.params.jobId];

        if (!scheduler) {
            return reply.status(404).send({ error: "Job not found" });
        }

        if (scheduler.isRunning) {
            return reply.status(409).send({ error: "Job is already running" });
        }

        // Trigger immediately
        setImmediate(() => executeJob(scheduler));

        return reply.status(200).send({ message: "Job triggered successfully" });
    });


    app.put<{ Params: { jobId: string } }>("/jobs/:jobId/enable", async function (request, reply) {
        const scheduler = schedulers[request.params.jobId];

        if (!scheduler) {
            return reply.status(404).send({ error: "Job not found" });
        }

        scheduler.job.enabled = true;
        scheduler.job.nextRun = calculateNextRun(scheduler.job);
        scheduleJob(scheduler);

        return reply.status(200).send({ message: "Job enabled successfully" });
    });

    app.put<{ Params: { jobId: string } }>("/jobs/:jobId/disable", async function (request, reply) {
        const scheduler = schedulers[request.params.jobId];

        if (!scheduler) {
            return reply.status(404).send({ error: "Job not found" });
        }

        scheduler.job.enabled = false;
        if (scheduler.timerId) {
            clearTimeout(scheduler.timerId);
            scheduler.timerId = undefined;
        }

        return reply.status(200).send({ message: "Job disabled successfully" });
    });
}