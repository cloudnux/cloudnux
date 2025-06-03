import { env } from "../config";
import chalk from "chalk";
import { EOL } from "os";

import { Logger, logLevels } from "./types";
import { errorToString } from "./error-to-string";

const currentLogLevel = env.int('LOG_LEVEL', logLevels.info);

export const logger: Logger = {
    fatal: (message: unknown, meta?: Record<string, any>) => {
        if (currentLogLevel >= logLevels.fatal) {
            console.error(
                `[${new Date().toTimeString()}]`,
                `${chalk.bgRed.white(" fatal ")}${EOL}`,
                errorToString(message),
                meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
            );
        }
    },
    error: (message: unknown, meta?: Record<string, any>) => {
        if (currentLogLevel >= logLevels.error) {
            console.error(
                `[${new Date().toTimeString()}]`,
                `${chalk.bgRed.white(" error ")}${EOL}`,
                errorToString(message),
                meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
            );
        }
    },
    warn: (message: unknown, meta?: Record<string, any>) => {
        if (currentLogLevel >= logLevels.warn) {
            console.warn(
                `[${new Date().toTimeString()}]`,
                `${chalk.bgYellow.black(" warn ")}${EOL}`,
                errorToString(message),
                meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
            );
        }
    },
    info: (message: unknown, meta?: Record<string, any>) => {
        if (currentLogLevel >= logLevels.info) {
            console.info(
                `[${new Date().toTimeString()}]`,
                `${chalk.bgBlue.white(" info ")}${EOL}`,
                message,
                meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
            );
        }
    },
    debug: (message: unknown, meta?: Record<string, any>) => {
        if (currentLogLevel >= logLevels.debug) {
            console.debug(
                `[${new Date().toTimeString()}]`,
                `${chalk.bgWhite.black(" debug ")}${EOL}`,
                message,
                meta ? `${EOL}${JSON.stringify(meta, null, 2)}` : ""
            );
        }
    }
}