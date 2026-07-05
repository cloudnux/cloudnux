import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

// Function to register all routes
export const registerSchedulerRoutes = (
    app: FastifyInstance,
    prefix: string = "schedule"
): void => {
    app.get(`/${prefix}/dashboard`,
        async (_: FastifyRequest, reply: FastifyReply) => {
            return reply.status(200).send(app.scheduler.getDashboardSummary());
        });

    app.get(`/${prefix}/executions`,
        async (_: FastifyRequest, reply: FastifyReply) => {
            return reply.status(200).send(app.scheduler.getExecutionsSummary());
        });

    app.post<{ Params: { jobName: string } }>(`/${prefix}/jobs/:jobName/trigger`,
        async (request: FastifyRequest<{ Params: { jobName: string } }>, reply: FastifyReply) => {
            try {
                await app.scheduler.triggerJob(request.params.jobName);
                return reply.status(200).send({ message: "Job triggered successfully" });
            } catch (error: any) {
                return reply.status(404).send({ error: error.message });
            }
        });

    app.put<{ Params: { jobName: string } }>(`/${prefix}/jobs/:jobName/enable`,
        async (request: FastifyRequest<{ Params: { jobName: string } }>, reply: FastifyReply) => {
            try {
                await app.scheduler.enableJob(request.params.jobName);
                return reply.status(200).send({ message: "Job enabled successfully" });
            } catch (error: any) {
                return reply.status(404).send({ error: error.message });
            }
        });

    app.put<{ Params: { jobName: string } }>(`/${prefix}/jobs/:jobName/disable`,
        async (request: FastifyRequest<{ Params: { jobName: string } }>, reply: FastifyReply) => {
            try {
                await app.scheduler.disableJob(request.params.jobName);
                return reply.status(200).send({ message: "Job disabled successfully" });
            } catch (error: any) {
                return reply.status(404).send({ error: error.message });
            }
        });
};
