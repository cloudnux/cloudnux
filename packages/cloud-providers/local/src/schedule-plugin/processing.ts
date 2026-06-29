import { JobExecution, JobHandler, ScheduledJob, SchedulerRuntime, SchedulerService } from "./types";
import { completeExecution, createJobExecution, updateJobAfterExecution } from "./jobs";
import { isJobReadyToRun, shouldSkipJob } from "./utils";
import { saveSchedulerState } from "./persistence";

// Pure function to check whether a job can run right now
export const canExecuteJob = (
    runtime: SchedulerRuntime,
    scheduler: SchedulerService
): { canExecute: boolean; reason?: string } => {
    if (runtime.isShuttingDown) {
        return { canExecute: false, reason: 'System is shutting down' };
    }

    if (scheduler.isRunning) {
        return { canExecute: false, reason: 'Job is already running' };
    }

    if (shouldSkipJob(scheduler.job)) {
        const reason = !scheduler.job.enabled ? 'Job is disabled' : 'Job reached maximum runs';
        return { canExecute: false, reason };
    }

    if (runtime.runningExecutions >= runtime.config.execution.maxConcurrent) {
        return { canExecute: false, reason: 'Maximum concurrent executions reached' };
    }

    return { canExecute: true };
};

const executeJobWithTimeout = async (
    handler: JobHandler,
    job: ScheduledJob,
    execution: JobExecution,
    timeoutMs: number
): Promise<any> => {
    let timerId: NodeJS.Timeout;

    try {
        return await Promise.race([
            handler(job, execution),
            new Promise((_, reject) => {
                timerId = setTimeout(() => reject(new Error('Job execution timeout')), timeoutMs);
            }),
        ]);
    } finally {
        clearTimeout(timerId!);
    }
};

// Runs one job through its handler, recording the execution and advancing
// its nextRun. Used by both the tick (once per due job) and triggerJob -
// both go through the same path, wrapped in runWithLogContext by the
// caller so every log call below carries the job's module/reqId.
export const executeJob = async (runtime: SchedulerRuntime, scheduler: SchedulerService): Promise<void> => {
    const execution = createJobExecution(scheduler.job.id);
    // Tracked in two places (the `executions` map and `executionHistory`)
    // but as a single shared reference - completeExecution below mutates
    // this same object via Object.assign so both views stay in sync,
    // instead of completeExecution's return value only updating one of them.
    runtime.executions[execution.id] = execution;
    runtime.executionHistory.push(execution);
    scheduler.isRunning = true;
    runtime.runningExecutions++;

    runtime.logging.info(`Executing job ${scheduler.job.name} (${execution.id})`);

    try {
        const result = await executeJobWithTimeout(
            scheduler.handler,
            scheduler.job,
            execution,
            runtime.config.execution.defaultTimeout
        );

        Object.assign(execution, completeExecution(execution, result));

        const duration = execution.endTime!.getTime() - execution.startTime.getTime();
        runtime.logging.debug(`Job completed in ${duration}ms`);
    } catch (error: any) {
        Object.assign(execution, completeExecution(execution, undefined, error.message));
        runtime.logging.error(`Job failed ${scheduler.job.name}: ${error.message}`);
    } finally {
        scheduler.isRunning = false;
        runtime.runningExecutions--;
        scheduler.job = updateJobAfterExecution(scheduler.job, execution, runtime.config);

        if (scheduler.job.maxRuns && scheduler.job.runCount >= scheduler.job.maxRuns) {
            runtime.logging.info(`Job ${scheduler.job.name} reached max runs (${scheduler.job.maxRuns})`);
        }

        if (runtime.config.persistence.enabled) {
            runtime.isDirty = true;
        }
    }
};

const dispatchJobIfDue = (runtime: SchedulerRuntime, scheduler: SchedulerService): void => {
    if (!scheduler.job.enabled || !isJobReadyToRun(scheduler.job)) {
        return;
    }

    const { canExecute, reason } = canExecuteJob(runtime, scheduler);
    if (!canExecute) {
        // Not a permanent skip (except the maxRuns case, logged once above
        // instead) - e.g. at max concurrency, or another tick of the same
        // job already running. The job's nextRun hasn't moved, so the very
        // next tick simply tries again, instead of the old per-job timer
        // needing to be explicitly rescheduled with a delay. Logged at
        // debug to avoid spamming at tick frequency.
        if (reason === 'Maximum concurrent executions reached') {
            runtime.logging.debug({ module: scheduler.job.module }, `Delaying job ${scheduler.job.name} - ${reason}`);
        }
        return;
    }

    runtime.logging.runWithLogContext(
        { module: scheduler.job.module, reqId: scheduler.job.id },
        () => executeJob(runtime, scheduler)
    );
};

export const cleanupExecutionHistory = (runtime: SchedulerRuntime): void => {
    const { maxExecutionHistory } = runtime.config.cleanup;
    if (runtime.executionHistory.length <= maxExecutionHistory) {
        return;
    }

    const removed = runtime.executionHistory.splice(0, runtime.executionHistory.length - maxExecutionHistory);
    runtime.logging.debug(`Cleaned up ${removed.length} old execution records`);
};

const maybeCleanup = (runtime: SchedulerRuntime, now: number): void => {
    if (now - runtime.lastCleanupTime < runtime.config.cleanup.cleanupInterval) {
        return;
    }
    runtime.lastCleanupTime = now;
    cleanupExecutionHistory(runtime);
};

const maybeSavePersistence = (runtime: SchedulerRuntime, now: number): void => {
    if (!runtime.config.persistence.enabled || !runtime.isDirty) {
        return;
    }

    const saveInterval = runtime.config.persistence.saveInterval ?? 0;
    if (saveInterval > 0 && now - runtime.lastSavedAt >= saveInterval) {
        runtime.lastSavedAt = now;
        runtime.isDirty = false;
        saveSchedulerState(runtime);
    }
};

// The one timer for the whole plugin. Every tickIntervalMs: run any job
// whose nextRun has arrived (this is also how a manual triggerJob's
// recurrence shows up - nothing schedules its own setTimeout anymore); then
// clean up old execution history and save persistence if their intervals
// have elapsed.
export const tick = (runtime: SchedulerRuntime): void => {
    const now = Date.now();
    for (const scheduler of Object.values(runtime.schedulers)) {
        dispatchJobIfDue(runtime, scheduler);
    }
    maybeCleanup(runtime, now);
    maybeSavePersistence(runtime, now);
};
