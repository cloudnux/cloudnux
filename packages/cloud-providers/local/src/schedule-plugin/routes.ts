import { FastifyInstance } from "fastify";

import { SchedulerService, SchedulerState } from "./types";
import { getNextExecutions, parseCronExpression } from "./cron-utils";
import { enableJob, disableJob } from "./jobs";
import { getTimeUntilNextRun } from "./utils";

export const createDashboardData = (state: SchedulerState) => {
    const jobs = Object.values(state.schedulers).map(s => {
        const nextExecutions = s.job.cronExpression ?
            getNextExecutions(s.job.cronExpression, 3, { timezone: s.job.timezone }) : [];

        return {
            ...s.job,
            isRunning: s.isRunning,
            timeUntilNextRun: getTimeUntilNextRun(s.job),
            upcomingExecutions: nextExecutions,
            cronDescription: s.job.cronExpression ?
                parseCronExpression(s.job.cronExpression, undefined, { timezone: s.job.timezone }).description :
                undefined
        };
    });

    return { jobs, runningExecutions: state.runningExecutions };
};

export const createExecutionsData = (state: SchedulerState) => ({
    executions: state.executionHistory.slice(-50), // Last 50 executions
    running: Object.values(state.executions).filter(e => e.status === 'running'),
});

export const registerDashboardRoute = (
    app: FastifyInstance,
    state: SchedulerState
): void => {
    app.get("/dashboard", async function (_, reply) {
        const dashboardData = createDashboardData(state);
        return reply.status(200).send(dashboardData);
    });
};

export const registerExecutionsRoute = (
    app: FastifyInstance,
    state: SchedulerState
): void => {
    app.get("/executions", async function (_, reply) {
        const executionsData = createExecutionsData(state);
        return reply.status(200).send(executionsData);
    });
};

export const registerTriggerJobRoute = (
    app: FastifyInstance,
    state: SchedulerState,
    executeJobFn: (scheduler: any) => Promise<void>
): void => {
    app.post<{ Params: { jobId: string } }>("/jobs/:jobId/trigger", async function (request, reply) {
        const scheduler = state.schedulers[request.params.jobId];

        if (!scheduler) {
            return reply.status(404).send({ error: "Job not found" });
        }

        if (scheduler.isRunning) {
            return reply.status(409).send({ error: "Job is already running" });
        }

        // Trigger immediately
        setImmediate(() => executeJobFn(scheduler));

        return reply.status(200).send({ message: "Job triggered successfully" });
    });
};

export const registerEnableJobRoute = (
    app: FastifyInstance,
    state: SchedulerState,
    scheduleJobFn: (scheduler: any) => void
): void => {
    app.put<{ Params: { jobId: string } }>("/jobs/:jobId/enable", async function (request, reply) {
        const scheduler = state.schedulers[request.params.jobId];

        if (!scheduler) {
            return reply.status(404).send({ error: "Job not found" });
        }

        const enabledScheduler = enableJob(scheduler);
        state.schedulers[request.params.jobId] = enabledScheduler;
        scheduleJobFn(enabledScheduler);

        return reply.status(200).send({ message: "Job enabled successfully" });
    });
};

export const registerDisableJobRoute = (
    app: FastifyInstance,
    state: SchedulerState
): void => {
    app.put<{ Params: { jobId: string } }>("/jobs/:jobId/disable", async function (request, reply) {
        const scheduler = state.schedulers[request.params.jobId];

        if (!scheduler) {
            return reply.status(404).send({ error: "Job not found" });
        }

        const disabledScheduler = disableJob(scheduler);
        state.schedulers[request.params.jobId] = disabledScheduler;

        return reply.status(200).send({ message: "Job disabled successfully" });
    });
};

export const registerAllRoutes = (
    app: FastifyInstance,
    state: SchedulerState,
    executeJobFn: (scheduler: SchedulerService) => Promise<void>,
    scheduleJobFn: (scheduler: SchedulerService) => SchedulerService
): void => {
    registerDashboardRoute(app, state);
    registerExecutionsRoute(app, state);
    registerTriggerJobRoute(app, state, executeJobFn);
    registerEnableJobRoute(app, state, scheduleJobFn);
    registerDisableJobRoute(app, state);
};