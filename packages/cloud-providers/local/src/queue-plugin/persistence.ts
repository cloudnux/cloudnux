import * as fs from "fs/promises";
import * as path from "path";

import { QueueService, QueueRuntime, QueueMessage } from "./types";

const createQueueData = (queueService: QueueService) => ({
    incoming: queueService.incoming,
    processing: queueService.processing,
    dlq: queueService.dlq,
    savedAt: new Date()
});

const restoreDates = (messages: QueueMessage[]): void => {
    messages.forEach((msg: QueueMessage) => {
        msg.timestamp = new Date(msg.timestamp);
        if (msg.nextAttempt) msg.nextAttempt = new Date(msg.nextAttempt);
        if (msg.failedAt) msg.failedAt = new Date(msg.failedAt);
    });
};

export const saveQueueState = async (runtime: QueueRuntime, queueName: string, queueService: QueueService): Promise<void> => {
    try {
        const queueData = createQueueData(queueService);
        const now = Date.now();
        const queueFilePath = path.join(runtime.config.persistence.directory, `${queueName}.json`);
        const tempFilePath = path.join(runtime.config.persistence.directory, `${queueName}.${now}temp.json`);

        // Write to a temp file first, then rename - rename is atomic, so a
        // reader never sees a half-written file.
        await fs.writeFile(tempFilePath, JSON.stringify(queueData, null, 2), 'utf8');
        await fs.rename(tempFilePath, queueFilePath);

        runtime.logging.debug({ module: queueService.module }, `Queue state saved: ${queueName}`);
    } catch (error: any) {
        runtime.logging.error(
            { module: queueService.module, error: error?.message },
            `Failed to save queue state for ${queueName}`
        );
    }
};

export const saveAllQueueStates = async (runtime: QueueRuntime): Promise<void> => {
    try {
        for (const [queueName, queueService] of Object.entries(runtime.queues)) {
            await saveQueueState(runtime, queueName, queueService);
        }
        runtime.logging.debug(`All queue states saved to ${runtime.config.persistence.directory}`);
    } catch (error: any) {
        runtime.logging.error({ error: error?.message }, `Failed to save all queue states`);
    }
};

// Only saves queues that changed since the last save (tracked via
// runtime.dirtyQueues). Called from processing.ts's tick once
// persistence.saveInterval has elapsed.
export const saveDirtyQueueStates = async (runtime: QueueRuntime): Promise<void> => {
    if (runtime.dirtyQueues.size === 0) return;

    try {
        const queueNames = [...runtime.dirtyQueues];
        runtime.dirtyQueues.clear();

        for (const queueName of queueNames) {
            if (runtime.queues[queueName]) {
                await saveQueueState(runtime, queueName, runtime.queues[queueName]);
            }
        }
    } catch (error: any) {
        runtime.logging.error({ error: error?.message }, `Failed to save dirty queue states`);
    }
};

// Called from addQueue, right after a queue is registered, to restore
// whatever was on disk for it from a previous run.
export const loadQueueState = async (runtime: QueueRuntime, queueName: string): Promise<void> => {
    try {
        const queueService = runtime.queues[queueName];
        if (!queueService) {
            runtime.logging.warn(`Skipping load for non-existent queue: ${queueName}`);
            return;
        }

        const queueFilePath = path.join(runtime.config.persistence.directory, `${queueName}.json`);

        try {
            const data = await fs.readFile(queueFilePath, 'utf8');
            const queueData = JSON.parse(data);

            restoreDates(queueData.incoming);
            restoreDates(queueData.processing);
            restoreDates(queueData.dlq);

            queueService.incoming = queueData.incoming;
            queueService.dlq = queueData.dlq;
            queueService.processing = [];

            // Nothing is actually in flight right after a restart - anything
            // that was mid-handling goes back into the ready pool like any
            // other message (the tick's next batch picks it up), or straight
            // to the DLQ if it had already used up its retries before the
            // shutdown.
            for (const message of queueData.processing as QueueMessage[]) {
                if (message.attempts >= runtime.config.maxRetries) {
                    queueService.dlq.push({ ...message, error: 'max retries exceeded before restart', failedAt: new Date() });
                } else {
                    message.nextAttempt = new Date();
                    queueService.incoming.push(message);
                }
            }

            runtime.logging.debug(
                { module: queueService.module },
                `Queue state loaded: ${queueName} (saved at ${queueData.savedAt})`
            );
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                runtime.logging.debug({ module: queueService.module }, `No saved state found for queue: ${queueName}`);
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        runtime.logging.error({ error: error?.message }, `Failed to load queue state for ${queueName}`);
    }
};

export const initializePersistence = async (runtime: QueueRuntime): Promise<void> => {
    try {
        await fs.mkdir(runtime.config.persistence.directory, { recursive: true });

        if (runtime.config.persistence.saveOnShutdown) {
            const shutdownHandler = async () => {
                runtime.logging.debug('Saving queue state before shutdown...');
                await saveAllQueueStates(runtime);
                process.exit(0);
            };

            process.on('SIGINT', shutdownHandler);
            process.on('SIGTERM', shutdownHandler);
        }

        runtime.logging.debug(`Queue persistence initialized: ${runtime.config.persistence.directory}`);
    } catch (error: any) {
        runtime.logging.error({ error: error?.message }, `Failed to initialize queue persistence`);
    }
};