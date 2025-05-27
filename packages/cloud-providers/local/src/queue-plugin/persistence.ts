import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import logSymbols from "log-symbols";

import { logger } from "@cloudnux/utils";

import { QueueConfig, QueueService } from "./types";

// Pure function to create queue data for persistence
const createQueueData = (queueService: QueueService) => ({
    incoming: queueService.incoming,
    processing: queueService.processing,
    dlq: queueService.dlq,
    savedAt: new Date()
});

// Pure function to restore date objects from JSON
const restoreDates = (messages: any[]): void => {
    messages.forEach((msg: any) => {
        msg.timestamp = new Date(msg.timestamp);
        if (msg.nextAttempt) msg.nextAttempt = new Date(msg.nextAttempt);
        if (msg.failedAt) msg.failedAt = new Date(msg.failedAt);
    });
};

// Higher-order function to create persistence initializer
export const createPersistenceInitializer = (
    config: QueueConfig,
    loadAllQueueStates: () => Promise<void>,
    saveAllQueueStates: () => Promise<void>
) => async (): Promise<void> => {
    try {
        await fs.mkdir(config.persistence.directory, { recursive: true });

        if (config.persistence.loadOnStartup) {
            await loadAllQueueStates();
        }

        if (config.persistence.saveInterval > 0) {
            setInterval(saveAllQueueStates, config.persistence.saveInterval);
        }

        if (config.persistence.saveOnShutdown) {
            const shutdownHandler = async () => {
                logger.debug('Saving queue state before shutdown...');
                await saveAllQueueStates();
                process.exit(0);
            };

            process.on('SIGINT', shutdownHandler);
            process.on('SIGTERM', shutdownHandler);
        }

        logger.debug(`${logSymbols.success} ${chalk.green('Queue persistence initialized:')} ${chalk.yellow(config.persistence.directory)}`);
    } catch (error: any) {
        logger.error(`${logSymbols.error} ${chalk.red('Failed to initialize queue persistence:')} ${chalk.yellow(error.message)}`);
    }
};

// Higher-order function to create queue state saver
export const createQueueStateSaver = (config: QueueConfig) => async (queueName: string, queueService: QueueService): Promise<void> => {
    try {
        if (!queueService) return;

        const queueData = createQueueData(queueService);
        const now = Date.now();
        const queueFilePath = path.join(config.persistence.directory, `${queueName}.json`);
        const tempFilePath = path.join(config.persistence.directory, `${queueName}.${now}temp.json`);

        // Write to temporary file first
        await fs.writeFile(tempFilePath, JSON.stringify(queueData, null, 2), 'utf8');

        // Rename temporary file to the actual file (atomic operation)
        await fs.rename(tempFilePath, queueFilePath);

        logger.info(`${logSymbols.info} ${chalk.blue('Queue state saved:')} ${chalk.green(queueName)}`);
    } catch (error: any) {
        logger.error(`Failed to save queue state for ${queueName}:`, error);
    }
};

// Higher-order function to create all queues state saver
export const createAllQueuesStateSaver = (
    config: QueueConfig,
    saveQueueState: (queueName: string, queueService: QueueService) => Promise<void>
) => (queues: Record<string, QueueService>) => async (): Promise<void> => {
    try {
        for (const [queueName, queueService] of Object.entries(queues)) {
            await saveQueueState(queueName, queueService);
        }
        logger.debug(`${logSymbols.success} ${chalk.green('All queue states saved to')} ${chalk.yellow(config.persistence.directory)}`);
    } catch (error: any) {
        logger.error(`${logSymbols.error} ${chalk.red('Failed to save all queue states:')} ${chalk.yellow(error.message)}`);
    }
};

// Higher-order function to create queue state loader
export const createQueueStateLoader = (
    config: QueueConfig,
    scheduleProcessing: (queueName: string, queueService: QueueService) => void,
    processMessage: (queueName: string, message: any, queueService: QueueService) => Promise<void>
) => (queues: Record<string, QueueService>) => async (queueName: string): Promise<void> => {
    try {
        if (!queues[queueName]) {
            logger.warn(`Skipping load for non-existent queue: ${queueName}`);
            return;
        }

        const queueFilePath = path.join(config.persistence.directory, `${queueName}.json`);

        try {
            const data = await fs.readFile(queueFilePath, 'utf8');
            const queueData = JSON.parse(data);

            // Restore date objects
            restoreDates(queueData.incoming);
            restoreDates(queueData.processing);
            restoreDates(queueData.dlq);

            // Restore queue state
            queues[queueName].incoming = queueData.incoming;
            queues[queueName].processing = queueData.processing;
            queues[queueName].dlq = queueData.dlq;

            logger.debug(`Queue state loaded: ${queueName} (saved at ${queueData.savedAt})`);

            // Schedule processing for any messages that were in flight
            if (queues[queueName].incoming.length > 0) {
                scheduleProcessing(queueName, queues[queueName]);
            }

            // Re-process any messages that were in the processing queue
            if (queues[queueName].processing.length > 0) {
                for (const message of [...queues[queueName].processing]) {
                    if (message.attempts >= config.maxRetries) continue;

                    setTimeout(() => {
                        processMessage(queueName, message, queues[queueName]);
                    }, 100 * (Math.random() * 10));
                }
            }
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                logger.debug(`No saved state found for queue: ${queueName}`);
            } else {
                throw error;
            }
        }
    } catch (error: any) {
        logger.error(`Failed to load queue state for ${queueName}:`, error);
    }
};

// Higher-order function to create all queues state loader
export const createAllQueuesStateLoader = (
    config: QueueConfig,
    loadQueueState: (queueName: string) => Promise<void>
) => async (): Promise<void> => {
    try {
        const files = await fs.readdir(config.persistence.directory);
        const queueFiles = files.filter(file => file.endsWith('.json') && !file.includes('.temp.'));

        for (const file of queueFiles) {
            const queueName = path.basename(file, '.json');
            await loadQueueState(queueName);
        }

        logger.debug('All queue states loaded');
    } catch (error: any) {
        logger.error('Failed to load queue states:', error);
    }
};