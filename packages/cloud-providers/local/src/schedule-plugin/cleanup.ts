import chalk from "chalk";
import logSymbols from "log-symbols";

import { logger } from "@cloudnux/utils";

import { SchedulerState, JobExecution } from "./types";

export const cleanupExecutionHistory = (
    state: SchedulerState,
): JobExecution[] => {
    if (state.executionHistory.length > state.config.cleanup.maxExecutionHistory) {
        const removed = state.executionHistory.splice(
            0,
            state.executionHistory.length - state.config.cleanup.maxExecutionHistory
        );

        logger.info(`${chalk.blue('🧹 Cleaned up')} ${removed.length} old execution records`);
        return removed;
    }

    return [];
};

export const startCleanupInterval = (
    state: SchedulerState
): NodeJS.Timeout => {
    return setInterval(() => {
        cleanupExecutionHistory(state);
    }, state.config.cleanup.cleanupInterval);
};

export const clearAllTimers = (schedulers: Record<string, any>): void => {
    for (const scheduler of Object.values(schedulers)) {
        if (scheduler.timerId) {
            clearTimeout(scheduler.timerId);
            scheduler.timerId = undefined;
        }
    }
};

export const waitForRunningJobs = async (
    getRunningExecutions: () => number,
    maxWaitTime: number = 30000,
): Promise<void> => {
    const startTime = Date.now();

    while (getRunningExecutions() > 0 && (Date.now() - startTime) < maxWaitTime) {
        logger.info(`${chalk.yellow('⏳ Waiting for')} ${getRunningExecutions()} running jobs to complete...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
};

export const createShutdownHandler = (
    state: SchedulerState,
    saveStateFn: () => Promise<void>
) => async (): Promise<void> => {
    logger.info(`${chalk.yellow('🛑 Enhanced scheduler shutting down...')}`);

    // Mark as shutting down
    state.isShuttingDown = true;

    // Clear all timers
    clearAllTimers(state.schedulers);

    // Clear cleanup interval
    if (state.cleanupInterval) {
        clearInterval(state.cleanupInterval);
    }

    // Wait for running jobs
    await waitForRunningJobs(() => state.runningExecutions, 30000);

    // Save final state
    if (state.config.persistence.enabled) {
        await saveStateFn();
    }

    logger.debug(`${logSymbols.success} ${chalk.green('Enhanced scheduler shutdown complete')}`);
};

export const setupGracefulShutdown = (
    shutdownHandler: () => Promise<void>,
    app: any
): void => {
    process.on('SIGINT', shutdownHandler);
    process.on('SIGTERM', shutdownHandler);
    app.addHook('onClose', async () => {
        await shutdownHandler();
    });
};