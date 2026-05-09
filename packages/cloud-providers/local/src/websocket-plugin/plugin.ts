import crypto from "node:crypto";

import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";
import websocketPlugin from "@fastify/websocket";

import { logger } from "@cloudnux/utils";


import {
    WebSocketPluginOptions,
    WebSocketConfig,
    WebSocketConnection,
    WebSocketRouteHandler,
    RegisteredWebSocketPath,
} from "./types";

const DEFAULT_CONFIG: WebSocketConfig = {
    routeKeyField: "action",
};

function mergeConfig(
    defaults: WebSocketConfig,
    overrides?: Partial<WebSocketConfig>
): WebSocketConfig {
    return { ...defaults, ...overrides };
}

export const websocketsPlugin: FastifyPluginAsync<WebSocketPluginOptions> =
    fsPlugin(async (
        app: FastifyInstance,
        options: WebSocketPluginOptions
    ) => {
        const config = mergeConfig(DEFAULT_CONFIG, options.config);
        const connections = new Map<string, WebSocketConnection>();
        const handlers: WebSocketRouteHandler[] = [];
        const registeredPaths = new Set<string>();
        const pathModuleMap = new Map<string, string | undefined>();

        // Register @fastify/websocket
        await app.register(websocketPlugin);

        // Register WebSocket route for a path when first handler uses it
        function ensureRouteForPath(path: string) {
            if (registeredPaths.has(path)) return;
            registeredPaths.add(path);

            app.get(path, {
                websocket: true,
                preHandler: async (request, reply) => {
                    const connectionId = crypto.randomUUID();
                    (request as any)._wsConnectionId = connectionId;

                    const connectHandlers = handlers.filter(h => h.path === path && h.event === "connect");
                    for (const h of connectHandlers) {
                        await h.handler(connectionId, "connect", null, request, reply);
                    }
                    if (reply.statusCode !== 200)
                        return reply; // Prevent WebSocket upgrade if preHandler set an error status
                },
            }, (socket, request) => {
                const connectionId = (request as any)._wsConnectionId ?? crypto.randomUUID();
                const connection: WebSocketConnection = {
                    connectionId,
                    socket,
                    path,
                    connectedAt: new Date(),
                };
                connections.set(connectionId, connection);

                // Filter handlers for this path at runtime so late-registered handlers are included
                const pathHandlers = () => handlers.filter(h => h.path === path);

                // Handle incoming messages
                socket.on("message", (raw) => {
                    const data = raw.toString();

                    const currentHandlers = pathHandlers();

                    // Try to parse and match a specific route handler
                    let routeKey: string | undefined;
                    try {
                        const parsed = JSON.parse(data);
                        routeKey = parsed?.[config.routeKeyField];
                    } catch {
                        // not JSON, no route key
                    }

                    let matched = false;
                    if (routeKey) {
                        const routeHandlers = currentHandlers.filter(
                            h => h.event === "message" && h.route === routeKey
                        );
                        for (const h of routeHandlers) {
                            matched = true;
                            h.handler(connectionId, "message", data, request).catch((e) => { logger.error(e) });
                        }
                    }

                    // Fall back to default message handlers (no route)
                    if (!matched) {
                        const defaultHandlers = currentHandlers.filter(
                            h => h.event === "message" && !h.route
                        );
                        for (const h of defaultHandlers) {
                            h.handler(connectionId, "message", data, request).catch((e) => { logger.error(e) });
                        }
                    }
                });

                // Handle disconnect
                socket.on("close", () => {
                    const disconnectHandlers = pathHandlers().filter(h => h.event === "disconnect");
                    for (const h of disconnectHandlers) {
                        h.handler(connectionId, "disconnect", null, request).catch((e) => { logger.error(e) });
                    }
                    connections.delete(connectionId);
                });
            });
        }

        // Create manager with eager route registration
        const manager = {
            registerHandler(handler: WebSocketRouteHandler) {
                handlers.push(handler);
                if (!pathModuleMap.has(handler.path)) {
                    pathModuleMap.set(handler.path, handler.module);
                }
                ensureRouteForPath(handler.path);
            },
            getConnections(path?: string): WebSocketConnection[] {
                const allConnections = Array.from(connections.values());
                if (path) {
                    return allConnections.filter(c => c.path === path);
                }
                return allConnections;
            },
            getRegisteredPaths(module?: string): RegisteredWebSocketPath[] {
                const all: RegisteredWebSocketPath[] = Array.from(pathModuleMap.entries()).map(([path, mod]) => ({ path, module: mod }));
                if (module) {
                    return all.filter(p => p.module === module);
                }
                return all;
            },
            async sendToClient(connectionId: string, data: any): Promise<void> {
                const connection = connections.get(connectionId);
                if (!connection) {
                    throw new Error(`WebSocket connection ${connectionId} not found`);
                }
                const payload = typeof data === "string" ? data : JSON.stringify(data);
                connection.socket.send(payload);
            },
            async disconnect(connectionId: string): Promise<void> {
                const connection = connections.get(connectionId);
                if (!connection) {
                    throw new Error(`WebSocket connection ${connectionId} not found`);
                }
                connection.socket.close();
            },
        };

        app.decorate('websockets', manager);
    });
