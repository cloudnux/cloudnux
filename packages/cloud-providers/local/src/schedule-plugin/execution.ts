import chalk from "chalk";
import logSymbols from "log-symbols";

import { logger } from "@cloudnux/utils";

import { JobExecution, ScheduledJob, SchedulerConfig, SchedulerService, SchedulerState, JobHandler } from "./types";
import { generateExecutionId, calculateNextRunFromLastRun, shouldSkipJob, getTimeUntilNextRun } from "./utils";

export const createJobExecution = (jobId: string): JobExecution => ({
    id: generateExecutionId(),
    jobId,
    startTime: new Date(),
    status: 'running',
});

export const completeExecution = (
    execution: JobExecution,
    result?: any,
    error?: string
): JobExecution => ({
    ...execution,
    endTime: new Date(),
    status: error ? 'failed' : 'completed',
    result,
    error,
});

export const canExecuteJob = (
    scheduler: SchedulerService,
    state: SchedulerState
): { canExecute: boolean; reason?: string } => {
    if (state.isShuttingDown) {
        return { canExecute: false, reason: 'System is shutting down' };
    }

    if (scheduler.isRunning) {
        return { canExecute: false, reason: 'Job is already running' };
    }

    if (shouldSkipJob(scheduler.job)) {
        const reason = !scheduler.job.enabled
            ? 'Job is disabled'
            : 'Job reached maximum runs';
        return { canExecute: false, reason };
    }

    if (state.runningExecutions >= state.config.execution.maxConcurrent) {
        return { canExecute: false, reason: 'Maximum concurrent executions reached' };
    }

    return { canExecute: true };
};

export const scheduleJob = (
    scheduler: SchedulerService,
    state: SchedulerState,
    executeJobFn: (scheduler: SchedulerService) => Promise<void>,
): SchedulerService => {
    if (state.isShuttingDown) return scheduler;

    const timeUntilNextRun = getTimeUntilNextRun(scheduler.job);

    const updatedScheduler = { ...scheduler };

    if (timeUntilNextRun <= 0) {
        // Should run now
        setImmediate(() => executeJobFn(updatedScheduler));
    } else {
        // Schedule for future
        updatedScheduler.timerId = setTimeout(() => {
            executeJobFn(updatedScheduler);
        }, timeUntilNextRun);

        logger.info(`${chalk.blue('📅 Scheduled job')} ${chalk.green(scheduler.job.name)} to run in ${chalk.cyan(Math.round(timeUntilNextRun / 1000))}s`);
    }

    return updatedScheduler;
};

export const executeJobWithTimeout = async (
    handler: JobHandler,
    job: ScheduledJob,
    execution: JobExecution,
    timeoutMs: number
): Promise<any> => {
    return Promise.race([
        handler(job, execution),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Job execution timeout')), timeoutMs)
        )
    ]);
};

export const updateJobAfterExecution = (
    job: ScheduledJob,
    execution: JobExecution,
    config: SchedulerConfig
): ScheduledJob => {
    const updatedJob = {
        ...job,
        lastRun: execution.startTime,
        runCount: job.runCount + 1,
    };

    if (job.enabled) {
        updatedJob.nextRun = calculateNextRunFromLastRun(updatedJob, updatedJob.lastRun, config);
    }

    return updatedJob;
};

export const handleExecutionError = (
    execution: JobExecution,
    error: Error,
): JobExecution => {
    logger.error(`${logSymbols.error} ${chalk.red('Job failed')} ${execution.jobId}: ${error.message}`);

    return completeExecution(execution, undefined, error.message);
};

export const handleExecutionSuccess = (
    execution: JobExecution,
    result: any,
): JobExecution => {
    const duration = execution.endTime ? execution.endTime.getTime() - execution.startTime.getTime() : 0;

    logger.debug(`${logSymbols.success} ${chalk.green('Job completed')} in ${duration}ms`);

    return completeExecution(execution, result);
};