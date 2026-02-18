import { env } from "../config";

import { Logger, logLevels } from "./types";
import { errorToString } from "./error-to-string";

export let logger: Logger;
export function initializeLogger(module: string, requestId: string = "") {
    const currentLogLevel = logLevels[env('LOG_LEVEL')?.toLowerCase() as keyof typeof logLevels] ?? logLevels.info;
    logger = {
        fatal: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.fatal) {
                console.error({
                    level: 'fatal',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                });
            }
        },
        error: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.error) {
                console.error({
                    level: 'error',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                });
            }
        },
        warn: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.warn) {
                console.warn({
                    level: 'warn',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                });
            }
        },
        info: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.info) {
                console.info({
                    level: 'info',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                });
            }
        },
        debug: (message: unknown, meta?: Record<string, any>) => {
            if (currentLogLevel >= logLevels.debug) {
                console.log({
                    level: 'debug',
                    message: errorToString(message),
                    timestamp: new Date().toISOString(),
                    module,
                    requestId,
                    ...meta
                });
            }
        }
    }
}

// export const logger: Logger = {
//     fatal: (message: unknown, meta?: Record<string, any>) => {
//         if (currentLogLevel >= logLevels.fatal) {
//             console.error(
//                 `[${new Date().toTimeString()}]`,
//                 `${chalk.bgRed.white(" fatal ")}${EOL}`,
//                 errorToString(message),
//                 meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
//             );
//         }
//     },
//     error: (message: unknown, meta?: Record<string, any>) => {
//         if (currentLogLevel >= logLevels.error) {
//             console.error(
//                 `[${new Date().toTimeString()}]`,
//                 `${chalk.bgRed.white(" error ")}${EOL}`,
//                 errorToString(message),
//                 meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
//             );
//         }
//     },
//     warn: (message: unknown, meta?: Record<string, any>) => {
//         if (currentLogLevel >= logLevels.warn) {
//             console.warn(
//                 `[${new Date().toTimeString()}]`,
//                 `${chalk.bgYellow.black(" warn ")}${EOL}`,
//                 errorToString(message),
//                 meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
//             );
//         }
//     },
//     info: (message: unknown, meta?: Record<string, any>) => {
//         if (currentLogLevel >= logLevels.info) {
//             console.info(
//                 `[${new Date().toTimeString()}]`,
//                 `${chalk.bgBlue.white(" info ")}${EOL}`,
//                 message,
//                 meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
//             );
//         }
//     },
//     debug: (message: unknown, meta?: Record<string, any>) => {
//         if (currentLogLevel >= logLevels.debug) {
//             console.debug(
//                 `[${new Date().toTimeString()}]`,
//                 `${chalk.bgWhite.black(" debug ")}${EOL}`,
//                 message,
//                 meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
//             );
//         }
//     }
// }