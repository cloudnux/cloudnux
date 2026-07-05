import { FastifyPluginOptions } from "fastify";
import { EventBatchItemResult } from "@cloudnux/core-cloud-provider";

import type { LoggingContext } from "../logger/types";

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

export type EventHandler = (message: QueueMessage) => Promise<EventBatchItemResult>;

export interface QueueService {
    handler: EventHandler;
    incoming: QueueMessage[];
    processing: QueueMessage[];
    dlq: QueueMessage[];
    processingBatch: boolean;
    module?: string;
}

export interface QueueConfig {
    batchSize: number;
    batchWindowMs: number;
    maxRetries: number;
    parallel: boolean;
    maxConcurrent: number;
    retryBackoff: boolean;
    tickIntervalMs: number;
    persistence: {
        enabled?: boolean;
        directory: string;
        saveInterval?: number;
        saveOnShutdown?: boolean;
    };
}

export interface QueueSummary {
    incoming: number;
    processing: number;
    dlq: number;
    isProcessing: boolean;
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

export interface QueueMessageHistoryEntry {
    id: string;
    queueName: string;
    status: 'completed' | 'failed';
    timestamp: Date;
    completedAt: Date;
    attempts: number;
    payload: any;
    attributes: Record<string, any>;
    error?: string;
}

export interface QueuePluginOptions extends FastifyPluginOptions {
    prefix?: string;
    config?: Partial<QueueConfig>;
}

export interface QueueManager {
    addQueue: (queueName: string, handler: EventHandler, module?: string) => Promise<void>;
    removeQueue: (queueName: string) => Promise<void>;
    hasQueue: (queueName: string) => boolean;
    listQueues: (module?: string) => string[];
    getQueueStats: (queueName: string) => QueueService | null;
    getQueuesMap: () => Record<string, QueueService>;
    getConfig: () => QueueConfig;
    getDashboardSummary: () => Record<string, QueueSummary>;
    getQueueSummary: (queueName: string) => {
        stats: QueueSummary;
        messages: {
            incoming: QueueMessage[];
            processing: QueueMessage[];
            dlq: QueueMessage[];
        }
    } | null;
    enqueueMessage: (queueName: string, body: any, attributes: any) => Promise<{
        id: string;
        queueName: string;
    } | null>;
    processDlq: (queueName: string) => Promise<{
        status: string;
        message: string;
        processed: number;
    } | null>;
    purgeDlq: (queueName: string) => Promise<{
        status: string;
        message: string;
        purged: number;
    } | null>;
    getMessageHistory: (queueName: string, limit?: number) => QueueMessageHistoryEntry[];
}

// Everything every queue-plugin function needs, bundled once in plugin.ts and
// passed explicitly to every call - no closures, no factories.
export interface QueueRuntime {
    config: QueueConfig;
    queues: Record<string, QueueService>;
    dirtyQueues: Set<string>;
    lastSavedAt: number;
    messageHistory: QueueMessageHistoryEntry[];
    // Read off `app.logging`, decorated once by router/index.ts (the index
    // bundle). Reaching it this way - never by importing `../logger`
    // directly - is what keeps queue-plugin's separately-bundled output
    // from inlining its own disconnected copy of the logger singleton.
    logging: LoggingContext;
}


// Type declaration for Fastify instance
declare module 'fastify' {
    interface FastifyInstance {
        queues: QueueManager;
    }
}