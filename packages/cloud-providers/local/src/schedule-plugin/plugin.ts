import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";

import { SchedulerPluginOptions } from "./types";
import {
    DEFAULT_CONFIG,
    mergeConfig,
    createInitialState,
    createSchedulerFunctions,
    initializeScheduler
    //setupSchedulerLifecycle
} from "./core";
import { registerAllRoutes } from "./routes";
import { createSchedulerDecorator, createSchedulerManager } from "./decorator";


export const schedulerPlugin: FastifyPluginAsync<SchedulerPluginOptions> =
    fsPlugin(async (
        app: FastifyInstance,
        options: SchedulerPluginOptions
    ) => {
        const config = mergeConfig(DEFAULT_CONFIG, options.config);

        // Initialize scheduler state
        const state = createInitialState(config);

        // Create both functions together to avoid circular dependency
        const { executeJob, scheduleJobFn } = createSchedulerFunctions(state);

        // Initialize the scheduler
        await initializeScheduler(state, scheduleJobFn);

        // Setup lifecycle management
        //setupSchedulerLifecycle(state, app);

        // Create and register scheduler manager decorator
        const schedulerManager = createSchedulerManager({
            state,
            config,
            scheduleJobFn,
            executeJob
        });
        const decorateScheduler = createSchedulerDecorator(schedulerManager);
        decorateScheduler(app);

        // Register API routes
        registerAllRoutes(app, state, executeJob, scheduleJobFn);
    });