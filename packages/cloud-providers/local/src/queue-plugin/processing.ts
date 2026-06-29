import { QueueMessage, QueueService, QueueRuntime } from "./types";
import {
    isMessageReady,
    moveToProcessing,
    removeFromProcessing,
    moveToDLQ,
    scheduleRetry,
    calculateBackoffDelay,
} from "./core";
import { saveDirtyQueueStates } from "./persistence";

// Sends one message through the user's handler. Success removes it from
// `processing`; failure either schedules a retry or moves it to the DLQ.
// Used for both freshly-batched messages and individually-retried ones.
// Wrapped in runWithLogContext by processBatch, so every log call below
// (and anything the user's handler itself logs) carries this message's
// module/reqId without having to pass them through explicitly.
const processMessage = async (
    runtime: QueueRuntime,
    queueName: string,
    message: QueueMessage,
    queueService: QueueService
): Promise<void> => {
    try {
        const result = await queueService.handler(message);
        if (result?.failureId) {
            handleFailure(runtime, queueName, message, queueService);
        } else {
            removeFromProcessing(queueService, message.id);
            runtime.logging.debug(`Successfully processed message ${message.id} in queue ${queueName}`);
        }
    } catch {
        handleFailure(runtime, queueName, message, queueService);
    }
};

const handleFailure = (
    runtime: QueueRuntime,
    queueName: string,
    message: QueueMessage,
    queueService: QueueService
): void => {
    runtime.logging.error(`Error processing message ${message.id} in queue ${queueName}: handler returned failure`);

    if (message.attempts >= runtime.config.maxRetries) {
        moveToDLQ(queueService, message, 'max retries exceeded');
        return;
    }

    const delayMs = runtime.config.retryBackoff ? calculateBackoffDelay(message.attempts + 1) : 0;
    scheduleRetry(queueService, message, delayMs);
    runtime.logging.debug(`Scheduling retry for message ${message.id} in ${delayMs}ms`);
};

// Pulls up to batchSize ready messages out of `incoming` and runs them
// through processMessage concurrently. Guarded by `processingBatch` so the
// tick never starts a second batch for a queue while one is still running.
const processBatch = async (
    runtime: QueueRuntime,
    queueName: string,
    queueService: QueueService
): Promise<void> => {
    if (queueService.processingBatch) {
        return;
    }

    try {
        queueService.processingBatch = true;

        const messagesToProcess = moveToProcessing(queueService, runtime.config.batchSize);
        if (messagesToProcess.length === 0) {
            return;
        }

        queueService.processing.push(...messagesToProcess);

        await Promise.all(
            messagesToProcess.map(message => runtime.logging.runWithLogContext(
                { module: queueService.module, reqId: message.id },
                () => processMessage(runtime, queueName, message, queueService)
            ))
        );

        if (runtime.config.persistence.enabled) {
            runtime.dirtyQueues.add(queueName);
        }
    } finally {
        queueService.processingBatch = false;
    }
};

const dispatchBatchIfDue = (
    runtime: QueueRuntime,
    queueName: string,
    queueService: QueueService,
    now: number
): void => {
    if (queueService.processingBatch) {
        return;
    }
    const ready = queueService.incoming.filter(message => isMessageReady(message, now));
    if (ready.length === 0) {
        return;
    }

    const dueBySize = ready.length >= runtime.config.batchSize;
    const oldestReadyAge = now - Math.min(...ready.map(message => message.timestamp.getTime()));
    const dueByWindow = oldestReadyAge >= runtime.config.batchWindowMs;

    if (dueBySize || dueByWindow) {
        processBatch(runtime, queueName, queueService);
    }
};

const maybeSavePersistence = (runtime: QueueRuntime, now: number): void => {
    if (!runtime.config.persistence.enabled) {
        return;
    }

    const saveInterval = runtime.config.persistence.saveInterval ?? 0;
    if (saveInterval > 0 && now - runtime.lastSavedAt >= saveInterval) {
        runtime.lastSavedAt = now;
        saveDirtyQueueStates(runtime);
    }
};


// The one timer for the whole plugin. Every tickIntervalMs: for every queue,
// dispatch a batch if one is due (this is also how retried messages get
// picked up - they wait in `incoming` like any delayed message); then save
// persistence if its interval has elapsed.
export const tick = (runtime: QueueRuntime): void => {
    const now = Date.now();
    for (const [queueName, queueService] of Object.entries(runtime.queues)) {
        dispatchBatchIfDue(runtime, queueName, queueService, now);
    }
    maybeSavePersistence(runtime, now);
};