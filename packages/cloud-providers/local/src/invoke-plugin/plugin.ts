import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";

import { InvokePluginOptions, InvokeManager, InvokeHandlerFn } from "./types";

export const invokesPlugin: FastifyPluginAsync<InvokePluginOptions> =
    fsPlugin(async (app: FastifyInstance) => {
        const registry = new Map<string, InvokeHandlerFn>();
        const invokeManager: InvokeManager = {
            register(module, name, handler) {
                const key = `${module}:${name}`;
                registry.set(key, handler);
            },
            get(module, name) {
                const key = `${module}:${name}`;
                return registry.get(key);
            },
            list() {
                return Array.from(registry.keys());
            },
        };

        app.decorate('invokes', invokeManager);
    });
