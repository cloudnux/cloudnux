import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Function to register all routes
export const registerQueueRoutes = (
    app: FastifyInstance,
    prefix: string = ""
): void => {
    app.get(`/${prefix}/dashboard`,
        async (_: FastifyRequest, reply: FastifyReply) => {
            const summary = app.queues.getDashboardSummary();
            return reply.status(200).send(summary);
        });

    app.get<{ Params: { queue: string } }>(`/${prefix}/:queue`,
        async (request: FastifyRequest<{ Params: { queue: string } }>, reply: FastifyReply) => {
            const queueName = request.params.queue;
            const summary = app.queues.getQueueSummary(queueName);
            if (summary === null) {
                return reply.status(404).send({ error: "Queue not found" });
            }
            return reply.status(200).send(summary);
        });

    app.post<{ Params: { queue: string }; Body: any }>(`/${prefix}/:queue`,
        async (request: FastifyRequest<{ Params: { queue: string }; Body: any }>, reply: FastifyReply) => {
            const queueName = request.params.queue;
            const result = await app.queues.enqueueMessage(queueName, request.body, request.headers as Record<string, any>);
            if (result === null) {
                return reply.status(404).send({ error: "Queue not found" });
            }
            return reply.status(200).send(result);
        });

    // Topic publish: fans the message out to every queue subscribed to the
    // topic (see queue-plugin/decorator.ts:publishTopic). Registered as its
    // own static path segment, so it never collides with POST /:queue.
    app.post<{ Params: { topic: string }; Body: any }>(`/${prefix}/topics/:topic`,
        async (request: FastifyRequest<{ Params: { topic: string }; Body: any }>, reply: FastifyReply) => {
            const topicName = request.params.topic;
            const results = await app.queues.publishTopic(topicName, request.body, request.headers as Record<string, any>);
            if (results === null) {
                return reply.status(404).send({ error: "Topic not found" });
            }
            return reply.status(200).send({ topicName, results });
        });

    app.get<{ Params: { queue: string } }>(`/${prefix}/:queue/process-dlq`,
        async (request: FastifyRequest<{ Params: { queue: string } }>, reply: FastifyReply) => {
            const queueName = request.params.queue;
            const result = await app.queues.processDlq(queueName);
            if (result === null) {
                return reply.status(404).send(result);
            }
            return reply.status(200).send(result);
        });

    app.post<{ Params: { queue: string } }>(`/${prefix}/:queue/purge-dlq`,
        async (request: FastifyRequest<{ Params: { queue: string } }>, reply: FastifyReply) => {
            const queueName = request.params.queue;
            const result = await app.queues.purgeDlq(queueName);
            if (result === null) {
                return reply.status(404).send({ error: "Queue not found" });
            }
            return reply.status(200).send(result);
        });
};