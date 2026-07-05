import { JobDefinition, JobHandler, SchedulerManager, SchedulerRuntime, SchedulerService } from "./types";
import { createJobFromDefinition, createSchedulerService, disableJob as disableJobData, enableJob as enableJobData } from "./jobs";
import { createDashboardSummary, createExecutionsSummary } from "./core";
import { getNextExecutions, parseCronExpression } from "./cron-utils";
import { loadJobState } from "./persistence";
import { executeJob } from "./processing";

const isValidJobName = (jobName: string): boolean => {
    return typeof jobName === 'string' && jobName.length > 0 && /^[a-zA-Z0-9_-]+$/.test(jobName);
};

const validateJobName = (jobName: string): void => {
    if (!jobName || typeof jobName !== 'string') {
        throw new Error('Job name must be a non-empty string');
    }

    if (!isValidJobName(jobName)) {
        throw new Error('Job name must contain only alphanumeric characters, hyphens, and underscores');
    }
};

const validateHandler = (handler: JobHandler): void => {
    if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
    }
};

const findSchedulerByName = (runtime: SchedulerRuntime, jobName: string): SchedulerService | undefined =>
    Object.values(runtime.schedulers).find(scheduler => scheduler.job.name === jobName);

export const addJob = async (runtime: SchedulerRuntime, jobDefinition: JobDefinition): Promise<string> => {
    try {
        validateJobName(jobDefinition.name);
        validateHandler(jobDefinition.handler);

        const existing = findSchedulerByName(runtime, jobDefinition.name);
        if (existing) {
            runtime.logging.warn({ module: jobDefinition.module }, `Job already exists: ${jobDefinition.name}.`);
            return existing.job.id;
        }

        const job = createJobFromDefinition(jobDefinition, runtime.config);

        if (runtime.config.cron.logCronDetails && job.cronExpression) {
            const timezone = job.timezone ?? runtime.config.cron.defaultTimezone;
            const result = parseCronExpression(job.cronExpression, undefined, { timezone });
            runtime.logging.debug(
                { module: jobDefinition.module },
                `Job ${jobDefinition.name}: ${result.description} - Next: ${result.nextRun.toLocaleString()}`
            );

            const upcoming = getNextExecutions(job.cronExpression, 3, { timezone });
            runtime.logging.debug(
                { module: jobDefinition.module },
                `Upcoming: ${upcoming.map(d => d.toLocaleTimeString()).join(', ')}`
            );
        }

        let scheduler = createSchedulerService(job, jobDefinition.handler);

        if (runtime.config.persistence.enabled) {
            scheduler = await loadJobState(runtime, scheduler);
        }

        runtime.schedulers[scheduler.job.id] = scheduler;

        runtime.logging.info({ module: jobDefinition.module }, `Job added: ${jobDefinition.name} (${scheduler.job.id})`);

        return scheduler.job.id;
    } catch (error: any) {
        runtime.logging.error({ module: jobDefinition.module, error: error.message }, `Failed to add job ${jobDefinition.name}`);
        throw error;
    }
};

export const removeJob = async (runtime: SchedulerRuntime, jobName: string): Promise<void> => {
    try {
        validateJobName(jobName);

        const scheduler = findSchedulerByName(runtime, jobName);
        if (!scheduler) {
            throw new Error(`Job '${jobName}' does not exist`);
        }

        if (scheduler.isRunning) {
            runtime.logging.warn({ module: scheduler.job.module }, `Removing job that is currently running: ${jobName}`);
        }

        delete runtime.schedulers[scheduler.job.id];

        runtime.logging.info({ module: scheduler.job.module }, `Job removed: ${jobName}`);
    } catch (error: any) {
        runtime.logging.error({ error: error.message }, `Failed to remove job ${jobName}`);
        throw error;
    }
};

export const hasJob = (runtime: SchedulerRuntime, jobName: string): boolean => {
    try {
        validateJobName(jobName);
        return !!findSchedulerByName(runtime, jobName);
    } catch {
        return false;
    }
};

export const listJobs = (runtime: SchedulerRuntime, module?: string): string[] => {
    return Object.values(runtime.schedulers)
        .filter(scheduler => !module || scheduler.job.module === module)
        .map(scheduler => scheduler.job.name)
        .sort();
};

export const getJobStats = (runtime: SchedulerRuntime, jobName: string): SchedulerService | null => {
    try {
        validateJobName(jobName);
        return findSchedulerByName(runtime, jobName) ?? null;
    } catch {
        return null;
    }
};

export const getJobsMap = (runtime: SchedulerRuntime): Record<string, SchedulerService> => {
    // Return a copy to prevent external modification
    return { ...runtime.schedulers };
};

