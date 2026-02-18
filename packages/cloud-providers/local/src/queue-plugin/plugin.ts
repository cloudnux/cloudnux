import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";

import { QueuePluginOptions, QueueService } from "./types";

import {
    DEFAULT_CONFIG,
    mergeConfig
} from "./core";

import {
    createProcessMessageHandler,
    createBatchProcessor,
    createProcessingScheduler
} from "./processing";

import {
    createPersistenceInitializer,
    createQueueStateSaver,
    createAllQueuesStateSaver,
    createDirtyQueuesStateSaver,
    createQueueStateLoader,
    createAllQueuesStateLoader
} from "./persistence";

import { registerQueueRoutes } from "./routes";
import { createQueueManager, createQueueDecorator } from "./decorator";

export const queuesPlugin: FastifyPluginAsync<QueuePluginOptions> =
    fsPlugin(async (
        app: FastifyInstance,
        options: QueuePluginOptions
    ) => {
        // Configuration setup
        const config = mergeConfig(DEFAULT_CONFIG, options.config);

        // Initialize empty queues map
        const queues: Record<string, QueueService> = {};

        // Dirty tracking for debounced persistence
        const dirtyQueues = new Set<string>();
        const intervalIdHolder: { id?: NodeJS.Timeout } = {};

        // Create specialized functions using higher-order functions
        const processMessage = createProcessMessageHandler(config);

        const saveQueueState = config.persistence.enabled
            ? createQueueStateSaver(config)
            : undefined;

        const saveAllQueueStates = config.persistence.enabled && saveQueueState
            ? createAllQueuesStateSaver(config, saveQueueState)(queues)
            : async () => { };

        const saveDirtyQueueStates = config.persistence.enabled && saveQueueState
            ? createDirtyQueuesStateSaver(saveQueueState, dirtyQueues)(queues)
            : async () => { };

        const processBatch = createBatchProcessor(
            processMessage,
            config,
            config.persistence.enabled ? dirtyQueues : undefined
        );

        const scheduleProcessing = createProcessingScheduler(processBatch, config);

        const loadQueueState = config.persistence.enabled
            ? createQueueStateLoader(
                config,
                scheduleProcessing,
                processMessage
            )(queues)
            : async () => { };

        const loadAllQueueStates = config.persistence.enabled
            ? createAllQueuesStateLoader(config, loadQueueState)
            : async () => { };

        const initializePersistence = config.persistence.enabled
            ? createPersistenceInitializer(config, loadAllQueueStates, saveDirtyQueueStates, saveAllQueueStates, intervalIdHolder)
            : async () => { };

        // Create and register queue manager decorator
        const queueManager = createQueueManager({
            config,
            queues,
            dirtyQueues,
            saveQueueState: saveQueueState ? (queueName: string) => saveQueueState(queueName, queues[queueName]) : undefined,
            loadQueueState,
            scheduleProcessing,
            processBatch,
        });
        const decorateQueues = createQueueDecorator(queueManager);
        decorateQueues(app);

        // Register all routes
        registerQueueRoutes(
            app,
            options.prefix
        );

        // Initialize persistence if enabled
        await initializePersistence();
    });
