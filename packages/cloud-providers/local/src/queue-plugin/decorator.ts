import { FastifyInstance } from "fastify";
import chalk from "chalk";
import logSymbols from "log-symbols";

import { logger } from "@cloudnux/utils";

import { QueueService, QueueManager, QueueDecoratorOptions, EventHandler } from "./types";
import { createQueueService } from "./core";

const isValidQueueName = (queueName: string): boolean => {
    return typeof queueName === 'string' && queueName.length > 0 && /^[a-zA-Z0-9_-]+$/.test(queueName);
};

// Higher-order function to create the queue manager
export const createQueueManager = ({
    config,
    queues,
    saveQueueState,
    loadQueueState
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

    const addQueue = async (queueName: string, handler: EventHandler): Promise<void> => {
        try {
            validateQueueName(queueName);
            validateHandler(handler);

            //TODO: add queue filtering logic
            if (queues[queueName]) {
                logger.warn(`${logSymbols.warning} ${chalk.yellow('Queue already exists:')} ${chalk.magenta(queueName)}.`);
                return;
            }

            // Create new queue service
            queues[queueName] = createQueueService(handler);

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

    const listQueues = (): string[] => {
        return Object.keys(queues).sort();
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

    return {
        addQueue,
        removeQueue,
        hasQueue,
        listQueues,
        getQueueStats,
        getQueuesMap
    };
};

// Higher-order function to create decorator registration function
export const createQueueDecorator = (queueManager: QueueManager) =>
    (app: FastifyInstance): void => {
        app.decorate('queues', queueManager);
    };