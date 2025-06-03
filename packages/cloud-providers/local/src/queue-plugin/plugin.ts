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

        // Create specialized functions using higher-order functions
        const processMessage = createProcessMessageHandler(config);

        const saveQueueState = config.persistence.enabled
            ? createQueueStateSaver(config)
            : undefined;

        const saveAllQueueStates = config.persistence.enabled && saveQueueState
            ? createAllQueuesStateSaver(config, saveQueueState)(queues)
            : async () => { };

        const processBatch = createBatchProcessor(
            processMessage,
            config,
            saveQueueState ? (queueName: string) => saveQueueState(queueName, queues[queueName]) : undefined
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
            ? createPersistenceInitializer(config, loadAllQueueStates, saveAllQueueStates)
            : async () => { };
        // Create and register queue manager decorator
        const queueManager = createQueueManager({
            config,
            queues,
            saveQueueState: saveQueueState ? (queueName: string) => saveQueueState(queueName, queues[queueName]) : undefined,
            loadQueueState
        });
        const decorateQueues = createQueueDecorator(queueManager);
        decorateQueues(app);

        // Register all routes
        registerQueueRoutes(
            app,
            options.prefix,
            queues,
            config,
            scheduleProcessing,
            processBatch,
            saveQueueState ? (queueName: string) => saveQueueState(queueName, queues[queueName]) : undefined
        );

        // Initialize persistence if enabled
        await initializePersistence();
    });