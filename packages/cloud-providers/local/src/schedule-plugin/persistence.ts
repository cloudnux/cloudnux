import * as fs from "fs/promises";
import * as path from "path";

import { JobExecution, ScheduledJob, SchedulerRuntime, SchedulerService } from "./types";
import { hasJobDefinitionChanged, calculateNextRunFromLastRun } from "./utils";
import { parseCronExpression } from "./cron-utils";

interface SchedulerStateData {
    jobs: ScheduledJob[];
    executions: JobExecution[];
    savedAt: Date;
    version: string;
}

const stateFilePath = (directory: string): string => path.join(directory, 'scheduler-state.json');

const tempFilePath = (directory: string): string => path.join(directory, `scheduler-state.${Date.now()}.temp.json`);

const restoreExecutionHistory = (savedExecutions: JobExecution[]): JobExecution[] =>
    savedExecutions.map((exec) => ({
        ...exec,
        startTime: new Date(exec.startTime),
        endTime: exec.endTime ? new Date(exec.endTime) : undefined,
    }));

const readStateData = async (directory: string): Promise<SchedulerStateData | null> => {
    const data = await fs.readFile(stateFilePath(directory), 'utf8');
    return JSON.parse(data);
};

export const saveSchedulerState = async (runtime: SchedulerRuntime): Promise<void> => {
    try {
        const stateData: SchedulerStateData = {
            jobs: Object.values(runtime.schedulers).map(s => s.job),
            executions: runtime.executionHistory.slice(-100),
            savedAt: new Date(),
            version: '1.0',
        };

        const file = stateFilePath(runtime.config.persistence.directory);
        const temp = tempFilePath(runtime.config.persistence.directory);

        // Write to a temp file first, then rename - rename is atomic, so a
        // reader never sees a half-written file.
        await fs.writeFile(temp, JSON.stringify(stateData, null, 2), 'utf8');
        await fs.rename(temp, file);

        runtime.logging.debug('Scheduler state saved');
    } catch (error: any) {
        runtime.logging.error({ error: error?.message }, 'Failed to save scheduler state');
    }
};

// Recalculates - or preserves - a restored job's nextRun depending on how
// long ago the process restarted, so a quick redeploy doesn't lose timing
// but a long outage doesn't fire a pile of catch-up runs.
const validateAndAdjustNextRun = (
    job: ScheduledJob,
    savedNextRun: Date | undefined,
    runtime: SchedulerRuntime
): Date => {
    const { config, lastRestartTime, logging } = runtime;
    const now = new Date();

    if (!savedNextRun || savedNextRun <= now) {
        logging.debug({ module: job.module }, `Saved next run is in the past for ${job.name} - recalculating`);
        return calculateNextRunFromLastRun(job, job.lastRun, config);
    }

    const isRapidRestart = now.getTime() - lastRestartTime.getTime() < config.restartBehavior.rapidRestartThreshold;
    if (isRapidRestart) {
        logging.debug({ module: job.module }, `Rapid restart detected for ${job.name} - preserving saved timing`);
        return savedNextRun;
    }

    if (job.cronExpression || job.intervalMs) {
        const expectedNextRun = calculateNextRunFromLastRun(job, job.lastRun, config);
        const drift = Math.abs(savedNextRun.getTime() - expectedNextRun.getTime());
        if (drift > config.restartBehavior.maxTimingDrift) {
            logging.debug({ module: job.module }, `Adjusting timing for ${job.name} - drift of ${Math.round(drift / 1000)}s detected`);
            return expectedNextRun;
        }
    }

    return savedNextRun;
};

// Restores this job's saved run history (count, lastRun) and next-run
// timing from the persisted state file. Mirrors queue-plugin's per-queue
// loadQueueState: called from addJob right after the scheduler is
// registered, not at plugin init - the saved file has nothing to match
// against that early, since no jobs have been added yet.
export const loadJobState = async (runtime: SchedulerRuntime, scheduler: SchedulerService): Promise<SchedulerService> => {
    try {
        const stateData = await readStateData(runtime.config.persistence.directory);
        if (!stateData) {
            return scheduler;
        }

        const savedJob = stateData.jobs.find(job => job.name === scheduler.job.name);
        if (!savedJob) {
            return scheduler;
        }

        const definitionChanged = hasJobDefinitionChanged(scheduler.job, savedJob);
        const lastRun = savedJob.lastRun ? new Date(savedJob.lastRun) : undefined;

        const updatedJob: ScheduledJob = {
            ...scheduler.job,
            runCount: savedJob.runCount,
            lastRun,
        };

        if (definitionChanged) {
            runtime.logging.debug({ module: scheduler.job.module }, `Job definition changed: ${savedJob.name} - recalculating schedule`);
            updatedJob.nextRun = calculateNextRunFromLastRun(updatedJob, lastRun, runtime.config);
        } else {
            updatedJob.nextRun = validateAndAdjustNextRun(updatedJob, savedJob.nextRun ? new Date(savedJob.nextRun) : undefined, runtime);
        }

        if (runtime.config.cron.logCronDetails && updatedJob.cronExpression) {
            const result = parseCronExpression(updatedJob.cronExpression, updatedJob.lastRun, { timezone: updatedJob.timezone });
            runtime.logging.debug(
                { module: scheduler.job.module },
                `Job restored: ${savedJob.name} - ${result.description} - next: ${updatedJob.nextRun.toLocaleString()}`
            );
        } else {
            runtime.logging.debug({ module: scheduler.job.module }, `Job state restored: ${savedJob.name}`);
        }

        return { ...scheduler, job: updatedJob };
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            runtime.logging.debug('No saved scheduler state found - starting fresh');
        } else {
            runtime.logging.error({ error: error?.message }, `Failed to load job state for ${scheduler.job.name}`);
        }
        return scheduler;
    }
};

// Execution history isn't tied to any one job, so it's restored once at
// plugin init (unlike per-job state, which loadJobState restores lazily as
// each job is registered).
export const loadExecutionHistory = async (runtime: SchedulerRuntime): Promise<void> => {
    try {
        const stateData = await readStateData(runtime.config.persistence.directory);
        if (stateData?.executions) {
            runtime.executionHistory = restoreExecutionHistory(stateData.executions);
        }
    } catch (error: any) {
        if (error.code !== 'ENOENT') {
            runtime.logging.error({ error: error?.message }, 'Failed to load execution history');
        }
    }
};

export const initializePersistence = async (runtime: SchedulerRuntime): Promise<void> => {
    try {
        await fs.mkdir(runtime.config.persistence.directory, { recursive: true });
        await loadExecutionHistory(runtime);

        if (runtime.config.persistence.saveOnShutdown) {
            const shutdownHandler = async () => {
                runtime.logging.debug('Saving scheduler state before shutdown...');
                await saveSchedulerState(runtime);
                process.exit(0);
            };

            process.on('SIGINT', shutdownHandler);
            process.on('SIGTERM', shutdownHandler);
        }

        runtime.logging.debug(`Scheduler persistence initialized: ${runtime.config.persistence.directory}`);
    } catch (error: any) {
        runtime.logging.error({ error: error?.message }, 'Failed to initialize scheduler persistence');
    }
};
