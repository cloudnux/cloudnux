import { JobDefinition, JobExecution, JobHandler, ScheduledJob, SchedulerConfig, SchedulerService } from "./types";
import { detectExpressionType, convertRateToCron } from "./cron-utils";
import { generateExecutionId, generateJobId, calculateNextRun, calculateNextRunFromLastRun } from "./utils";

// Pure function to validate a job definition before it's turned into a job.
// A job needs exactly one timing source; only validate the cron expression
// itself when one was actually given (intervalMs/delayMs-only jobs have no
// cron expression to check).
export const validateJobDefinition = (jobDef: JobDefinition): void => {
    if (!jobDef.cronExpression && !jobDef.intervalMs && !jobDef.delayMs) {
        throw new Error(`Job ${jobDef.name} must specify a cronExpression, intervalMs, or delayMs`);
    }

    if (jobDef.cronExpression && detectExpressionType(jobDef.cronExpression) === "unknown") {
        throw new Error(`Invalid cron expression for job: ${jobDef.name}`);
    }
};

// Pure function to turn a job definition into a scheduled job
export const createJobFromDefinition = (jobDef: JobDefinition, config: SchedulerConfig): ScheduledJob => {
    validateJobDefinition(jobDef);

    const expressionType = detectExpressionType(jobDef.cronExpression);
    const cronExpression = expressionType === "rate"
        ? convertRateToCron(jobDef.cronExpression!).cronExpression
        : jobDef.cronExpression;

    const job: ScheduledJob = {
        id: generateJobId(),
        name: jobDef.name,
        cronExpression,
        intervalMs: jobDef.intervalMs,
        delayMs: jobDef.delayMs,
        nextRun: new Date(),
        enabled: jobDef.enabled ?? true,
        runCount: 0,
        maxRuns: jobDef.maxRuns,
        metadata: jobDef.metadata,
        createdAt: new Date(),
        timezone: jobDef.timezone,
        module: jobDef.module,
    };

    job.nextRun = calculateNextRun(job, config.restartBehavior.preserveNaturalTiming);
    return job;
};

// Pure function to create a scheduler service for a job
export const createSchedulerService = (job: ScheduledJob, handler: JobHandler): SchedulerService => ({
    job,
    handler,
    isRunning: false,
});

// Pure function to create a job execution record
export const createJobExecution = (jobId: string): JobExecution => ({
    id: generateExecutionId(),
    jobId,
    startTime: new Date(),
    status: 'running',
});

// Pure function to mark an execution as finished
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

// Pure function to advance a job's run count/timing after an execution
export const updateJobAfterExecution = (
    job: ScheduledJob,
    execution: JobExecution,
    config: SchedulerConfig
): ScheduledJob => {
    const updatedJob: ScheduledJob = {
        ...job,
        lastRun: execution.startTime,
        runCount: job.runCount + 1,
    };

    if (updatedJob.enabled) {
        updatedJob.nextRun = calculateNextRunFromLastRun(updatedJob, updatedJob.lastRun, config);
    }

    return updatedJob;
};

// Pure function to enable a job and recompute its next run
export const enableJob = (scheduler: SchedulerService): SchedulerService => ({
    ...scheduler,
    job: {
        ...scheduler.job,
        enabled: true,
        nextRun: calculateNextRun(scheduler.job),
    },
});

// Pure function to disable a job
export const disableJob = (scheduler: SchedulerService): SchedulerService => ({
    ...scheduler,
    job: { ...scheduler.job, enabled: false },
});
