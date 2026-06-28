import { FastifyInstance } from "fastify";

import { moduleLogger } from "../logging";

import { SchedulerManager, SchedulerDecoratorOptions, JobDefinition, JobHandler } from "./types";
import { validateJobDefinition, createJobFromDefinition, createSchedulerService } from "./jobs";

const isValidJobName = (jobName: string): boolean => {
    return typeof jobName === 'string' && jobName.length > 0 && /^[a-zA-Z0-9_-]+$/.test(jobName);
};

// Higher-order function to create the scheduler manager
export const createSchedulerManager = ({
    state,
    scheduleJobFn,
    executeJob,
    config
}: SchedulerDecoratorOptions): SchedulerManager => {

    // Pure function to validate job name
    const validateJobName = (jobName: string): void => {
        if (!jobName || typeof jobName !== 'string') {
            throw new Error('Job name must be a non-empty string');
        }

        if (!isValidJobName(jobName)) {
            throw new Error('Job name must contain only alphanumeric characters, hyphens, and underscores');
        }
    };

    // Pure function to validate handler
    const validateHandler = (handler: JobHandler): void => {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
    };

    const addJob = async (jobDefinition: JobDefinition): Promise<string> => {
        try {
            validateJobName(jobDefinition.name);
            validateHandler(jobDefinition.handler);

            // Validate job definition (cron expression, etc.)
            validateJobDefinition(jobDefinition);

            // Check if job already exists
            const existingJob = Object.values(state.schedulers).find(s => s.job.name === jobDefinition.name);
            if (existingJob) {
                moduleLogger(jobDefinition.module).warn(`Job already exists: ${jobDefinition.name}.`);
                return existingJob.job.id;
            }

            // Create new job
            const job = createJobFromDefinition(jobDefinition, config);
            const scheduler = createSchedulerService(job, jobDefinition.handler);

            // Add to state
            state.schedulers[job.id] = scheduler;

            // Schedule if enabled
            if (job.enabled) {
                scheduleJobFn(scheduler);
            }

            moduleLogger(jobDefinition.module).info(`Job added: ${jobDefinition.name} (${job.id})`);

            return job.id;
        } catch (error: any) {
            moduleLogger(jobDefinition.module).error(`Failed to add job ${jobDefinition.name}: ${error.message}`);
            throw error;
        }
    };

    const removeJob = async (jobName: string): Promise<void> => {
        try {
            validateJobName(jobName);

            const scheduler = Object.values(state.schedulers).find(s => s.job.name === jobName);
            if (!scheduler) {
                throw new Error(`Job '${jobName}' does not exist`);
            }

            // Check if job is currently running
            if (scheduler.isRunning) {
                moduleLogger(scheduler.job.module).warn(`Removing job that is currently running: ${jobName}`);
            }

            // Clear any scheduled timeout
            if (scheduler.timerId) {
                clearTimeout(scheduler.timerId);
            }

            // Remove from state
            delete state.schedulers[scheduler.job.id];

            moduleLogger(scheduler.job.module).info(`Job removed: ${jobName}`);
        } catch (error: any) {
            moduleLogger(Object.values(state.schedulers).find(s => s.job.name === jobName)?.job.module).error(`Failed to remove job ${jobName}: ${error.message}`);
            throw error;
        }
    };

    const hasJob = (jobName: string): boolean => {
        try {
            validateJobName(jobName);
            return Object.values(state.schedulers).some(s => s.job.name === jobName);
        } catch {
            return false;
        }
    };

    const listJobs = (module?: string): string[] => {
        return Object.values(state.schedulers)
            .filter(s => !module || s.job.module === module)
            .map(s => s.job.name)
            .sort();
    };

    const getJobStats = (jobName: string) => {
        try {
            validateJobName(jobName);
            const scheduler = Object.values(state.schedulers).find(s => s.job.name === jobName);
            return scheduler || null;
        } catch {
            return null;
        }
    };

    const enableJob = async (jobName: string): Promise<void> => {
        try {
            validateJobName(jobName);

            const scheduler = Object.values(state.schedulers).find(s => s.job.name === jobName);
            if (!scheduler) {
                throw new Error(`Job '${jobName}' does not exist`);
            }

            if (scheduler.job.enabled) {
                moduleLogger(scheduler.job.module).debug(`Job is already enabled: ${jobName}`);
                return;
            }

            // Enable the job
            scheduler.job.enabled = true;

            // Schedule it
            scheduleJobFn(scheduler);

            moduleLogger(scheduler.job.module).info(`Job enabled: ${jobName}`);
        } catch (error: any) {
            moduleLogger(Object.values(state.schedulers).find(s => s.job.name === jobName)?.job.module).error(`Failed to enable job ${jobName}: ${error.message}`);
            throw error;
        }
    };

    const disableJob = async (jobName: string): Promise<void> => {
        try {
            validateJobName(jobName);

            const scheduler = Object.values(state.schedulers).find(s => s.job.name === jobName);
            if (!scheduler) {
                throw new Error(`Job '${jobName}' does not exist`);
            }

            if (!scheduler.job.enabled) {
                moduleLogger(scheduler.job.module).debug(`Job is already disabled: ${jobName}`);
                return;
            }

            // Disable the job
            scheduler.job.enabled = false;

            // Clear timer if exists
            if (scheduler.timerId) {
                clearTimeout(scheduler.timerId);
                scheduler.timerId = undefined;
            }

            moduleLogger(scheduler.job.module).info(`Job disabled: ${jobName}`);
        } catch (error: any) {
            moduleLogger(Object.values(state.schedulers).find(s => s.job.name === jobName)?.job.module).error(`Failed to disable job ${jobName}: ${error.message}`);
            throw error;
        }
    };

    const triggerJob = async (jobName: string): Promise<void> => {
        try {
            validateJobName(jobName);

            const scheduler = Object.values(state.schedulers).find(s => s.job.name === jobName);
            if (!scheduler) {
                throw new Error(`Job '${jobName}' does not exist`);
            }

            if (scheduler.isRunning) {
                throw new Error(`Job '${jobName}' is already running`);
            }

            // Trigger immediately
            setImmediate(() => executeJob(scheduler));

            moduleLogger(scheduler.job.module).info(`Job triggered: ${jobName}`);
        } catch (error: any) {
            moduleLogger(Object.values(state.schedulers).find(s => s.job.name === jobName)?.job.module).error(`Failed to trigger job ${jobName}: ${error.message}`);
            throw error;
        }
    };

    const getJobsMap = () => {
        // Return a copy to prevent external modification
        return { ...state.schedulers };
    };

    return {
        addJob,
        removeJob,
        hasJob,
        listJobs,
        getJobStats,
        enableJob,
        disableJob,
        triggerJob,
        getJobsMap
    };
};

// Higher-order function to create decorator registration function
export const createSchedulerDecorator = (schedulerManager: SchedulerManager) =>
    (app: FastifyInstance): void => {
        app.decorate('scheduler', schedulerManager);
    };