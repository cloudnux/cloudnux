import crypto from "node:crypto";

import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";
import websocketPlugin from "@fastify/websocket";

import {
    WebSocketPluginOptions,
    WebSocketConfig,
    WebSocketConnection,
    WebSocketRouteHandler,
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

        // Register @fastify/websocket
        await app.register(websocketPlugin);

        // Register WebSocket route for a path when first handler uses it
        function ensureRouteForPath(path: string) {
            if (registeredPaths.has(path)) return;
            registeredPaths.add(path);

            app.get(path, { websocket: true }, (socket) => {
                const connectionId = crypto.randomUUID();
                const connection: WebSocketConnection = {
                    connectionId,
                    socket,
                    path,
                    connectedAt: new Date(),
                };
                connections.set(connectionId, connection);

                // Filter handlers for this path at runtime so late-registered handlers are included
                const pathHandlers = () => handlers.filter(h => h.path === path);

                // Fire connect handlers
                const connectHandlers = pathHandlers().filter(h => h.event === "connect");
                for (const h of connectHandlers) {
                    h.handler(connectionId, "connect").catch(() => { });
                }

                // Handle incoming messages
                socket.on("message", (raw) => {
                    const data = raw.toString();

                    const currentHandlers = pathHandlers();

                    // Try to match a specific route handler
                    const routeKey = typeof data === "object" && data !== null
                        ? data[config.routeKeyField]
                        : undefined;

                    let matched = false;
                    if (routeKey) {
                        const routeHandlers = currentHandlers.filter(
                            h => h.event === "message" && h.route === routeKey
                        );
                        for (const h of routeHandlers) {
                            matched = true;
                            h.handler(connectionId, "message", data).catch(() => { });
                        }
                    }

                    // Fall back to default message handlers (no route)
                    if (!matched) {
                        const defaultHandlers = currentHandlers.filter(
                            h => h.event === "message" && !h.route
                        );
                        for (const h of defaultHandlers) {
                            h.handler(connectionId, "message", data).catch(() => { });
                        }
                    }
                });

                // Handle disconnect
                socket.on("close", () => {
                    const disconnectHandlers = pathHandlers().filter(h => h.event === "disconnect");
                    for (const h of disconnectHandlers) {
                        h.handler(connectionId, "disconnect").catch(() => { });
                    }
                    connections.delete(connectionId);
                });
            });
        }

        // Create manager with eager route registration
        const manager = {
            registerHandler(handler: WebSocketRouteHandler) {
                handlers.push(handler);
                ensureRouteForPath(handler.path);
            },
            getConnections(path?: string): WebSocketConnection[] {
                const allConnections = Array.from(connections.values());
                if (path) {
                    return allConnections.filter(c => c.path === path);
                }
                return allConnections;
            },
            async sendToClient(connectionId: string, data: any): Promise<void> {
                const connection = connections.get(connectionId);
                if (!connection) {
                    throw new Error(`WebSocket connection ${connectionId} not found`);
                }
                const payload = typeof data === "string" ? data : JSON.stringify(data);
                connection.socket.send(payload);
            },
        };

        app.decorate('websockets', manager);
    });
