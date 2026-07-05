import { FastifyPluginOptions } from "fastify";

import type { LoggingContext } from "../logger/types";

export interface ScheduledJob {
    id: string;
    name: string;
    cronExpression?: string;
    intervalMs?: number;
    delayMs?: number;
    nextRun: Date;
    lastRun?: Date;
    enabled: boolean;
    runCount: number;
    maxRuns?: number;
    metadata?: Record<string, any>;
    createdAt: Date;
    timezone?: string;
    module?: string;
}

export interface JobExecution {
    id: string;
    jobId: string;
    startTime: Date;
    endTime?: Date;
    status: 'running' | 'completed' | 'failed';
    error?: string;
    result?: any;
}

export type JobHandler = (job: ScheduledJob, execution: JobExecution) => Promise<void>;

export interface SchedulerService {
    job: ScheduledJob;
    handler: JobHandler;
    isRunning: boolean;
}

export interface JobDefinition {
    name: string;
    cronExpression?: string;
    intervalMs?: number;
    delayMs?: number;
    handler: JobHandler;
    enabled?: boolean;
    maxRuns?: number;
    metadata?: Record<string, any>;
    timezone?: string;
    module?: string;
}

export interface SchedulerConfig {
    tickIntervalMs: number;
    persistence: {
        enabled?: boolean;
        directory: string;
        saveInterval?: number;
        saveOnShutdown?: boolean;
    };
    execution: {
        maxConcurrent: number;
        defaultTimeout: number;
    };
    cleanup: {
        maxExecutionHistory: number;
        cleanupInterval: number;
    };
    restartBehavior: {
        preserveNaturalTiming: boolean;  // Keep original timing patterns (e.g., hourly at :00)
        skipMissedRuns: boolean;         // Skip runs that should have happened during downtime
        maxTimingDrift: number;          // Max allowed drift in ms before recalculating
        rapidRestartThreshold: number;   // Consider restart "rapid" if within this time (ms)
    };
    cron: {
        defaultTimezone?: string;
        logCronDetails: boolean;
    };
}

export interface SchedulerPluginOptions extends FastifyPluginOptions {
    prefix?: string;
    config?: Partial<SchedulerConfig>;
}

export interface SchedulerDashboardJob extends ScheduledJob {
    isRunning: boolean;
    timeUntilNextRun: number;
    upcomingExecutions: Date[];
    cronDescription?: string;
}

export interface SchedulerManager {
    addJob: (jobDefinition: JobDefinition) => Promise<string>;
    removeJob: (jobName: string) => Promise<void>;
    hasJob: (jobName: string) => boolean;
    listJobs: (module?: string) => string[];
    getJobStats: (jobName: string) => SchedulerService | null;
    getJobsMap: () => Record<string, SchedulerService>;
    getConfig: () => SchedulerConfig;
    enableJob: (jobName: string) => Promise<void>;
    disableJob: (jobName: string) => Promise<void>;
    triggerJob: (jobName: string) => Promise<void>;
    getDashboardSummary: () => { jobs: SchedulerDashboardJob[]; runningExecutions: number };
    getExecutionsSummary: () => { executions: JobExecution[]; running: JobExecution[] };
    getJobExecutionHistory: (jobName: string, limit?: number) => JobExecution[];
}

// Everything every schedule-plugin function needs, bundled once in plugin.ts
// and passed explicitly to every call - no closures, no factories. Mirrors
// queue-plugin's QueueRuntime.
export interface SchedulerRuntime {
    config: SchedulerConfig;
    schedulers: Record<string, SchedulerService>;
    executions: Record<string, JobExecution>;
    executionHistory: JobExecution[];
    isShuttingDown: boolean;
    runningExecutions: number;
    isDirty: boolean;
    lastCleanupTime: number;
    lastSavedAt: number;
    lastRestartTime: Date;
    // Read off `app.logging`, decorated once by router/index.ts (the index
    // bundle). Reaching it this way - never by importing `../logger`
    // directly - is what keeps schedule-plugin's separately-bundled output
    // from inlining its own disconnected copy of the logger singleton.
    logging: LoggingContext;
}

// Type declaration for Fastify instance
declare module 'fastify' {
    interface FastifyInstance {
        scheduler: SchedulerManager;
    }
}
