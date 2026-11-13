import { AsyncLocalStorage } from 'node:async_hooks';

import type { LogEntry, LoggerService } from '@cloudnux/core-cloud-provider';
import { env } from '@cloudnux/utils';

// ---------------------------------------------------------------------------
// Log context
//
// Azure Functions runs many invocations concurrently in one Node process, so
// the AWS approach (setBindings mutating one shared object) would leak reqId
// between requests. module/reqId live in AsyncLocalStorage instead, like the
// local provider. The function service (later) wraps each invocation in
// runWithLogContext(); anything awaited underneath sees that invocation's
// bindings.
// ---------------------------------------------------------------------------

/**
 * The logging half of @azure/functions' InvocationContext, typed structurally
 * so the logger has no dependency on @azure/functions. An InvocationContext
 * satisfies it as-is.
 */
export interface InvocationLogger {
    trace(...args: unknown[]): void;
    debug(...args: unknown[]): void;
    info(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    error(...args: unknown[]): void;
}

export type LogContext = {
    module?: string;
    reqId?: string;
    /**
     * Set by the function service for the current invocation. When present,
     * entries go through it, so App Insights links them to the invocation
     * (operation_Id) and records the real severity.
     */
    invocation?: InvocationLogger;
};

const storage = new AsyncLocalStorage<LogContext>();

/** Process-wide defaults, used outside any invocation (scripts, startup). */
const baseBindings: LogContext = {};

/** Scope bindings to one invocation and everything it awaits. */
export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
    return storage.run({ ...context }, fn);
}

/** Bind context for the rest of the current async chain, without a callback. */
export function enterLogContext(context: LogContext): void {
    storage.enterWith({ ...context });
}

export function getLogContext(): LogContext {
    return storage.getStore() ?? baseBindings;
}

// ---------------------------------------------------------------------------
// Levels — resolved on first write so LOG_LEVEL set after import still applies
// ---------------------------------------------------------------------------

const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
type Level = (typeof levels)[number];

let cachedLevel: Level | undefined;

function currentLevel(): Level {
    if (cachedLevel === undefined) {
        const configured = env('LOG_LEVEL', 'info').toLowerCase();
        cachedLevel = (levels as readonly string[]).includes(configured) ? (configured as Level) : 'info';
    }
    return cachedLevel;
}

/** @internal test hook */
export function resetLogLevel(): void {
    cachedLevel = undefined;
}

function isEnabled(level: Level): boolean {
    return levels.indexOf(level) <= levels.indexOf(currentLevel());
}

// ---------------------------------------------------------------------------
// Writer — one JSON line per entry.
//
// Inside an invocation, the line goes through the invocation's context
// (context.error/warn/...), which ties it to the invocation in Application
// Insights and sets its severity. Outside one (startup, scripts, standalone
// use) it goes to stdout via console.log: still ingested by App Insights, but
// as uncorrelated app-level traces. Circular meta is replaced rather than
// throwing inside a handler.
// ---------------------------------------------------------------------------

const invocationMethod: Record<Level, keyof InvocationLogger> = {
    fatal: 'error',
    error: 'error',
    warn: 'warn',
    info: 'info',
    debug: 'debug',
    trace: 'trace',
};

function emit(level: Level, line: string, invocation?: InvocationLogger): void {
    if (invocation) {
        try {
            invocation[invocationMethod[level]](line);
            return;
        } catch {
            // e.g. context used after the invocation finished; don't lose the line
        }
    }
    // eslint-disable-next-line no-console
    console.log(line);
}

function circularSafeReplacer() {
    const seen = new WeakSet<object>();
    return (_key: string, value: unknown) => {
        if (value instanceof Error) {
            return { name: value.name, message: value.message, stack: value.stack };
        }
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
        }
        return value;
    };
}

function write(level: Level, mergeObject: Record<string, any> | string, msg?: string): void {
    if (!isEnabled(level)) return;

    const context = getLogContext();
    let module = context.module ?? baseBindings.module;
    let reqId = context.reqId ?? baseBindings.reqId;
    let text: string;
    let meta: Record<string, unknown> | undefined;

    if (typeof mergeObject === 'string') {
        text = mergeObject;
    } else if (mergeObject instanceof Error) {
        text = mergeObject.stack ?? mergeObject.message;
    } else {
        const { module: explicitModule, reqId: explicitReqId, ...rest } = mergeObject;
        if (explicitModule) module = explicitModule;
        if (explicitReqId) reqId = explicitReqId;
        meta = Object.keys(rest).length ? rest : undefined;
        text = msg ?? '';
    }

    const entry: LogEntry = {
        level: levels.indexOf(level),
        levelName: level,
        time: Date.now(),
        module: module || 'default',
        reqId: reqId || '',
        msg: text,
        ...(meta ? { meta } : {}),
    };

    emit(level, JSON.stringify(entry, circularSafeReplacer()), context.invocation);
}

// ---------------------------------------------------------------------------
// LoggerService
//
// setBindings writes into the current invocation's context when there is one
// (that object belongs to a single invocation, so mutating it is safe), and
// into the process-wide defaults otherwise.
// ---------------------------------------------------------------------------

export function createLoggerService(): LoggerService {
    return {
        get level() {
            return currentLevel();
        },
        setBindings(bindings: Record<string, string>) {
            // Only module/reqId are bindable; the invocation is owned by the function service.
            const target = storage.getStore() ?? baseBindings;
            if (bindings.module !== undefined) target.module = bindings.module;
            if (bindings.reqId !== undefined) target.reqId = bindings.reqId;
        },
        fatal: (mergeObject, msg) => write('fatal', mergeObject, msg),
        error: (mergeObject, msg) => write('error', mergeObject, msg),
        warn: (mergeObject, msg) => write('warn', mergeObject, msg),
        info: (mergeObject, msg) => write('info', mergeObject, msg),
        debug: (mergeObject, msg) => write('debug', mergeObject, msg),
        trace: (mergeObject, msg) => write('trace', mergeObject, msg),
    };
}
