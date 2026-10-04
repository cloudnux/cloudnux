import { QueueService, QueueManager, QueueRuntime, EventHandler } from "./types";
import {
    createQueueService,
    createQueueMessage,
    createDashboardSummary,
    createQueueSummary,
    moveDLQToIncoming,
    purgeDLQ,
} from "./core";
import { loadQueueState, saveQueueState } from "./persistence";

const isValidQueueName = (queueName: string): boolean => {
    return typeof queueName === 'string' && queueName.length > 0 && /^[a-zA-Z0-9_-]+$/.test(queueName);
};

const validateQueueName = (queueName: string): void => {
    if (!queueName || typeof queueName !== 'string') {
        throw new Error('Queue name must be a non-empty string');
    }

    if (!isValidQueueName(queueName)) {
        throw new Error('Queue name must contain only alphanumeric characters, hyphens, and underscores');
    }
};

const validateHandler = (handler: any): void => {
    if (typeof handler !== 'function') {
        throw new Error('Handler must be a function');
    }
};

export const addQueue = async (runtime: QueueRuntime, queueName: string, handler: EventHandler, module?: string): Promise<void> => {
    try {
        validateQueueName(queueName);
        validateHandler(handler);

        if (runtime.queues[queueName]) {
            runtime.logging.warn({ module }, `Queue already exists: ${queueName}.`);
            return;
        }

        runtime.queues[queueName] = createQueueService(handler, module);

        if (runtime.config.persistence.enabled) {
            await loadQueueState(runtime, queueName);
        }

        runtime.logging.info({ module }, `Queue added: ${queueName}`);
    } catch (error: any) {
        runtime.logging.error({ module, error: error.message }, `Failed to add queue ${queueName}`);
        throw error;
    }
};

export const removeQueue = async (runtime: QueueRuntime, queueName: string): Promise<void> => {
    try {
        validateQueueName(queueName);

        const queueService = runtime.queues[queueName];
        if (!queueService) {
            throw new Error(`Queue '${queueName}' does not exist`);
        }

        const totalMessages = queueService.incoming.length + queueService.processing.length;
        if (totalMessages > 0) {
            runtime.logging.warn(
                { module: queueService.module },
                `Removing queue with ${totalMessages} pending messages: ${queueName}`
            );
        }

        if (runtime.config.persistence.enabled) {
            await saveQueueState(runtime, queueName, queueService);
        }

        delete runtime.queues[queueName];

        runtime.logging.info({ module: queueService.module }, `Queue removed: ${queueName}`);
    } catch (error: any) {
        runtime.logging.error({ error: error.message }, `Failed to remove queue ${queueName}`);
        throw error;
    }
};

export const hasQueue = (runtime: QueueRuntime, queueName: string): boolean => {
    try {
        validateQueueName(queueName);
        return queueName in runtime.queues;
    } catch {
        return false;
    }
};

export const listQueues = (runtime: QueueRuntime, module?: string): string[] => {
    return Object.keys(runtime.queues)
        .filter(queueName => !module || runtime.queues[queueName].module === module)
        .sort();
};

export const getQueueStats = (runtime: QueueRuntime, queueName: string): QueueService | null => {
    try {
        validateQueueName(queueName);
        return runtime.queues[queueName] || null;
    } catch {
        return null;
    }
};

export const getQueuesMap = (runtime: QueueRuntime): Record<string, QueueService> => {
    // Return a copy to prevent external modification
    return { ...runtime.queues };
};

export const getDashboardSummary = (runtime: QueueRuntime) =>
    createDashboardSummary(runtime.queues, runtime.config);

export const getQueueSummary = (runtime: QueueRuntime, queueName: string) => {
    const queue = runtime.queues[queueName];
    if (!queue) {
        return null;
    }

    return {
        stats: createQueueSummary(queue, runtime.config),
        messages: {
            incoming: queue.incoming,
            processing: queue.processing,
            dlq: queue.dlq
        }
    };
};

export const enqueueMessage = async (runtime: QueueRuntime, queueName: string, body: any, attributes: any) => {
    const queueService = runtime.queues[queueName];
    if (!queueService) {
        return null;
    }

    const message = createQueueMessage(body, attributes);
    queueService.incoming.push(message);

    if (runtime.config.persistence.enabled) {
        runtime.dirtyQueues.add(queueName);
    }

    return { id: message.id, queueName };
};

