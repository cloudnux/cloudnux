import { FastifyPluginOptions } from "fastify";

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

export interface SchedulerService {
    job: ScheduledJob;
    handler: JobHandler;
    timerId?: NodeJS.Timeout;
    isRunning: boolean;
}

export type JobHandler = (job: ScheduledJob, execution: JobExecution) => Promise<void>;

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
    persistence: {
        enabled: boolean;
        directory: string;
        saveInterval: number;
    };
    execution: {
        maxConcurrent: number;
        defaultTimeout: number;
        retryOnError: boolean;
        maxRetries: number;
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
    //jobs?: JobDefinition[];
    //functionContextFactory: (job: ScheduledJob, execution: JobExecution) => ScheduleFunctionContext;
}

export interface SchedulerState {
    schedulers: Record<string, SchedulerService>;
    executions: Record<string, JobExecution>;
    executionHistory: JobExecution[];
    isShuttingDown: boolean;
    runningExecutions: number;
    cleanupInterval?: NodeJS.Timeout;
    lastRestartTime: Date;
    config: SchedulerConfig;
}

export interface SchedulerManager {
    addJob: (jobDefinition: JobDefinition) => Promise<string>;
    removeJob: (jobName: string) => Promise<void>;
    hasJob: (jobName: string) => boolean;
    listJobs: (module?: string) => string[];
    getJobStats: (jobName: string) => SchedulerService | null;
    enableJob: (jobName: string) => Promise<void>;
    disableJob: (jobName: string) => Promise<void>;
    triggerJob: (jobName: string) => Promise<void>;
    getJobsMap: () => Record<string, SchedulerService>;
}

export interface SchedulerDecoratorOptions {
    state: SchedulerState;
    scheduleJobFn: (scheduler: SchedulerService) => SchedulerService;
    executeJob: (scheduler: SchedulerService) => Promise<void>;
    config: SchedulerConfig;
}

// Type declaration for Fastify instance
declare module 'fastify' {
    interface FastifyInstance {
        scheduler: SchedulerManager;
    }
}