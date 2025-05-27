import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { QueueConfig, QueueService } from "./types";
import {
    createQueueMessage,
    createDashboardSummary,
    createQueueSummary,
    moveDLQToIncoming,
    purgeDLQ,
    logDLQOperation
} from "./core";
import { handleImmediateProcessing } from "./processing";

// Higher-order function to create dashboard route handler
export const createDashboardHandler = (
    queues: Record<string, QueueService>,
    config: QueueConfig
) => async (_: FastifyRequest, reply: FastifyReply) => {
    const summary = createDashboardSummary(queues, config);
    return reply.status(200).send(summary);
};

// Higher-order function to create queue details route handler
export const createQueueDetailsHandler = (
    queues: Record<string, QueueService>,
    config: QueueConfig
) => async (request: FastifyRequest<{ Params: { queue: string } }>, reply: FastifyReply) => {
    const queueName = request.params.queue;

    if (!queues[queueName]) {
        return reply.status(404).send({ error: "Queue not found" });
    }

    const queue = queues[queueName];
    const stats = createQueueSummary(queue, config);

    return reply.status(200).send({
        stats,
        messages: {
            incoming: queue.incoming,
            processing: queue.processing,
            dlq: queue.dlq
        }
    });
};

// Higher-order function to create message enqueue handler
export const createEnqueueMessageHandler = (
    queues: Record<string, QueueService>,
    config: QueueConfig,
    scheduleProcessing: (queueName: string, queueService: QueueService) => void,
    processBatch: (queueName: string, queueService: QueueService) => Promise<void>,
    saveQueueState?: (queueName: string, queueService: QueueService) => Promise<void>
) => async (request: FastifyRequest<{ Params: { queue: string }; Body: any }>, reply: FastifyReply) => {
    const queueName = request.params.queue;

    if (!queues[queueName]) {
        return reply.status(404).send({ error: "Queue not found" });
    }

    const message = createQueueMessage(request.body, request.headers as Record<string, any>);
    queues[queueName].incoming.push(message);

    // Schedule processing if not already scheduled
    scheduleProcessing(queueName, queues[queueName]);

    // Handle immediate processing if batch size is reached
    handleImmediateProcessing(queues[queueName], config, processBatch, queueName);

    // Save queue state after adding new message
    if (config.persistence.enabled && saveQueueState) {
        await saveQueueState(queueName, queues[queueName]);
    }

    return reply.status(200).send({ id: message.id, queueName });
};

// Higher-order function to create DLQ processing handler
export const createProcessDLQHandler = (
    queues: Record<string, QueueService>,
    scheduleProcessing: (queueName: string, queueService: QueueService) => void,
    saveQueueState?: (queueName: string, queueService: QueueService) => Promise<void>
) => async (request: FastifyRequest<{ Params: { queue: string } }>, reply: FastifyReply) => {
    const queueName = request.params.queue;

    if (!queues[queueName]) {
        return reply.status(404).send({ error: "Queue not found" });
    }

    const processedCount = moveDLQToIncoming(queues[queueName]);

    if (processedCount === 0) {
        return reply.status(200).send({
            status: "success",
            message: "No messages in DLQ to process",
            processed: 0
        });
    }

    logDLQOperation('Moving', processedCount, queueName);

    // Schedule processing if not already scheduled
    scheduleProcessing(queueName, queues[queueName]);

    // Save queue state after moving messages
    if (saveQueueState) {
        await saveQueueState(queueName, queues[queueName]);
    }

    return reply.status(200).send({
        status: "success",
        message: `Moved ${processedCount} messages from DLQ to processing queue`,
        processed: processedCount
    });
};

// Higher-order function to create DLQ purge handler
export const createPurgeDLQHandler = (
    queues: Record<string, QueueService>,
    saveQueueState?: (queueName: string, queueService: QueueService) => Promise<void>
) => async (request: FastifyRequest<{ Params: { queue: string } }>, reply: FastifyReply) => {
    const queueName = request.params.queue;

    if (!queues[queueName]) {
        return reply.status(404).send({ error: "Queue not found" });
    }

    const purgedCount = purgeDLQ(queues[queueName]);

    if (purgedCount === 0) {
        return reply.status(200).send({
            status: "success",
            message: "No messages in DLQ to purge",
            purged: 0
        });
    }

    logDLQOperation('Purging', purgedCount, queueName);

    // Save queue state after purging DLQ
    if (saveQueueState) {
        await saveQueueState(queueName, queues[queueName]);
    }

    return reply.status(200).send({
        status: "success",
        message: `Purged ${purgedCount} messages from DLQ`,
        purged: purgedCount
    });
};

// Function to register all routes
export const registerQueueRoutes = (
    app: FastifyInstance,
    prefix: string = "",
    queues: Record<string, QueueService>,
    config: QueueConfig,
    scheduleProcessing: (queueName: string, queueService: QueueService) => void,
    processBatch: (queueName: string, queueService: QueueService) => Promise<void>,
    saveQueueState?: (queueName: string, queueService: QueueService) => Promise<void>
): void => {
    app.get(`${prefix}/dashboard`, createDashboardHandler(queues, config));

    app.get<{ Params: { queue: string } }>(`${prefix}/:queue`, createQueueDetailsHandler(queues, config));

    app.post<{ Params: { queue: string }; Body: any }>(
        `${prefix}/:queue`,
        createEnqueueMessageHandler(queues, config, scheduleProcessing, processBatch, saveQueueState)
    );

    app.get<{ Params: { queue: string } }>(
        `${prefix}/:queue/process-dlq`,
        createProcessDLQHandler(queues, scheduleProcessing, saveQueueState)
    );

    app.get<{ Params: { queue: string } }>(
        `${prefix}/:queue/purge-dlg`,
        createPurgeDLQHandler(queues, saveQueueState)
    );
};