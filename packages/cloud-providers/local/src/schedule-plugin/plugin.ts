import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";

import { SchedulerPluginOptions, SchedulerRuntime } from "./types";
import { DEFAULT_CONFIG, mergeConfig } from "./core";
import { tick } from "./processing";
import { initializePersistence } from "./persistence";
import { requireAbsoluteDir } from "../utils/dirs";
import { createSchedulerManager } from "./decorator";
import { registerSchedulerRoutes } from "./routes";

export const schedulerPlugin: FastifyPluginAsync<SchedulerPluginOptions> =
    fsPlugin(async (
        app: FastifyInstance,
        options: SchedulerPluginOptions
    ) => {
        const config = mergeConfig(DEFAULT_CONFIG, options.config);
        if (config.persistence.enabled) {
            requireAbsoluteDir(config.persistence.directory, "schedules persistence.directory");
        }

        const runtime: SchedulerRuntime = {
            config,
            schedulers: {},
            executions: {},
            executionHistory: [],
            isShuttingDown: false,
            runningExecutions: 0,
            isDirty: false,
            lastCleanupTime: Date.now(),
            lastSavedAt: Date.now(),
            lastRestartTime: new Date(),
            logging: app.logging,
        };

        // One timer for the entire plugin: every tickIntervalMs, run any job
        // that's due, then clean up old execution history / save persistence
        // once their own intervals have elapsed. See processing.ts:tick.
        const tickIntervalId = setInterval(() => tick(runtime), runtime.config.tickIntervalMs);
        app.addHook('onClose', async () => {
            runtime.isShuttingDown = true;
            clearInterval(tickIntervalId);
        });

        app.decorate('scheduler', createSchedulerManager(runtime));
        registerSchedulerRoutes(app, options.prefix);

        if (runtime.config.persistence.enabled) {
            await initializePersistence(runtime);
        }
    });