export const enableJob = async (runtime: SchedulerRuntime, jobName: string): Promise<void> => {
    try {
        validateJobName(jobName);

        const scheduler = findSchedulerByName(runtime, jobName);
        if (!scheduler) {
            throw new Error(`Job '${jobName}' does not exist`);
        }

        if (scheduler.job.enabled) {
            runtime.logging.debug({ module: scheduler.job.module }, `Job is already enabled: ${jobName}`);
            return;
        }

        runtime.schedulers[scheduler.job.id] = enableJobData(scheduler);
        runtime.logging.info({ module: scheduler.job.module }, `Job enabled: ${jobName}`);
    } catch (error: any) {
        runtime.logging.error({ error: error.message }, `Failed to enable job ${jobName}`);
        throw error;
    }
};

export const disableJob = async (runtime: SchedulerRuntime, jobName: string): Promise<void> => {
    try {
        validateJobName(jobName);

        const scheduler = findSchedulerByName(runtime, jobName);
        if (!scheduler) {
            throw new Error(`Job '${jobName}' does not exist`);
        }

        if (!scheduler.job.enabled) {
            runtime.logging.debug({ module: scheduler.job.module }, `Job is already disabled: ${jobName}`);
            return;
        }

        runtime.schedulers[scheduler.job.id] = disableJobData(scheduler);
        runtime.logging.info({ module: scheduler.job.module }, `Job disabled: ${jobName}`);
    } catch (error: any) {
        runtime.logging.error({ error: error.message }, `Failed to disable job ${jobName}`);
        throw error;
    }
};

export const triggerJob = async (runtime: SchedulerRuntime, jobName: string): Promise<void> => {
    try {
        validateJobName(jobName);

        const scheduler = findSchedulerByName(runtime, jobName);
        if (!scheduler) {
            throw new Error(`Job '${jobName}' does not exist`);
        }

        if (scheduler.isRunning) {
            throw new Error(`Job '${jobName}' is already running`);
        }

        runtime.logging.info({ module: scheduler.job.module }, `Job triggered: ${jobName}`);

        // Fire-and-forget, same as the tick's own dispatch - callers (e.g.
        // the trigger route) get an immediate response rather than waiting
        // out the job's full run.
        runtime.logging.runWithLogContext(
            { module: scheduler.job.module, reqId: scheduler.job.id },
            () => executeJob(runtime, scheduler)
        );
    } catch (error: any) {
        runtime.logging.error({ error: error.message }, `Failed to trigger job ${jobName}`);
        throw error;
    }
};

export const getDashboardSummary = (runtime: SchedulerRuntime) => createDashboardSummary(runtime);

export const getExecutionsSummary = (runtime: SchedulerRuntime) => createExecutionsSummary(runtime);

// Unlike getExecutionsSummary (last 50 across every job), this filters the
// full executionHistory down to one job first - so a busy job elsewhere
// can't push a quieter job's own runs out of view.
export const getJobExecutionHistory = (runtime: SchedulerRuntime, jobName: string, limit = 50) => {
    const scheduler = findSchedulerByName(runtime, jobName);
    if (!scheduler) {
        return [];
    }

    return runtime.executionHistory
        .filter(execution => execution.jobId === scheduler.job.id)
        .slice(-limit)
        .reverse();
};

// The one place runtime gets bound into the public app.scheduler shape -
// Fastify needs a plain object of methods with no runtime param, so this
// wraps each plain function above with `runtime` pre-applied. Everything
// above this line is a normal function you can call directly with an
// explicit runtime, e.g. in tests.
export const createSchedulerManager = (runtime: SchedulerRuntime): SchedulerManager => ({
    addJob: (jobDefinition) => addJob(runtime, jobDefinition),
    removeJob: (jobName) => removeJob(runtime, jobName),
    hasJob: (jobName) => hasJob(runtime, jobName),
    listJobs: (module) => listJobs(runtime, module),
    getJobStats: (jobName) => getJobStats(runtime, jobName),
    getJobsMap: () => getJobsMap(runtime),
    getConfig: () => runtime.config,
    enableJob: (jobName) => enableJob(runtime, jobName),
    disableJob: (jobName) => disableJob(runtime, jobName),
    triggerJob: (jobName) => triggerJob(runtime, jobName),
    getDashboardSummary: () => getDashboardSummary(runtime),
    getExecutionsSummary: () => getExecutionsSummary(runtime),
    getJobExecutionHistory: (jobName, limit) => getJobExecutionHistory(runtime, jobName, limit),
});
