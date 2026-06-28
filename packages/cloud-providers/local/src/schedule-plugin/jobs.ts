import { moduleLogger } from "../logging";

import { JobDefinition, ScheduledJob, SchedulerService, SchedulerConfig } from "./types";
import { detectExpressionType, convertRateToCron, parseCronExpression, getNextExecutions } from "./cron-utils";
import { generateJobId, calculateNextRun } from "./utils";

export const validateJobDefinition = (
    jobDef: JobDefinition
): void => {
    const expressionType = detectExpressionType(jobDef.cronExpression);
    if (expressionType === "unknown") {
        moduleLogger(jobDef.module).error(`Invalid cron expression for job: ${jobDef.name}`);
        throw new Error(`Invalid cron expression for job: ${jobDef.name}`);
    }
};

export const createJobFromDefinition = (
    jobDef: JobDefinition,
    config: SchedulerConfig
): ScheduledJob => {
    validateJobDefinition(jobDef);

    const expressionType = detectExpressionType(jobDef.cronExpression);

    if (config.cron.logCronDetails && jobDef.cronExpression) {
        const cronExpression = expressionType === "rate"
            ? convertRateToCron(jobDef.cronExpression).cronExpression
            : jobDef.cronExpression;

        const result = parseCronExpression(cronExpression, undefined, {
            timezone: jobDef.timezone ?? config.cron.defaultTimezone
        });

        moduleLogger(jobDef.module).debug(`Job ${jobDef.name}: ${result.description} - Next: ${result.nextRun.toLocaleString()}`);

        const upcoming = getNextExecutions(cronExpression, 3, {
            timezone: jobDef.timezone ?? config.cron.defaultTimezone
        });
        moduleLogger(jobDef.module).debug(`Upcoming: ${upcoming.map(d => d.toLocaleTimeString()).join(', ')}`);
    }

    const job: ScheduledJob = {
        id: generateJobId(),
        name: jobDef.name,
        cronExpression: expressionType === "rate"
            ? convertRateToCron(jobDef.cronExpression!).cronExpression
            : jobDef.cronExpression,
        intervalMs: jobDef.intervalMs,
        delayMs: jobDef.delayMs,
        nextRun: new Date(),
        enabled: jobDef.enabled ?? true,
        runCount: 0,
        maxRuns: jobDef.maxRuns,
        metadata: jobDef.metadata,
        createdAt: new Date(),
        timezone: jobDef.timezone,
        module: jobDef.module
    };

    job.nextRun = calculateNextRun(job);
    return job;
};

export const createSchedulerService = (
    job: ScheduledJob,
    handler: any
): SchedulerService => ({
    job,
    handler,
    isRunning: false,
});

export const enableJob = (scheduler: SchedulerService): SchedulerService => ({
    ...scheduler,
    job: {
        ...scheduler.job,
        enabled: true,
        nextRun: calculateNextRun(scheduler.job)
    }
});

export const disableJob = (scheduler: SchedulerService): SchedulerService => {
    if (scheduler.timerId) {
        clearTimeout(scheduler.timerId);
    }

    return {
        ...scheduler,
        job: { ...scheduler.job, enabled: false },
        timerId: undefined
    };
};