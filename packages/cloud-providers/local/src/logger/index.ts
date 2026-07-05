import chalk from "chalk";
import { EOL } from "os";
import { AsyncLocalStorage } from "node:async_hooks";

import type { LoggerService, LogEntry } from "@cloudnux/core-cloud-provider";
import { env } from "@cloudnux/utils";

import type { LogContext, LogListener } from "./types";

// ---------------------------------------------------------------------------
// Log context
//
// Lets `module`/`reqId` be resolved automatically by any code running
// underneath a request or a dispatched handler, without threading a context
// object through every function signature. Fastify handles concurrent
// requests in one process, so this has to be AsyncLocalStorage rather than a
// mutated shared variable, which would be unsafe the moment anything awaits.
// ---------------------------------------------------------------------------

const storage = new AsyncLocalStorage<LogContext>();

// For synchronous entry points (e.g. a Fastify `onRequest` hook) that need to
// bind context for the rest of that request's async chain without wrapping
// the remaining work in a callback.
export function enterLogContext(context: LogContext): void {
    storage.enterWith(context);
}

// For call sites that dispatch a handler directly (queue/schedule/websocket),
// scoping context to just that one invocation.
export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
    return storage.run(context, fn);
}

export function getLogContext(): LogContext {
    return storage.getStore() ?? {};
}

// ---------------------------------------------------------------------------
// Log bus — dev-console-plugin subscribes to this to mirror logs into its UI.
// ---------------------------------------------------------------------------

const listeners = new Set<LogListener>();

export function subscribeToLogs(listener: LogListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function publish(entry: LogEntry): void {
    for (const listener of listeners) {
        listener(entry);
    }
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

const levels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
type Level = (typeof levels)[number];

function resolveLevel(): Level {
    const configured = env("LOG_LEVEL", "info").toLowerCase();
    return (levels as readonly string[]).includes(configured) ? (configured as Level) : "info";
}

// Resolved lazily (on first log write) rather than at module load, so that
// LOG_LEVEL is read only after dotenv/dotenvx has had a chance to populate
// process.env — module-load time can run before env injection completes.
let cachedLevel: Level | undefined;

function currentLevel(): Level {
    if (cachedLevel === undefined) {
        cachedLevel = resolveLevel();
    }
    return cachedLevel;
}

function isEnabled(level: Level): boolean {
    return levels.indexOf(level) <= levels.indexOf(currentLevel());
}

// ---------------------------------------------------------------------------
// Pretty stdout writer
// ---------------------------------------------------------------------------

const levelColor: Record<Level, (s: string) => string> = {
    fatal: chalk.bgRed.white,
    error: chalk.red,
    warn: chalk.yellow,
    info: chalk.cyan,
    debug: chalk.gray,
    trace: chalk.white,
};

function formatTime(ms: number): string {
    return new Date(ms).toTimeString().slice(0, 8);
}

function circularSafeReplacer() {
    const seen = new WeakSet<object>();
    return (_key: string, value: unknown) => {
        if (typeof value === "object" && value !== null) {
            if (seen.has(value)) return "[Circular]";
            seen.add(value);
        }
        return value;
    };
}

function formatMeta(meta: Record<string, unknown>): string {
    return EOL + chalk.dim("  " + JSON.stringify(meta, circularSafeReplacer()));
}

function printPretty(entry: LogEntry): void {
    const color = levelColor[entry.levelName as Level] ?? chalk.white;
    const time = chalk.dim(formatTime(entry.time));
    const level = color(entry.levelName.toUpperCase().padEnd(5));
    const module = chalk.magenta(entry.module);
    const reqId = entry.reqId ? chalk.dim(`[${entry.reqId}] `) : "";
    const meta = entry.meta ? formatMeta(entry.meta) : "";

    process.stdout.write(`${time} ${level} ${module} ${reqId}- ${entry.msg}${meta}${EOL}`);
}

// ---------------------------------------------------------------------------
// LoggerService
//
// A single long-lived instance shared (via app.decorate) across every
// plugin bundle. setBindings is a deliberate no-op here: this object is
// touched concurrently by many in-flight requests/handlers, so nothing may
// ever be mutated onto it per-call. module/reqId instead come from the
// ambient log context, with an explicit `module`/`reqId` key on the
// mergeObject taking precedence when the caller passes one.
// ---------------------------------------------------------------------------

function write(level: Level, mergeObject: Record<string, any> | string, msg?: string): void {
    if (!isEnabled(level)) return;

    const context = getLogContext();
    let module = context.module ?? "default";
    let reqId = context.reqId ?? "";
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
        module,
        reqId,
        msg: text,
        ...(meta ? { meta } : {}),
    };

    printPretty(entry);
    publish(entry);
}

export const logger: LoggerService = {
    get level() {
        return currentLevel();
    },
    setBindings: () => { },
    fatal: (mergeObject, msg) => write("fatal", mergeObject, msg),
    error: (mergeObject, msg) => write("error", mergeObject, msg),
    warn: (mergeObject, msg) => write("warn", mergeObject, msg),
    info: (mergeObject, msg) => write("info", mergeObject, msg),
    debug: (mergeObject, msg) => write("debug", mergeObject, msg),
    trace: (mergeObject, msg) => write("trace", mergeObject, msg),
};
