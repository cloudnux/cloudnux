import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";

import { QueuePluginOptions, QueueRuntime } from "./types";
import { DEFAULT_CONFIG, mergeConfig } from "./core";
import { tick } from "./processing";
import { initializePersistence } from "./persistence";
import { createQueueManager } from "./decorator";
import { registerQueueRoutes } from "./routes";

export const queuesPlugin: FastifyPluginAsync<QueuePluginOptions> =
    fsPlugin(async (
        app: FastifyInstance,
        options: QueuePluginOptions
    ) => {
        const runtime: QueueRuntime = {
            config: mergeConfig(DEFAULT_CONFIG, options.config),
            queues: {},
            dirtyQueues: new Set<string>(),
            lastSavedAt: Date.now(),
            messageHistory: [],
            logging: app.logging,
        };

        // One timer for the entire plugin: every tickIntervalMs, check every
        // queue for batches/retries that are due, and save persistence if
        // its interval has elapsed. See processing.ts:tick.
        const tickIntervalId = setInterval(() => tick(runtime), runtime.config.tickIntervalMs);
        app.addHook('onClose', async () => clearInterval(tickIntervalId));

        app.decorate('queues', createQueueManager(runtime));
        registerQueueRoutes(app, options.prefix);

        await initializePersistence(runtime);
    });