import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";

import { InvokePluginOptions, InvokeManager, InvokeHandlerFn, InvokeExecution } from "./types";

const MAX_HISTORY_PER_TRIGGER = 50;

export const invokesPlugin: FastifyPluginAsync<InvokePluginOptions> =
    fsPlugin(async (app: FastifyInstance) => {
        const registry = new Map<string, InvokeHandlerFn>();
        const history = new Map<string, InvokeExecution[]>();

        const record = (key: string, execution: InvokeExecution) => {
            const entries = history.get(key) ?? [];
            entries.unshift(execution);
            if (entries.length > MAX_HISTORY_PER_TRIGGER) {
                entries.length = MAX_HISTORY_PER_TRIGGER;
            }
            history.set(key, entries);
        };

        const invokeManager: InvokeManager = {
            register(module, name, handler) {
                const key = `${module}:${name}`;
                // the recording lives here, around the handler, so every caller
                // (in-process, another namespace, the dev console) is captured
                registry.set(key, async (envelope) => {
                    const start = Date.now();
                    const execution = {
                        id: start.toString() + Math.random().toString(36).slice(2, 9),
                        module,
                        name,
                        startTime: new Date(start).toISOString(),
                        payload: envelope.payload,
                    };
                    const finish = (outcome: Pick<InvokeExecution, 'status' | 'result' | 'error'>) => {
                        const end = Date.now();
                        record(key, { ...execution, ...outcome, endTime: new Date(end).toISOString(), duration: end - start });
                    };
                    try {
                        const result = await handler(envelope);
                        if (result?.status === 'error') {
                            finish({ status: 'failed', result, error: typeof result.body === 'string' ? result.body : 'error response' });
                        } else {
                            finish({ status: 'completed', result });
                        }
                        return result;
                    } catch (error) {
                        finish({ status: 'failed', error: (error as Error).message });
                        throw error;
                    }
                });
            },
            get(module, name) {
                const key = `${module}:${name}`;
                return registry.get(key);
            },
            list() {
                return Array.from(registry.keys());
            },
            entries(module) {
                return Array.from(registry.keys())
                    .map((key) => {
                        const separator = key.indexOf(':');
                        return { module: key.slice(0, separator), name: key.slice(separator + 1) };
                    })
                    .filter((entry) => !module || entry.module === module);
            },
            getHistory(module, name) {
                return history.get(`${module}:${name}`) ?? [];
            },
        };

        app.decorate('invokes', invokeManager);

        // entry point for invokes coming from another namespace (another dev server)
        app.post<{ Params: { module: string, trigger: string }, Body: { payload?: unknown } | null }>(
            '/__invoke/:module/:trigger',
            async (request, reply) => {
                const { module, trigger } = request.params;
                const handler = invokeManager.get(module, trigger);
                if (!handler) {
                    return reply.code(404).send({ error: `No local invoke handler registered for: ${module}:${trigger}` });
                }
                try {
                    const result = await handler({
                        calledModule: module,
                        invokeTriggerName: trigger,
                        payload: request.body?.payload,
                    });
                    return reply.send({ result });
                } catch (error) {
                    return reply.code(500).send({ error: (error as Error).message });
                }
            }
        );
    });
