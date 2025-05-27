import { QueueConfig, QueueMessage, QueueService } from "./types";
import {
    moveToProcessing,
    removeFromProcessing,
    moveToDLQ,
    incrementAttempts,
    calculateBackoffDelay,
    setNextAttemptTime,
    logSuccess,
    logError,
    logRetryScheduled
} from "./core";

// Higher-order function for creating processing context
export const createProcessMessageHandler = (
    config: QueueConfig
) => async (queueName: string, message: QueueMessage, queueService: QueueService): Promise<void> => {
    try {
        await queueService.handler(message);

        removeFromProcessing(queueService, message.id);
        logSuccess('Successfully processed message', message.id, queueName);
    } catch (error: any) {
        await handleProcessingError(queueName, message, queueService, error, config);
    }
};

// Higher-order function for handling processing errors
const handleProcessingError = async (
    queueName: string,
    message: QueueMessage,
    queueService: QueueService,
    error: Error,
    config: QueueConfig
): Promise<void> => {
    logError('Error processing message', message.id, queueName, error.message);

    if (message.attempts >= config.maxRetries) {
        moveToDLQ(queueService, message, error.message);
        return;
    }

    const updatedMessage = incrementAttempts(queueService, message.id);
    if (!updatedMessage) return;

    if (config.retryBackoff) {
        const delayMs = calculateBackoffDelay(updatedMessage.attempts);
        const messageWithNextAttempt = setNextAttemptTime(updatedMessage, delayMs);

        logRetryScheduled(message.id, delayMs);

        setTimeout(() => {
            createProcessMessageHandler(config)(queueName, messageWithNextAttempt, queueService);
        }, delayMs);
    }
};

// Higher-order function for batch processing
export const createBatchProcessor = (
    processMessage: (queueName: string, message: QueueMessage, queueService: QueueService) => Promise<void>,
    config: QueueConfig,
    saveQueueState?: (queueName: string) => Promise<void>
) => async (queueName: string, queueService: QueueService): Promise<void> => {
    // Clear timeout to prevent double processing
    if (queueService.timeoutId) {
        clearTimeout(queueService.timeoutId);
        queueService.timeoutId = null;
    }

    // If already processing, return early
    if (queueService.processingBatch) {
        return;
    }

    try {
        queueService.processingBatch = true;

        const messagesToProcess = moveToProcessing(queueService, config.batchSize);

        if (messagesToProcess.length === 0) {
            return;
        }

        queueService.processing.push(...messagesToProcess);

        // Process messages sequentially
        // for (const message of messagesToProcess) {
        //     await processMessage(queueName, message, queueService);
        // }
        // Process messages in parallel
        await Promise.all(messagesToProcess.map(message => {
            return processMessage(queueName, message, queueService);
        }));

        // Save queue state after batch processing
        if (config.persistence.enabled && saveQueueState) {
            await saveQueueState(queueName);
        }
    } finally {
        queueService.processingBatch = false;
    }
};

// Higher-order function for scheduling processing
export const createProcessingScheduler = (
    processBatch: (queueName: string, queueService: QueueService) => Promise<void>,
    config: QueueConfig
) => (queueName: string, queueService: QueueService, overrideDelay: number | null = null): void => {
    if (!queueService.timeoutId) {
        const delay = overrideDelay ?? config.batchWindowMs;
        queueService.timeoutId = setTimeout(() => {
            processBatch(queueName, queueService);
        }, delay);
    }
};

// Function to handle immediate processing when batch size is reached
export const handleImmediateProcessing = (
    queueService: QueueService,
    config: QueueConfig,
    processBatch: (queueName: string, queueService: QueueService) => Promise<void>,
    queueName: string
): void => {
    if (queueService.incoming.length >= config.batchSize) {
        if (queueService.timeoutId) {
            clearTimeout(queueService.timeoutId);
            queueService.timeoutId = null;
        }
        setImmediate(() => processBatch(queueName, queueService));
    }
};