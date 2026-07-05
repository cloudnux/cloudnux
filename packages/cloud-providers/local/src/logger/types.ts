import type { LoggerService, LogEntry } from "@cloudnux/core-cloud-provider";

export type LogContext = {
    module?: string;
    reqId?: string;
};

export type LogListener = (entry: LogEntry) => void;

export type RunWithLogContext = <T>(context: LogContext, fn: () => T) => T;
export type SubscribeToLogs = (listener: LogListener) => () => void;

// Flattened onto LoggerService (rather than nesting it under a `logger` key)
// so every call site reads `logging.info(...)`, not `logging.logger.info(...)`.
export type LoggingContext = LoggerService & {
    runWithLogContext: RunWithLogContext;
    subscribeToLogs: SubscribeToLogs;
};

// Type declaration for Fastify instance
declare module "fastify" {
    interface FastifyInstance {
        logging: LoggingContext;
    }
}
