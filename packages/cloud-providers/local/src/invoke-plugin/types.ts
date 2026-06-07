import { FastifyPluginOptions } from "fastify";

export type InvokeHandlerFn = (envelop: { payload?: any, calledModule: string, invokeTriggerName: string }) => Promise<any>;

export interface InvokeManager {
    register(module: string, name: string, handler: InvokeHandlerFn): void;
    get(module: string, name: string): InvokeHandlerFn | undefined;
    list(): string[];
}

export interface InvokePluginOptions extends FastifyPluginOptions {
    prefix?: string;
}

declare module 'fastify' {
    interface FastifyInstance {
        invokes: InvokeManager;
    }
}
