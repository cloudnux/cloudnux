import * as fs from "fs/promises";
import { FastifyInstance } from "fastify";

import { logger } from "@cloudnux/utils";


import { SchedulerConfig, SchedulerState, SchedulerService } from "./types";
import {
    scheduleJob,
    canExecuteJob,
    createJobExecution,
    executeJobWithTimeout,
    updateJobAfterExecution,
    handleExecutionError,
    handleExecutionSuccess
} from "./execution";
import { saveSchedulerState, loadSchedulerState } from "./persistence";
import { cleanupExecutionHistory, createShutdownHandler, setupGracefulShutdown } from "./cleanup";


export const DEFAULT_CONFIG: SchedulerConfig = {
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

export const mergeConfig = (defaultConfig: SchedulerConfig, userConfig?: Partial<SchedulerConfig>): SchedulerConfig => ({
    ...defaultConfig,
    ...userConfig,
    persistence: { ...defaultConfig.persistence, ...userConfig?.persistence },
    execution: { ...defaultConfig.execution, ...userConfig?.execution },
    cleanup: { ...defaultConfig.cleanup, ...userConfig?.cleanup },
    restartBehavior: { ...defaultConfig.restartBehavior, ...userConfig?.restartBehavior },
    cron: { ...defaultConfig.cron, ...userConfig?.cron },
});

export const createInitialState = (
    config: SchedulerConfig
): SchedulerState => {
    return {
        schedulers: {},
        executions: {},
        executionHistory: [],
        isShuttingDown: false,
        runningExecutions: 0,
        isDirty: false,
        lastCleanupTime: Date.now(),
        lastRestartTime: new Date(),
        config,
    };
};

export const createSchedulerFunctions = (
    state: SchedulerState
) => {
    const executeJob = async (scheduler: SchedulerService): Promise<void> => {

        const { canExecute, reason } = canExecuteJob(scheduler, state);

        if (!canExecute) {
            if (reason === 'Maximum concurrent executions reached') {
                logger.warn(`Delaying job ${scheduler.job.name} - ${reason}`);
                scheduler.job.nextRun = new Date(Date.now() + 30000);
                scheduleJobFn(scheduler);
            } else if (reason === 'Job reached maximum runs') {
                logger.info(`Job ${scheduler.job.name} reached max runs (${scheduler.job.maxRuns})`);
            }
            return;
        }

        const execution = createJobExecution(scheduler.job.id);

        state.executions[execution.id] = execution;
        state.executionHistory.push(execution);
        scheduler.isRunning = true;
        state.runningExecutions++;

        logger.info(`Executing job ${scheduler.job.name} (${execution.id})`);

        try {
            const result = await executeJobWithTimeout(
                scheduler.handler,
                scheduler.job,
                execution,
                state.config.execution.defaultTimeout
            );

            const completedExecution = handleExecutionSuccess(execution, result);
            state.executions[execution.id] = completedExecution;
        } catch (error: any) {
            const failedExecution = handleExecutionError(execution, error);
            state.executions[execution.id] = failedExecution;
        } finally {
            scheduler.isRunning = false;
            state.runningExecutions--;
            scheduler.job = updateJobAfterExecution(scheduler.job, execution, state.config);

            if (scheduler.job.enabled && !state.isShuttingDown) {
                scheduleJobFn(scheduler);
            }

            if (state.config.persistence.enabled) {
                state.isDirty = true;
            }
        }
    };

    const scheduleJobFn = (scheduler: SchedulerService): SchedulerService => {
        const updatedScheduler = scheduleJob(scheduler, state, executeJob);
        state.schedulers[scheduler.job.id] = updatedScheduler;
        return updatedScheduler;
    };

    return { executeJob, scheduleJobFn };
};

export const initializeScheduler = async (
    state: SchedulerState,
    scheduleJobFn: (scheduler: SchedulerService) => SchedulerService
): Promise<void> => {

    try {
        if (state.config.persistence.enabled) {
            await fs.mkdir(state.config.persistence.directory, { recursive: true });

            const { schedulers, executionHistory } = await loadSchedulerState(
                state.schedulers,
                state.config,
                state.lastRestartTime
            );

            state.schedulers = schedulers;
            state.executionHistory = executionHistory;

        }

        // Unified tick: handles both state persistence and cleanup
        const tickInterval = state.config.persistence.saveInterval > 0
            ? state.config.persistence.saveInterval
            : state.config.cleanup.cleanupInterval;

        state.tickInterval = setInterval(async () => {
            // Save state only when dirty
            if (state.isDirty && state.config.persistence.enabled) {
                state.isDirty = false;
                await saveSchedulerState(state);
            }

            // Run cleanup when enough time has elapsed
            if (Date.now() - state.lastCleanupTime >= state.config.cleanup.cleanupInterval) {
                state.lastCleanupTime = Date.now();
                cleanupExecutionHistory(state);
            }
        }, tickInterval);

        // Schedule all enabled jobs
        for (const scheduler of Object.values(state.schedulers)) {
            if (scheduler.job.enabled) {
                scheduleJobFn(scheduler);
            }
        }

        logger.debug(`Scheduler initialized: ${Object.keys(state.schedulers).length} jobs loaded`);
    } catch (error: any) {
        logger.error(`Failed to initialize scheduler: ${error.message}`);
        throw error;
    }
};

export const setupSchedulerLifecycle = (
    state: SchedulerState,
    app: FastifyInstance,
): void => {
    const shutdownHandler = createShutdownHandler(
        state,
        () => saveSchedulerState(state)
    );

    setupGracefulShutdown(shutdownHandler, app);
};