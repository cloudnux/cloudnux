import { env } from "../config";

import { Logger, logLevels } from "./types";
import { errorToString } from "./error-to-string";

export let logger: Logger;

export function setLogger(instance: Logger) {
    logger = instance;
}

export function initialize(module: string, requestId: string) {
    const currentLogLevel = env.int("LOG_LEVEL", logLevels.info);
    logger = {
        fatal: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.fatal) {
                console.error(JSON.stringify({
                    level: 'fatal',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                }));
            }
        },
        error: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.error) {
                console.error(JSON.stringify({
                    level: 'error',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                }));
            }
        },
        warn: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.warn) {
                console.warn(JSON.stringify({
                    level: 'warn',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                }));
            }
        },
        info: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.info) {
                console.info(JSON.stringify({
                    level: 'info',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                }));
            }
        },
        debug: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.debug) {
                console.debug(JSON.stringify({
                    level: 'debug',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                }));
            }
        }
    }
}