import chalk from "chalk";
import logSymbols from "log-symbols";

import { logger } from "@cloudnux/utils";

import { EventHandler, QueueConfig, QueueMessage, QueueService, QueueSummary } from "./types";

// default config
export const DEFAULT_CONFIG: QueueConfig = {
    batchSize: 10,
    batchWindowMs: 500,
    maxRetries: 3,
    parallel: true,
    maxConcurrent: 5,
    retryBackoff: true,
    persistence: {
        enabled: true,
        directory: './.develop/queue-data',
        saveInterval: 60000,
        saveOnShutdown: false,
        loadOnStartup: true
    }
};

// Pure function to merge configs
export const mergeConfig = (defaultConfig: QueueConfig, userConfig?: Partial<QueueConfig>): QueueConfig => ({
    ...defaultConfig,
    ...userConfig,
    persistence: {
        ...defaultConfig.persistence,
        ...(userConfig?.persistence || {})
    }
});

// Pure function to create a new queue service
export const createQueueService = (handler: EventHandler): QueueService => ({
    handler,
    incoming: [],
    processing: [],
    dlq: [],
    timeoutId: null,
    processingBatch: false,
    activeProcessing: 0
});

// Pure function to create a queue message
export const createQueueMessage = (body: any, headers: Record<string, any>): QueueMessage => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    return {
        id,
        timestamp: new Date(),
        attempts: 0,
        payload: body,
        attributes: headers,
    };
};

// Pure function to move messages from incoming to processing
export const moveToProcessing = (queueService: QueueService, batchSize: number): QueueMessage[] => {
    return queueService.incoming.splice(0, batchSize);
};

// Pure function to remove message from processing queue
export const removeFromProcessing = (queueService: QueueService, messageId: string): void => {
    queueService.processing = queueService.processing.filter(msg => msg.id !== messageId);
};

// Pure function to move message to DLQ
export const moveToDLQ = (queueService: QueueService, message: QueueMessage, error: string): void => {
    queueService.dlq.push({
        ...message,
        error,
        failedAt: new Date()
    });
    removeFromProcessing(queueService, message.id);
};

// Pure function to increment message attempts
export const incrementAttempts = (queueService: QueueService, messageId: string): QueueMessage | null => {
    const index = queueService.processing.findIndex(m => m.id === messageId);
    if (index >= 0) {
        queueService.processing[index].attempts += 1;
        return queueService.processing[index];
    }
    return null;
};

// Pure function to calculate backoff delay
export const calculateBackoffDelay = (attempts: number): number => {
    return Math.pow(2, attempts) * 100;
};

// Pure function to set next attempt time
export const setNextAttemptTime = (message: QueueMessage, delayMs: number): QueueMessage => ({
    ...message,
    nextAttempt: new Date(Date.now() + delayMs)
});

// Pure function to create queue summary
export const createQueueSummary = (queueService: QueueService, config: QueueConfig): QueueSummary => ({
    incoming: queueService.incoming.length,
    processing: queueService.processing.length,
    dlq: queueService.dlq.length,
    isProcessing: queueService.processingBatch,
    activeProcessing: queueService.activeProcessing,
    configuration: {
        batchSize: config.batchSize,
        batchWindowMs: config.batchWindowMs,
        parallel: config.parallel,
        maxConcurrent: config.maxConcurrent
    }
});

// Pure function to create dashboard summary
export const createDashboardSummary = (queues: Record<string, QueueService>, config: QueueConfig): Record<string, QueueSummary> => {
    return Object.entries(queues).reduce((summary, [queueName, queue]) => {
        summary[queueName] = createQueueSummary(queue, config);
        return summary;
    }, {} as Record<string, QueueSummary>);
};

// Pure function to move DLQ messages back to incoming
export const moveDLQToIncoming = (queueService: QueueService): number => {
    const dlqCount = queueService.dlq.length;

    if (dlqCount === 0) return 0;

    const movedMessages = queueService.dlq.map(message => ({
        ...message,
        attempts: 0,
        error: undefined,
        failedAt: undefined,
        reprocessed: true,
        originalId: message.id,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 7)
    }));

    queueService.incoming.push(...movedMessages);
    queueService.dlq = [];

    return dlqCount;
};

// Pure function to purge DLQ
export const purgeDLQ = (queueService: QueueService): number => {
    const dlqCount = queueService.dlq.length;
    queueService.dlq = [];
    return dlqCount;
};

// Logging functions (side effects isolated)
export const logSuccess = (message: string, messageId: string, queueName: string): void => {
    logger.debug(`${logSymbols.success} ${chalk.green(message)} ${chalk.yellow(messageId)} in queue ${chalk.magenta(queueName)}`);
};

export const logError = (message: string, messageId: string, queueName: string, error: string): void => {
    logger.error(`${logSymbols.error} ${chalk.red(message)} ${chalk.yellow(messageId)} in queue ${chalk.magenta(queueName)}: ${error}`);
};

export const logRetryScheduled = (messageId: string, delayMs: number): void => {
    logger.info(`${chalk.blue('⏱️ Scheduling retry')} for message ${chalk.yellow(messageId)} in ${chalk.cyan(delayMs)}ms`);
};

export const logDLQOperation = (operation: string, count: number, queueName: string): void => {
    logger.warn(`${logSymbols.warning} ${chalk.yellow(operation)} ${chalk.red(count)} messages from DLQ for ${chalk.green(queueName)}`);
};