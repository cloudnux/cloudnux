import { SchedulerConfig, SchedulerDashboardJob, SchedulerRuntime } from "./types";
import { getNextExecutions, parseCronExpression } from "./cron-utils";
import { getTimeUntilNextRun } from "./utils";

// default config
export const DEFAULT_CONFIG: SchedulerConfig = {
    tickIntervalMs: 1000,
    persistence: {
        enabled: true,
        directory: './.develop/scheduler-data',
        saveInterval: 30000, // 30 seconds
        saveOnShutdown: false,
    },
    execution: {
        maxConcurrent: 5,
        defaultTimeout: 300000, // 5 minutes
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
    },
};

// Pure function to merge configs
export const mergeConfig = (defaultConfig: SchedulerConfig, userConfig?: Partial<SchedulerConfig>): SchedulerConfig => ({
    ...defaultConfig,
    ...userConfig,
    persistence: { ...defaultConfig.persistence, ...userConfig?.persistence },
    execution: { ...defaultConfig.execution, ...userConfig?.execution },
    cleanup: { ...defaultConfig.cleanup, ...userConfig?.cleanup },
    restartBehavior: { ...defaultConfig.restartBehavior, ...userConfig?.restartBehavior },
    cron: { ...defaultConfig.cron, ...userConfig?.cron },
});

// Pure function to build the dashboard view of every job
export const createDashboardSummary = (runtime: SchedulerRuntime): { jobs: SchedulerDashboardJob[]; runningExecutions: number } => {
    const jobs = Object.values(runtime.schedulers).map((scheduler): SchedulerDashboardJob => {
        const upcomingExecutions = scheduler.job.cronExpression
            ? getNextExecutions(scheduler.job.cronExpression, 3, { timezone: scheduler.job.timezone })
            : [];

        const cronDescription = scheduler.job.cronExpression
            ? parseCronExpression(scheduler.job.cronExpression, undefined, { timezone: scheduler.job.timezone }).description
            : undefined;

        return {
            ...scheduler.job,
            isRunning: scheduler.isRunning,
            timeUntilNextRun: getTimeUntilNextRun(scheduler.job),
            upcomingExecutions,
            cronDescription,
        };
    });

    return { jobs, runningExecutions: runtime.runningExecutions };
};

// Pure function to build the executions view
export const createExecutionsSummary = (runtime: SchedulerRuntime) => ({
    executions: runtime.executionHistory.slice(-50), // Last 50 executions
    running: Object.values(runtime.executions).filter(e => e.status === 'running'),
});
