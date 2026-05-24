import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";

import { InvokePluginOptions, InvokeManager } from "./types";
import { registerInvokeHandler, getInvokeHandler, listInvokeHandlers } from "./registry";

export const invokesPlugin: FastifyPluginAsync<InvokePluginOptions> =
    fsPlugin(async (app: FastifyInstance) => {
        const invokeManager: InvokeManager = {
            register(module, name, handler) {
                registerInvokeHandler(module, name, handler);
            },
            get(module, name) {
                return getInvokeHandler(module, name);
            },
            list() {
                return listInvokeHandlers();
            },
        };

        app.decorate('invokes', invokeManager);
    });
