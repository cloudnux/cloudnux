import { FastifyInstance } from "fastify";
import chalk from "chalk";
import logSymbols from "log-symbols";

import { logger } from "@cloudnux/utils";

import { QueueService, QueueManager, QueueDecoratorOptions, EventHandler } from "./types";
import {
    createQueueService,
    createQueueMessage,
    createDashboardSummary,
    createQueueSummary,
    moveDLQToIncoming,
    purgeDLQ,
    logDLQOperation
} from "./core";

import { handleImmediateProcessing } from "./processing";

const isValidQueueName = (queueName: string): boolean => {
    return typeof queueName === 'string' && queueName.length > 0 && /^[a-zA-Z0-9_-]+$/.test(queueName);
};

// Higher-order function to create the queue manager
export const createQueueManager = ({
    config,
    queues,
    saveQueueState,
    loadQueueState,
    scheduleProcessing,
    processBatch
}: QueueDecoratorOptions): QueueManager => {

    // Pure function to validate queue name
    const validateQueueName = (queueName: string): void => {
        if (!queueName || typeof queueName !== 'string') {
            throw new Error('Queue name must be a non-empty string');
        }

        if (!isValidQueueName(queueName)) {
            throw new Error('Queue name must contain only alphanumeric characters, hyphens, and underscores');
        }
    };

    // Pure function to validate handler
    const validateHandler = (handler: any): void => {
        if (typeof handler !== 'function') {
            throw new Error('Handler must be a function');
        }
    };

    const addQueue = async (queueName: string, handler: EventHandler, module?: string): Promise<void> => {
        try {
            validateQueueName(queueName);
            validateHandler(handler);

            //TODO: add queue filtering logic
            if (queues[queueName]) {
                logger.warn(`${logSymbols.warning} ${chalk.yellow('Queue already exists:')} ${chalk.magenta(queueName)}.`);
                return;
            }

            // Create new queue service
            queues[queueName] = createQueueService(handler, module);

            // Load existing state if persistence is enabled
            if (config.persistence.enabled && loadQueueState) {
                await loadQueueState(queueName);
            }

            logger.info(`${logSymbols.success} ${chalk.green('Queue added:')} ${chalk.magenta(queueName)}`);
        } catch (error: any) {
            logger.error(`${logSymbols.error} ${chalk.red('Failed to add queue')} ${chalk.magenta(queueName)}: ${error.message}`);
            throw error;
        }
    };
    const removeQueue = async (queueName: string): Promise<void> => {
        try {
            validateQueueName(queueName);

            if (!queues[queueName]) {
                throw new Error(`Queue '${queueName}' does not exist`);
            }

            const queueService = queues[queueName];

            // Check if queue has pending messages
            const totalMessages = queueService.incoming.length + queueService.processing.length;
            if (totalMessages > 0) {
                logger.warn(`${logSymbols.warning} ${chalk.yellow('Removing queue with')} ${chalk.red(totalMessages)} ${chalk.yellow('pending messages:')} ${chalk.magenta(queueName)}`);
            }

            // Clear any scheduled processing
            if (queueService.timeoutId) {
                clearTimeout(queueService.timeoutId);
            }

            // Save final state if persistence is enabled
            if (config.persistence.enabled && saveQueueState) {
                await saveQueueState(queueName, queueService);
            }

            // Remove from queues map
            delete queues[queueName];

            logger.info(`${logSymbols.success} ${chalk.green('Queue removed:')} ${chalk.magenta(queueName)}`);
        } catch (error: any) {
            logger.error(`${logSymbols.error} ${chalk.red('Failed to remove queue')} ${chalk.magenta(queueName)}: ${error.message}`);
            throw error;
        }
    };
    const hasQueue = (queueName: string): boolean => {
        try {
            validateQueueName(queueName);
            return queueName in queues;
        } catch {
            return false;
        }
    };
    const listQueues = (module?: string): string[] => {
        return Object.keys(queues).filter(queueName => {
            const queueService = queues[queueName];
            return !module || queueService.module === module;
        }).sort();
    };
    const getQueueStats = (queueName: string): QueueService | null => {
        try {
            validateQueueName(queueName);
            return queues[queueName] || null;
        } catch {
            return null;
        }
    };
    const getQueuesMap = (): Record<string, QueueService> => {
        // Return a copy to prevent external modification
        return { ...queues };
    };
    const getConfig = () => config;
    //==========================================================
    const getDashboardSummary = () => createDashboardSummary(queues, config);
    const getQueueSummary = (queueName: string) => {
        if (!queues[queueName]) {
            return null;
        }

        const queue = queues[queueName];
        const stats = createQueueSummary(queue, config);

        return {
            stats,
            messages: {
                incoming: queue.incoming,
                processing: queue.processing,
                dlq: queue.dlq
            }
        };
    }
    const enqueueMessage = async (queueName: string, body: any, attributes: any) => {
        if (!queues[queueName]) {
            return null;
        }

        const message = createQueueMessage(body, attributes);
        queues[queueName].incoming.push(message);

        // Schedule processing if not already scheduled
        scheduleProcessing(queueName, queues[queueName]);

        // Handle immediate processing if batch size is reached
        handleImmediateProcessing(queues[queueName], config, processBatch, queueName);

        // Save queue state after adding new message
        if (config.persistence.enabled && saveQueueState) {
            await saveQueueState(queueName, queues[queueName]);
        }

        return {
            id: message.id,
            queueName
        }
    }
    const processDlq = async (queueName: string) => {
        if (!queues[queueName]) {
            return null;
        }

        const processedCount = moveDLQToIncoming(queues[queueName]);

        if (processedCount === 0) {
            return {
                status: "success",
                message: "No messages in DLQ to process",
                processed: 0
            };
        }

        logDLQOperation('Moving', processedCount, queueName);

        // Schedule processing if not already scheduled
        scheduleProcessing(queueName, queues[queueName]);

        // Save queue state after moving messages
        if (saveQueueState) {
            await saveQueueState(queueName, queues[queueName]);
        }

        return {
            status: "success",
            message: `Moved ${processedCount} messages from DLQ to processing queue`,
            processed: processedCount
        }
    }
    const purgeDlq = async (queueName: string) => {
        if (!queues[queueName]) {
            return null;
        }

        const purgedCount = purgeDLQ(queues[queueName]);

        if (purgedCount === 0) {
            return {
                status: "success",
                message: "No messages in DLQ to purge",
                purged: 0
            };
        }

        logDLQOperation('Purging', purgedCount, queueName);

        // Save queue state after purging DLQ
        if (saveQueueState) {
            await saveQueueState(queueName, queues[queueName]);
        }

        return {
            status: "success",
            message: `Purged ${purgedCount} messages from DLQ`,
            purged: purgedCount
        };
    }

    return {
        addQueue,
        removeQueue,
        hasQueue,
        listQueues,
        getQueueStats,
        getQueuesMap,
        getConfig,

        getDashboardSummary,
        getQueueSummary,
        enqueueMessage,
        processDlq,
        purgeDlq
    };
};

// Higher-order function to create decorator registration function
export const createQueueDecorator = (queueManager: QueueManager) =>
    (app: FastifyInstance): void => {
        app.decorate('queues', queueManager);
    };