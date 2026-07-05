import { LoggerService, LogEntry } from "@cloudnux/core-cloud-provider";
import { env } from "@cloudnux/utils";

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

const levels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
type Level = (typeof levels)[number];

function resolveLevel(): Level {
    const configured = env("LOG_LEVEL", "info").toLowerCase();
    return (levels as readonly string[]).includes(configured) ? (configured as Level) : "info";
}

const threshold = levels.indexOf(resolveLevel());

function isEnabled(level: Level): boolean {
    return levels.indexOf(level) <= threshold;
}

// ---------------------------------------------------------------------------
// LoggerService
//
// One instance per warm container, cached by @cloudnux/sdk's cloudLogger() and
// reused across invocations - safe because Lambda's classic invoke model runs
// one invocation at a time per container, so setBindings (called fresh by
// router/index.ts:run() at the start of every invocation) never races with a
// previous invocation's still-in-flight logging. No AsyncLocalStorage needed
// here, unlike local - see doc/logging-plan.md.
//
// CloudWatch ingests stdout, so each entry is written as one JSON line -
// queryable in CloudWatch Logs Insights, unlike local's chalk pretty-printer.
// ---------------------------------------------------------------------------

export function createLoggerService(): LoggerService {
    const _bindings = {} as Record<string, string>;

    function write(level: Level, mergeObject: Record<string, any> | string, msg?: string): void {
        if (!isEnabled(level)) return;

        let module = _bindings.module;
        let reqId = _bindings.reqId;
        let text: string;
        let meta: Record<string, unknown> | undefined;

        if (typeof mergeObject === "string") {
            text = mergeObject;
        } else if (mergeObject instanceof Error) {
            text = mergeObject.stack ?? mergeObject.message;
        } else {
            const { module: explicitModule, reqId: explicitReqId, ...rest } = mergeObject;
            if (explicitModule) module = explicitModule;
            if (explicitReqId) reqId = explicitReqId;
            meta = Object.keys(rest).length ? rest : undefined;
            text = msg ?? "";
        }

        const entry: LogEntry = {
            level: levels.indexOf(level),
            levelName: level,
            time: Date.now(),
            module: module ?? "default",
            reqId: reqId ?? "",
            msg: text,
            ...(meta ? { meta } : {}),
        };

        // eslint-disable-next-line no-console
        console.log(JSON.stringify(entry));
    }

    return {
        level: resolveLevel(),
        setBindings: (bindings: Record<string, string>) => {
            Object.assign(_bindings, bindings);
        },
        fatal: (mergeObject, msg) => write("fatal", mergeObject, msg),
        error: (mergeObject, msg) => write("error", mergeObject, msg),
        warn: (mergeObject, msg) => write("warn", mergeObject, msg),
        info: (mergeObject, msg) => write("info", mergeObject, msg),
        debug: (mergeObject, msg) => write("debug", mergeObject, msg),
        trace: (mergeObject, msg) => write("trace", mergeObject, msg),
    };
}
