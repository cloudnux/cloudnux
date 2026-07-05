import { EventHandler, QueueConfig, QueueMessage, QueueMessageHistoryEntry, QueueService, QueueSummary } from "./types";

const MAX_MESSAGE_HISTORY = 500;

// default config
export const DEFAULT_CONFIG: QueueConfig = {
    batchSize: 10,
    batchWindowMs: 500,
    maxRetries: 3,
    parallel: true,
    maxConcurrent: 5,
    retryBackoff: true,
    tickIntervalMs: 50,
    persistence: {
        enabled: true,
        directory: './.develop/queue-data',
        saveInterval: 60000,
        saveOnShutdown: false
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
export const createQueueService = (handler: EventHandler, module?: string): QueueService => ({
    handler,
    incoming: [],
    processing: [],
    dlq: [],
    processingBatch: false,
    module
});

// Pure function to create a queue message
export const createQueueMessage = (body: any, headers: Record<string, any>): QueueMessage => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    const message: QueueMessage = {
        id,
        timestamp: new Date(),
        attempts: 0,
        payload: body,
        attributes: headers,
    };

    const delaySeconds = Number(headers?.['x-delay-seconds']);
    if (delaySeconds > 0) {
        message.nextAttempt = new Date(Date.now() + delaySeconds * 1000);
    }

    return message;
};

// Pure function to schedule a retry for a message
// Puts a failed message back into `incoming` to wait out its backoff delay,
// same as any delayed message - so the next batch dispatch picks it up
// mixed in with whatever else is ready, instead of retrying it alone.
export const scheduleRetry = (queueService: QueueService, message: QueueMessage, delayMs: number): void => {
    removeFromProcessing(queueService, message.id);
    message.attempts += 1;
    message.nextAttempt = new Date(Date.now() + delayMs);
    queueService.incoming.push(message);
};


// Pure function to check whether a message is ready to be processed
export const isMessageReady = (message: QueueMessage, now: number = Date.now()): boolean => {
    return !message.nextAttempt || message.nextAttempt.getTime() <= now;
};

// Pure function to move ready messages from incoming to processing, leaving delayed messages in place
export const moveToProcessing = (queueService: QueueService, batchSize: number): QueueMessage[] => {
    const now = Date.now();
    const ready: QueueMessage[] = [];
    const remaining: QueueMessage[] = [];

    for (const message of queueService.incoming) {
        if (ready.length < batchSize && isMessageReady(message, now)) {
            ready.push(message);
        } else {
            remaining.push(message);
        }
    }

    queueService.incoming = remaining;
    return ready;
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

// Pure function to calculate backoff delay
export const calculateBackoffDelay = (attempts: number): number => {
    return Math.pow(2, attempts) * 100;
};

// Pure function to create queue summary
export const createQueueSummary = (queueService: QueueService, config: QueueConfig): QueueSummary => ({
    incoming: queueService.incoming.length,
    processing: queueService.processing.length,
    dlq: queueService.dlq.length,
    isProcessing: queueService.processingBatch,
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

// Pure function to build a message-history record for a completed or
// terminally-failed message. This is what powers the dev console's
// per-queue history view for messages that already left incoming/processing/dlq.
export const createHistoryEntry = (
    queueName: string,
    message: QueueMessage,
    status: 'completed' | 'failed',
    error?: string
): QueueMessageHistoryEntry => ({
    id: message.id,
    queueName,
    status,
    timestamp: message.timestamp,
    completedAt: new Date(),
    attempts: message.attempts,
    payload: message.payload,
    attributes: message.attributes,
    error,
});

// Appends to the bounded history log in place, mirroring schedule-plugin's
// executionHistory cap so long-running processes don't grow this unbounded.
export const recordMessageHistory = (
    history: QueueMessageHistoryEntry[],
    entry: QueueMessageHistoryEntry
): void => {
    history.push(entry);
    if (history.length > MAX_MESSAGE_HISTORY) {
        history.splice(0, history.length - MAX_MESSAGE_HISTORY);
    }
};