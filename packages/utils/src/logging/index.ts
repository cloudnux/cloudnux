import { env } from "../config";
import { Logger, logLevels } from "./types";
import { errorToString } from "./error-to-string";
import { getWriter } from "./writer";

export { setWriter, getWriter } from "./writer";
export type { LogWriter, LogEntry } from "./writer";

const levelValues = {
    fatal: 70,
    error: 60,
    warn: 50,
    info: 40,
    debug: 30,
    trace: 20,
} as const;

type LevelName = keyof typeof levelValues;

let currentLogLevel = 2;
let _module = "default";
let _requestId = "";

export function initializeLogger(moduleName: string, requestIdValue: string = "") {
    _module = moduleName;
    _requestId = requestIdValue;
}

function writeLine(level: LevelName, mergeObject: Record<string, any> | null, msg: string, bindings: Record<string, string>) {
    getWriter()({
        level: levelValues[level],
        levelName: level,
        time: Date.now(),
        module: bindings.module || _module,
        reqId: bindings.reqId || _requestId,
        msg: level === "error" || level === "fatal" ? errorToString(msg) : msg,
        ...(mergeObject ? { meta: mergeObject } : {}),
    });
}

function createLogger(bindings: Record<string, string> = {}): Logger & { child: (b: Record<string, string>) => ReturnType<typeof createLogger> } {
    const currentLogLevelName = (env("LOG_LEVEL")?.toLowerCase() ?? "info") as keyof typeof logLevels;
    currentLogLevel = logLevels[currentLogLevelName] ?? logLevels.info;

    return {
        level: currentLogLevelName,
        fatal: (mergeObject: Record<string, any> | string, msg?: string) => {
            if (currentLogLevel >= logLevels.fatal) {
                typeof mergeObject === "string" || mergeObject instanceof Error
                    ? writeLine("fatal", null, mergeObject as any, bindings)
                    : writeLine("fatal", mergeObject, msg ?? "", bindings);
            }
        },
        error: (mergeObject: Record<string, any> | string, msg?: string) => {
            if (currentLogLevel >= logLevels.error) {
                typeof mergeObject === "string" || mergeObject instanceof Error
                    ? writeLine("error", null, mergeObject as any, bindings)
                    : writeLine("error", mergeObject, msg ?? "", bindings);
            }
        },
        warn: (mergeObject: Record<string, any> | string, msg?: string) => {
            if (currentLogLevel >= logLevels.warn) {
                typeof mergeObject === "string"
                    ? writeLine("warn", null, mergeObject, bindings)
                    : writeLine("warn", mergeObject, msg ?? "", bindings);
            }
        },
        info: (mergeObject: Record<string, any> | string, msg?: string) => {
            if (currentLogLevel >= logLevels.info) {
                typeof mergeObject === "string"
                    ? writeLine("info", null, mergeObject, bindings)
                    : writeLine("info", mergeObject, msg ?? "", bindings);
            }
        },
        debug: (mergeObject: Record<string, any> | string, msg?: string) => {
            if (currentLogLevel >= logLevels.debug) {
                typeof mergeObject === "string"
                    ? writeLine("debug", null, mergeObject, bindings)
                    : writeLine("debug", mergeObject, msg ?? "", bindings);
            }
        },
        trace: (mergeObject: Record<string, any> | string, msg?: string) => {
            if (currentLogLevel >= logLevels.trace) {
                typeof mergeObject === "string"
                    ? writeLine("trace", null, mergeObject, bindings)
                    : writeLine("trace", mergeObject, msg ?? "", bindings);
            }
        },
        silent: () => { },
        child: (childBindings: Record<string, string>) =>
            createLogger({ ...bindings, ...childBindings }),
    };
}

export const logger = createLogger();