export const processDlq = async (runtime: QueueRuntime, queueName: string) => {
    const queueService = runtime.queues[queueName];
    if (!queueService) {
        return null;
    }

    const processedCount = moveDLQToIncoming(queueService);
    if (processedCount === 0) {
        return { status: "success", message: "No messages in DLQ to process", processed: 0 };
    }

    runtime.logging.warn(
        { module: queueService.module },
        `Moving ${processedCount} messages from DLQ for ${queueName}`
    );

    if (runtime.config.persistence.enabled) {
        runtime.dirtyQueues.add(queueName);
    }

    return {
        status: "success",
        message: `Moved ${processedCount} messages from DLQ to processing queue`,
        processed: processedCount
    };
};

export const purgeDlq = async (runtime: QueueRuntime, queueName: string) => {
    const queueService = runtime.queues[queueName];
    if (!queueService) {
        return null;
    }

    const purgedCount = purgeDLQ(queueService);
    if (purgedCount === 0) {
        return { status: "success", message: "No messages in DLQ to purge", purged: 0 };
    }

    runtime.logging.warn(
        { module: queueService.module },
        `Purging ${purgedCount} messages from DLQ for ${queueName}`
    );

    if (runtime.config.persistence.enabled) {
        runtime.dirtyQueues.add(queueName);
    }

    return {
        status: "success",
        message: `Purged ${purgedCount} messages from DLQ`,
        purged: purgedCount
    };
};

export const getMessageHistory = (runtime: QueueRuntime, queueName: string, limit = 50) => {
    return runtime.messageHistory
        .filter(entry => entry.queueName === queueName)
        .slice(-limit)
        .reverse();
};

export const subscribeTopic = (runtime: QueueRuntime, topicName: string, queueName: string): void => {
    const subscribers = runtime.topics[topicName] ?? (runtime.topics[topicName] = []);
    if (!subscribers.includes(queueName)) {
        subscribers.push(queueName);
    }

    runtime.logging.info({ topicName, queueName }, `Subscribed queue '${queueName}' to topic '${topicName}'`);
};

// Fans a published message out to every queue subscribed to the topic, reusing
// enqueueMessage so each subscriber gets its own independent backlog/DLQ/retries.
export const publishTopic = async (runtime: QueueRuntime, topicName: string, body: any, attributes: any) => {
    const subscribers = runtime.topics[topicName];
    if (!subscribers || subscribers.length === 0) {
        return null;
    }

    const results = await Promise.all(
        subscribers.map(queueName => enqueueMessage(runtime, queueName, body, attributes))
    );

    return results.filter((result): result is { id: string; queueName: string } => result !== null);
};

export const listTopics = (runtime: QueueRuntime): Record<string, string[]> => {
    // Return a copy to prevent external modification
    return Object.fromEntries(Object.entries(runtime.topics).map(([name, queues]) => [name, [...queues]]));
};

// The one place runtime gets bound into the public app.queues shape -
// Fastify needs a plain object of methods with no runtime param, so this
// wraps each plain function above with `runtime` pre-applied. Everything
// above this line is a normal function you can call directly with an
// explicit runtime, e.g. in tests.
export const createQueueManager = (runtime: QueueRuntime): QueueManager => ({
    addQueue: (queueName, handler, module) => addQueue(runtime, queueName, handler, module),
    removeQueue: (queueName) => removeQueue(runtime, queueName),
    hasQueue: (queueName) => hasQueue(runtime, queueName),
    listQueues: (module) => listQueues(runtime, module),
    getQueueStats: (queueName) => getQueueStats(runtime, queueName),
    getQueuesMap: () => getQueuesMap(runtime),
    getConfig: () => runtime.config,
    getDashboardSummary: () => getDashboardSummary(runtime),
    getQueueSummary: (queueName) => getQueueSummary(runtime, queueName),
    enqueueMessage: (queueName, body, attributes) => enqueueMessage(runtime, queueName, body, attributes),
    processDlq: (queueName) => processDlq(runtime, queueName),
    purgeDlq: (queueName) => purgeDlq(runtime, queueName),
    getMessageHistory: (queueName, limit) => getMessageHistory(runtime, queueName, limit),
    subscribeTopic: (topicName, queueName) => subscribeTopic(runtime, topicName, queueName),
    publishTopic: (topicName, body, attributes) => publishTopic(runtime, topicName, body, attributes),
    listTopics: () => listTopics(runtime),
});