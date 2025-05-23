import { FastifyPluginOptions } from "fastify";

import { EventFunctionContext } from "@cloudnux/core-cloud-provider";

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

export type EventHandler = (context: EventFunctionContext) => Promise<void>;

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
    queueRegistry?: QueueRegistryItem[];
    config?: Partial<QueueConfig>;
    functionContextFactory: (message: QueueMessage) => EventFunctionContext;
    //logEntryURL?: (method: string, path: string) => void;

}
