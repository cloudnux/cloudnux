import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import logSymbols from "log-symbols";

import { logger } from "@cloudnux/utils";

import { SchedulerState, SchedulerService, JobExecution, ScheduledJob, SchedulerConfig } from "./types";
import { hasJobDefinitionChanged, calculateNextRunFromLastRun } from "./utils";
import { parseCronExpression } from "./cron-utils";

interface SchedulerStateData {
    jobs: ScheduledJob[];
    executions: JobExecution[];
    savedAt: Date;
    version: string;
}

export const createStateFilePath = (
    directory: string
): string => path.join(directory, 'scheduler-state.json');

export const createTempFilePath = (
    directory: string
): string => path.join(directory, `scheduler-state.${Date.now()}.temp.json`);

export const serializeSchedulerState = (
    schedulers: Record<string, SchedulerService>,
    executionHistory: JobExecution[]
): SchedulerStateData => ({
    jobs: Object.values(schedulers).map(s => s.job),
    executions: executionHistory.slice(-100),
    savedAt: new Date(),
    version: '1.0'
});

export const saveSchedulerState = async (
    state: SchedulerState
): Promise<void> => {

    try {
        const serializedState = serializeSchedulerState(state.schedulers, state.executionHistory);
        const stateFile = createStateFilePath(state.config.persistence.directory);
        const tempFile = createTempFilePath(state.config.persistence.directory);

        await fs.writeFile(tempFile, JSON.stringify(serializedState, null, 2), 'utf8');
        await fs.rename(tempFile, stateFile);

        logger.info(`${logSymbols.info} ${chalk.blue('Enhanced scheduler state saved')}`);
    } catch (error: any) {
        logger.error('Failed to save scheduler state:', error);
    }
};

export const loadSchedulerStateData = async (
    directory: string
): Promise<SchedulerStateData | null> => {
    try {
        const stateFile = createStateFilePath(directory);
        const data = await fs.readFile(stateFile, 'utf8');
        return JSON.parse(data);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            logger.info(`${chalk.blue('No previous scheduler state found - starting fresh')}`);
        } else {
            logger.error('Failed to load scheduler state:', error);
        }
        return null;
    }
};

export const validateAndAdjustNextRun = (
    job: ScheduledJob,
    savedNextRun: Date | undefined,
    lastRestartTime: Date,
    config: SchedulerConfig
): Date => {
    const now = new Date();

    if (!savedNextRun) {
        return calculateNextRunFromLastRun(job, job.lastRun, config);
    }

    if (savedNextRun <= now) {
        logger.info(`${chalk.yellow('⏰ Saved next run is in the past for')} ${chalk.green(job.name)} - recalculating`);
        return calculateNextRunFromLastRun(job, job.lastRun, config);
    }

    const timeSinceRestart = now.getTime() - lastRestartTime.getTime();
    const isRapidRestart = timeSinceRestart < config.restartBehavior.rapidRestartThreshold;

    if (isRapidRestart) {
        logger.info(`${chalk.blue('⚡ Rapid restart detected for')} ${chalk.green(job.name)} - preserving saved timing`);
        return savedNextRun;
    }

    if (job.cronExpression || job.intervalMs) {
        const expectedNextRun = calculateNextRunFromLastRun(job, job.lastRun, config);
        const timeDiff = Math.abs(savedNextRun.getTime() - expectedNextRun.getTime());

        if (timeDiff > config.restartBehavior.maxTimingDrift) {
            logger.info(`${chalk.yellow('🔧 Adjusting timing for')} ${chalk.green(job.name)} - drift of ${Math.round(timeDiff / 1000)}s detected`);
            return expectedNextRun;
        }
    }

    return savedNextRun;
};

export const restoreJobFromSavedData = (
    scheduler: SchedulerService,
    savedJob: ScheduledJob,
    config: SchedulerConfig,
    lastRestartTime: Date
): SchedulerService => {
    const definitionChanged = hasJobDefinitionChanged(scheduler.job, savedJob);

    const updatedJob = {
        ...scheduler.job,
        runCount: savedJob.runCount,
        lastRun: savedJob.lastRun ? new Date(savedJob.lastRun) : undefined,
    };

    if (definitionChanged) {
        logger.info(`${chalk.yellow('🔄 Job definition changed:')} ${chalk.green(savedJob.name)} - recalculating schedule`);
        updatedJob.nextRun = calculateNextRunFromLastRun(updatedJob, updatedJob.lastRun, config);
    } else {
        const savedNextRun = savedJob.nextRun ? new Date(savedJob.nextRun) : undefined;
        updatedJob.nextRun = validateAndAdjustNextRun(updatedJob, savedNextRun, lastRestartTime, config);
    }

    if (config.cron.logCronDetails && updatedJob.cronExpression) {
        const result = parseCronExpression(updatedJob.cronExpression, updatedJob.lastRun, {
            timezone: updatedJob.timezone
        });
        logger.info(`${chalk.blue('📅 Job restored:')} ${chalk.green(savedJob.name)} - ${result.description} - next: ${chalk.cyan(updatedJob.nextRun.toLocaleString())}`);
    }

    return { ...scheduler, job: updatedJob };
};

export const restoreExecutionHistory = (
    savedExecutions: any[]
): JobExecution[] => {
    return savedExecutions.map((exec: any) => ({
        ...exec,
        startTime: new Date(exec.startTime),
        endTime: exec.endTime ? new Date(exec.endTime) : undefined,
    }));
};

export const loadSchedulerState = async (
    schedulers: Record<string, SchedulerService>,
    config: SchedulerConfig,
    lastRestartTime: Date
): Promise<{
    schedulers: Record<string, SchedulerService>;
    executionHistory: JobExecution[];
}> => {
    const stateData = await loadSchedulerStateData(config.persistence.directory);

    if (!stateData) {
        return { schedulers, executionHistory: [] };
    }

    const restoredSchedulers = { ...schedulers };

    for (const savedJob of stateData.jobs) {
        const existingScheduler = Object.values(schedulers).find(s => s.job.name === savedJob.name);

        if (existingScheduler) {
            const restoredScheduler = restoreJobFromSavedData(
                existingScheduler,
                savedJob,
                config,
                lastRestartTime
            );
            restoredSchedulers[restoredScheduler.job.id] = restoredScheduler;
        }
    }

    const executionHistory = stateData.executions ? restoreExecutionHistory(stateData.executions) : [];

    logger.debug(`${logSymbols.success} ${chalk.green('Enhanced scheduler state loaded')} (saved at ${stateData.savedAt})`);

    return { schedulers: restoredSchedulers, executionHistory };
};