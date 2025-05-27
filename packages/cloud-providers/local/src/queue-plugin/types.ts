import { FastifyPluginOptions } from "fastify";

export interface QueueMessage {
    id: string;
    timestamp: Date;
    attempts: number;
    payload: any;
    attributes: Record<string, any>;
    nextAttempt?: Date;
    error?: string;
    failedAt?: Date;
    reprocessed?: boolean;
    originalId?: string;
}

export type EventHandler = (message: QueueMessage) => Promise<void>;

export interface QueueService {
    handler: EventHandler;
    incoming: QueueMessage[];
    processing: QueueMessage[];
    dlq: QueueMessage[];
    timeoutId: NodeJS.Timeout | null;
    processingBatch: boolean;
    activeProcessing: number;
}

export interface QueueConfig {
    batchSize: number;
    batchWindowMs: number;
    maxRetries: number;
    parallel: boolean;
    maxConcurrent: number;
    retryBackoff: boolean;
    persistence: {
        enabled: boolean;
        directory: string;
        saveInterval: number;
        saveOnShutdown: boolean;
        loadOnStartup: boolean;
    };
}

export interface QueueSummary {
    incoming: number;
    processing: number;
    dlq: number;
    isProcessing: boolean;
    activeProcessing: number;
    configuration: {
        batchSize: number;
        batchWindowMs: number;
        parallel: boolean;
        maxConcurrent: number;
    };
}

export interface QueueRegistryItem {
    queueName: string;
    handler: EventHandler;
}

export interface QueuePluginOptions extends FastifyPluginOptions {
    prefix?: string;
    config?: Partial<QueueConfig>;
    //queueRegistry?: QueueRegistryItem[];
    //functionContextFactory: (message: QueueMessage) => EventFunctionContext;
    //logEntryURL?: (method: string, path: string) => void;

}

export interface QueueManager {
    addQueue: (queueName: string, handler: EventHandler) => Promise<void>;
    removeQueue: (queueName: string) => Promise<void>;
    hasQueue: (queueName: string) => boolean;
    listQueues: () => string[];
    getQueueStats: (queueName: string) => QueueService | null;
    getQueuesMap: () => Record<string, QueueService>;
}

export interface QueueDecoratorOptions {
    config: QueueConfig;
    queues: Record<string, QueueService>;
    //scheduleProcessing: (queueName: string, queueService: QueueService) => void;
    saveQueueState?: (queueName: string, queueService: QueueService) => Promise<void>;
    loadQueueState?: (queueName: string) => Promise<void>;
}


// Type declaration for Fastify instance
declare module 'fastify' {
    interface FastifyInstance {
        queues: QueueManager;
    }
}