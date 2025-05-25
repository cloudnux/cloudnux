import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import logSymbols from "log-symbols";

import { FastifyInstance, FastifyPluginCallback } from "fastify";

import { QueueConfig, QueueMessage, QueuePluginOptions, QueueService, QueueSummary } from "./types";
import { logger } from "@cloudnux/utils";

const DEFAULT_CONFIG: QueueConfig = {
    batchSize: 10,
    batchWindowMs: 500,
    maxRetries: 3,
    parallel: true,
    maxConcurrent: 5,
    retryBackoff: true,
    persistence: {
        enabled: true,
        directory: './.develop/queue-data',
        saveInterval: 60000,
        saveOnShutdown: false,
        loadOnStartup: true
    }
};

export const queuesPlugin: FastifyPluginCallback<QueuePluginOptions> = async (
    app: FastifyInstance,
    options: QueuePluginOptions
) => {
    const queues: Record<string, QueueService> = {};
    const config: QueueConfig = { ...DEFAULT_CONFIG, ...options.config };
    const createEventContext = options.functionContextFactory;
    // Initialize queues from registry
    if (options.queueRegistry) {
        for (const { queueName, handler } of options.queueRegistry) {
            queues[queueName] = {
                handler,
                incoming: [],
                processing: [],
                dlq: [],
                timeoutId: null,
                processingBatch: false,
                activeProcessing: 0
            };
        }
    }

    // Initialize persistence
    if (config.persistence.enabled) {
        await initializePersistence();
    }


    // Main batch processing function
    async function processBatch(queueName: string): Promise<void> {
        const queueService = queues[queueName];
        if (!queueService) return;

        // Clear timeout to prevent double processing
        if (queueService.timeoutId) {
            clearTimeout(queueService.timeoutId);
            queueService.timeoutId = null;
        }

        // If already processing, reschedule
        if (queueService.processingBatch) {
            scheduleProcessing(queueName);
            return;
        }

        try {
            queueService.processingBatch = true;

            // Move messages from incoming to processing (up to batchSize)
            const messagesToProcess = queueService.incoming.splice(0, config.batchSize);

            if (messagesToProcess.length === 0) {
                queueService.processingBatch = false;
                return;
            }

            // Add to processing queue
            queueService.processing.push(...messagesToProcess);

            // Process sequentially
            for (const message of messagesToProcess) {
                await processMessage(queueName, message);
            }

            if (queueService.incoming.length > 0) {
                scheduleProcessing(queueName, 0); // Process immediately
            }

            // Save queue state after batch processing
            if (config.persistence.enabled) {
                await saveQueueState(queueName);
            }
        } finally {
            queueService.processingBatch = false;
        }
    }

    // Process an individual message
    async function processMessage(queueName: string, message: QueueMessage): Promise<void> {
        const queueService = queues[queueName];
        if (!queueService) return;

        try {
            //BOOKMARK
            const context = createEventContext(message);

            await queueService.handler(context);

            if (context.response.status === "error") {
                throw new Error(context.response.body as any);
            }

            // Remove from processing queue on success
            queueService.processing = queueService.processing.filter(
                msg => msg.id !== message.id
            );

            //BREAKPOINT: LOGGING
            logger.debug(`${logSymbols.success} ${chalk.green('Successfully processed message')} ${chalk.yellow(message.id)} in queue ${chalk.magenta(queueName)}`)
            //consola.success();
        } catch (error: any) {
            //BREAKPOINT: LOGGING
            logger.error(`${logSymbols.error} ${chalk.red('Error processing message')} ${chalk.yellow(message.id)} in queue ${chalk.magenta(queueName)}: ${error.message}`);

            if (message.attempts >= config.maxRetries) {
                // Move to DLQ after max retries
                queueService.dlq.push({
                    ...message,
                    error: error.message,
                    failedAt: new Date()
                });

                // Remove from processing
                queueService.processing = queueService.processing.filter(
                    msg => msg.id !== message.id
                );

                // Save DLQ state after message moves to DLQ
                if (config.persistence.enabled) {
                    await saveQueueState(queueName);
                }
            } else {
                // Increment attempt counter
                const index = queueService.processing.findIndex(m => m.id === message.id);
                if (index >= 0) {
                    queueService.processing[index].attempts += 1;

                    // Add backoff delay based on attempt count
                    if (config.retryBackoff) {
                        const delayMs = Math.pow(2, queueService.processing[index].attempts) * 100;
                        queueService.processing[index].nextAttempt = new Date(Date.now() + delayMs);

                        // Schedule retry after backoff
                        const messageToRetry = queueService.processing[index];
                        //BREAKPOINT: LOGGING
                        logger.info(`${chalk.blue('⏱️ Scheduling retry')} for message ${chalk.yellow(message.id)} in ${chalk.cyan(delayMs)}ms`);
                        setTimeout(() => {
                            processMessage(queueName, messageToRetry);
                        }, delayMs);
                    } else {
                        // Retry immediately if no backoff
                        await processMessage(queueName, queueService.processing[index]);
                    }
                }
            }
        }
    }

    // Schedule batch processing after a delay
    function scheduleProcessing(queueName: string, overrideDelay: number | null = null): void {
        const queueService = queues[queueName];
        if (!queueService) return;

        if (!queueService.timeoutId) {
            const delay = overrideDelay !== null ? overrideDelay : config.batchWindowMs;
            queueService.timeoutId = setTimeout(() => {
                processBatch(queueName);
            }, delay);
        }
    }

    // Initialize persistence system
    async function initializePersistence(): Promise<void> {
        try {
            // Create persistence directory if it doesn't exist
            await fs.mkdir(config.persistence.directory, { recursive: true });

            // Load queue data if enabled
            if (config.persistence.loadOnStartup) {
                await loadAllQueueStates();
            }

            // Set up interval to regularly save queue states
            if (config.persistence.saveInterval > 0) {
                setInterval(saveAllQueueStates, config.persistence.saveInterval);
            }

            // Set up process shutdown handler
            if (config.persistence.saveOnShutdown) {
                const shutdownHandler = async () => {
                    console.log('Saving queue state before shutdown...');
                    await saveAllQueueStates();
                    process.exit(0);
                };

                process.on('SIGINT', shutdownHandler);
                process.on('SIGTERM', shutdownHandler);
            }

            //BREAKPOINT: LOGGING
            logger.debug(`${logSymbols.success} ${chalk.green('Queue persistence initialized:')} ${chalk.yellow(config.persistence.directory)}`);
        } catch (error: any) {
            //BREAKPOINT: LOGGING
            logger.error(`${logSymbols.error} ${chalk.red('Failed to initialize queue persistence:')} ${chalk.yellow(error.message)}`);
        }
    }

    // Save state for all queues
    async function saveAllQueueStates(): Promise<void> {
        try {
            for (const queueName of Object.keys(queues)) {
                await saveQueueState(queueName);
            }
            //BREAKPOINT: LOGGING
            logger.debug(`${logSymbols.success} ${chalk.green('All queue states saved to')} ${chalk.yellow(config.persistence.directory)}`);
        } catch (error: any) {
            //BREAKPOINT: LOGGING
            logger.error(`${logSymbols.error} ${chalk.red('Failed to save all queue states:')} ${chalk.yellow(error.message)}`);
        }
    }

    // Save state for a specific queue
    async function saveQueueState(queueName: string): Promise<void> {
        try {
            const queueService = queues[queueName];
            if (!queueService) return;

            const queueData = {
                incoming: queueService.incoming,
                processing: queueService.processing,
                dlq: queueService.dlq,
                savedAt: new Date()
            };

            // Use a temporary file to avoid corruption if the process crashes during write
            const now = Date.now();
            const queueFilePath = path.join(config.persistence.directory, `${queueName}.json`);
            const tempFilePath = path.join(config.persistence.directory, `${queueName}.${now}temp.json`);

            // Write to temporary file first
            await fs.writeFile(tempFilePath, JSON.stringify(queueData, null, 2), 'utf8');

            // Rename temporary file to the actual file (atomic operation)
            await fs.rename(tempFilePath, queueFilePath);

            //BREAKPOINT: LOGGING
            logger.info(`${logSymbols.info} ${chalk.blue('Queue state saved:')} ${chalk.green(queueName)}`);
        } catch (error: any) {
            //BREAKPOINT: LOGGING
            logger.error(`Failed to save queue state for ${queueName}:`, error);
        }
    }

    async function loadAllQueueStates(): Promise<void> {
        try {
            const files = await fs.readdir(config.persistence.directory);
            const queueFiles = files.filter(file => file.endsWith('.json') && !file.includes('.temp.'));

            for (const file of queueFiles) {
                const queueName = path.basename(file, '.json');
                await loadQueueState(queueName);
            }

            console.log('All queue states loaded');
        } catch (error: any) {
            console.error('Failed to load queue states:', error);
        }
    }

    // Load state for a specific queue
    async function loadQueueState(queueName: string): Promise<void> {
        try {
            // Skip if queue doesn't exist
            if (!queues[queueName]) {
                console.warn(`Skipping load for non-existent queue: ${queueName}`);
                return;
            }

            const queueFilePath = path.join(config.persistence.directory, `${queueName}.json`);

            try {
                const data = await fs.readFile(queueFilePath, 'utf8');
                const queueData = JSON.parse(data);

                // Restore date objects (JSON.parse doesn't restore dates)
                queueData.incoming.forEach((msg: any) => {
                    msg.timestamp = new Date(msg.timestamp);
                    if (msg.nextAttempt) msg.nextAttempt = new Date(msg.nextAttempt);
                });

                queueData.processing.forEach((msg: any) => {
                    msg.timestamp = new Date(msg.timestamp);
                    if (msg.nextAttempt) msg.nextAttempt = new Date(msg.nextAttempt);
                });

                queueData.dlq.forEach((msg: any) => {
                    msg.timestamp = new Date(msg.timestamp);
                    if (msg.failedAt) msg.failedAt = new Date(msg.failedAt);
                    if (msg.nextAttempt) msg.nextAttempt = new Date(msg.nextAttempt);
                });

                // Restore queue state
                queues[queueName].incoming = queueData.incoming;
                queues[queueName].processing = queueData.processing;
                queues[queueName].dlq = queueData.dlq;

                console.log(`Queue state loaded: ${queueName} (saved at ${queueData.savedAt})`);

                // Schedule processing for any messages that were in flight
                if (queues[queueName].incoming.length > 0) {
                    scheduleProcessing(queueName);
                }

                // Re-process any messages that were in the processing queue
                if (queues[queueName].processing.length > 0) {
                    for (const message of [...queues[queueName].processing]) {
                        // Skip processing if message has exceeded max retries
                        if (message.attempts >= config.maxRetries) continue;

                        // Process with a slight delay to avoid overwhelming the system on startup
                        setTimeout(() => {
                            processMessage(queueName, message);
                        }, 100 * (Math.random() * 10));
                    }
                }
            } catch (error: any) {
                if (error.code === 'ENOENT') {
                    console.log(`No saved state found for queue: ${queueName}`);
                } else {
                    throw error;
                }
            }
        } catch (error: any) {
            console.error(`Failed to load queue state for ${queueName}:`, error);
        }
    }

    //=========================
    // registered urls
    //=========================

    app.get("/dashboard", async function (_, reply) {
        const summary: Record<string, QueueSummary> = {};

        for (const [queueName, queue] of Object.entries(queues)) {
            summary[queueName] = {
                incoming: queue.incoming.length,
                processing: queue.processing.length,
                dlq: queue.dlq.length,
                isProcessing: queue.processingBatch,
                activeProcessing: queue.activeProcessing,
                configuration: {
                    batchSize: config.batchSize,
                    batchWindowMs: config.batchWindowMs,
                    parallel: config.parallel,
                    maxConcurrent: config.maxConcurrent
                }
            };
        }

        return reply.status(200).send(summary);
    });

    app.get<{ Params: { queue: string } }>("/:queue", async function (request, reply) {
        const queueName = request.params.queue;

        if (!queues[queueName]) {
            return reply.status(404).send({ error: "Queue not found" });
        }

        const queue = queues[queueName];
        return reply.status(200).send({
            stats: {
                incoming: queue.incoming.length,
                processing: queue.processing.length,
                dlq: queue.dlq.length,
                isProcessing: queue.processingBatch,
                activeProcessing: queue.activeProcessing
            },
            messages: {
                incoming: queue.incoming,
                processing: queue.processing,
                dlq: queue.dlq
            }
        });
    });

    app.post<{ Params: { queue: string }; Body: any }>("/:queue", async function (request, reply) {
        const queueName = request.params.queue;

        if (!queues[queueName]) {
            return reply.status(404).send({ error: "Queue not found" });
        }

        const id = Date.now().toString() + Math.random().toString(36).substring(2, 7);

        const message: QueueMessage = {
            id,
            timestamp: new Date(),
            attempts: 0,
            payload: request.body,
            attributes: request.headers as Record<string, any>,
        };

        queues[queueName].incoming.push(message);

        // Schedule processing if not already scheduled
        scheduleProcessing(queueName);

        // Trigger immediate processing if we've reached batch size
        if (queues[queueName].incoming.length >= config.batchSize) {
            if (queues[queueName].timeoutId) {
                clearTimeout(queues[queueName].timeoutId);
                queues[queueName].timeoutId = null;
            }
            setImmediate(() => processBatch(queueName));
        }

        // Save queue state after adding new message
        if (config.persistence.enabled) {
            await saveQueueState(queueName);
        }

        return reply.status(200).send({ id, queueName });
    });

    app.get<{ Params: { queue: string } }>("/:queue/process-dlq", async function (request, reply) {
        const queueName = request.params.queue;

        if (!queues[queueName]) {
            return reply.status(404).send({ error: "Queue not found" });
        }

        const queue = queues[queueName];
        const dlqCount = queue.dlq.length;

        if (dlqCount === 0) {
            return reply.status(200).send({
                status: "success",
                message: "No messages in DLQ to process",
                processed: 0
            });
        }

        //BREAKPOINT: LOGGING
        logger.warn(`${logSymbols.warning} ${chalk.yellow('Moving')} ${chalk.red(dlqCount)} messages from DLQ to incoming queue for ${chalk.green(queueName)}`);

        // Reset attempt counters and move messages from DLQ to incoming queue
        const movedMessages = queue.dlq.map(message => ({
            ...message,
            attempts: 0,
            error: undefined,
            failedAt: undefined,
            reprocessed: true,
            originalId: message.id,
            id: Date.now().toString() + Math.random().toString(36).substring(2, 7)
        }));

        queue.incoming.push(...movedMessages);
        queue.dlq = [];

        // Schedule processing if not already scheduled
        scheduleProcessing(queueName);

        // Save queue state after adding new message
        if (config.persistence.enabled) {
            await saveQueueState(queueName);
        }

        return reply.status(200).send({
            status: "success",
            message: `Moved ${dlqCount} messages from DLQ to processing queue`,
            processed: dlqCount
        });
    });

    app.get<{ Params: { queue: string } }>("/:queue/purge-dlg", async function (request, reply) {

        const queueName = request.params.queue;

        if (!queues[queueName]) {
            return reply.status(404).send({ error: "Queue not found" });
        }

        const queue = queues[queueName];
        const dlqCount = queue.dlq.length;

        if (dlqCount === 0) {
            return reply.status(200).send({
                status: "success",
                message: "No messages in DLQ to purge",
                purged: 0
            });
        }

        //BREAKPOINT: LOGGING
        logger.warn(`${logSymbols.warning} ${chalk.yellow('Purging')} ${chalk.red(dlqCount)} messages from DLQ for ${chalk.green(queueName)}`);

        queue.dlq = [];

        // Save queue state after purging DLQ
        if (config.persistence.enabled) {
            await saveQueueState(queueName);
        }

        return reply.status(200).send({
            status: "success",
            message: `Purged ${dlqCount} messages from DLQ`,
            purged: dlqCount
        });
    });
}