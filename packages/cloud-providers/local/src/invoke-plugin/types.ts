import { FastifyPluginOptions } from "fastify";

export type InvokeHandlerFn = (envelop: { payload?: any, calledModule: string, invokeTriggerName: string }) => Promise<any>;

export interface InvokeExecution {
    id: string;
    module: string;
    name: string;
    status: 'completed' | 'failed';
    startTime: string;
    endTime: string;
    duration: number;
    payload?: unknown;
    result?: unknown;
    error?: string;
}

export interface InvokeManager {
    register(module: string, name: string, handler: InvokeHandlerFn): void;
    get(module: string, name: string): InvokeHandlerFn | undefined;
    list(): string[];
    /** registered invoke triggers, optionally of one module */
    entries(module?: string): { module: string, name: string }[];
    /** most recent first; every call is recorded, whoever made it */
    getHistory(module: string, name: string): InvokeExecution[];
}

export interface InvokePluginOptions extends FastifyPluginOptions {
    prefix?: string;
}

declare module 'fastify' {
    interface FastifyInstance {
        invokes: InvokeManager;
    }
}
