import { ScheduledJob, SchedulerConfig } from "./types";
import { parseCronExpression } from "./cron-utils";

export const generateJobId = (): string =>
    `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const generateExecutionId = (): string =>
    `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const calculateNextRun = (
    job: ScheduledJob,
    preserveNaturalTiming: boolean = true
): Date => {
    const now = new Date();

    if (job.cronExpression) {
        const result = parseCronExpression(job.cronExpression, job.lastRun, {
            preserveNaturalTiming,
            timezone: job.timezone,
            currentDate: preserveNaturalTiming && job.lastRun ? job.lastRun : now
        });
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
};

export const calculateNextRunFromLastRun = (
    job: ScheduledJob,
    lastRun: Date | undefined,
    config: SchedulerConfig
): Date => {
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
};

export const hasJobDefinitionChanged = (currentJob: ScheduledJob, savedJob: any): boolean => (
    currentJob.cronExpression !== savedJob.cronExpression ||
    currentJob.intervalMs !== savedJob.intervalMs ||
    currentJob.delayMs !== savedJob.delayMs ||
    currentJob.maxRuns !== savedJob.maxRuns ||
    currentJob.timezone !== savedJob.timezone
);

export const shouldSkipJob = (job: ScheduledJob): boolean => {
    if (!job.enabled) return true;
    if (job.maxRuns && job.runCount >= job.maxRuns) return true;
    return false;
};

export const isJobReadyToRun = (job: ScheduledJob): boolean => {
    const now = new Date();
    return job.nextRun.getTime() <= now.getTime();
};

export const getTimeUntilNextRun = (job: ScheduledJob): number =>
    Math.max(0, job.nextRun.getTime() - Date.now());