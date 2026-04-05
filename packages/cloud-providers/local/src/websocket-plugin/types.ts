import { FastifyPluginOptions, FastifyReply, FastifyRequest } from "fastify";
import { WebSocket } from "ws";

export type WebSocketEvent = "connect" | "disconnect" | "message";

export interface WebSocketConnection {
    connectionId: string;
    socket: WebSocket;
    path: string;
    connectedAt: Date;
}

export type WebSocketEventHandler = (connectionId: string, event: WebSocketEvent, data: any | null, request: FastifyRequest, reply?: FastifyReply) => Promise<any>;

export interface WebSocketRouteHandler {
    path: string;
    event: WebSocketEvent;
    route?: string;
    module?: string;
    handler: WebSocketEventHandler;
}

export interface RegisteredWebSocketPath {
    path: string;
    module?: string;
}

export interface WebSocketConfig {
    routeKeyField: string;
}

export interface WebSocketPluginOptions extends FastifyPluginOptions {
    prefix?: string;
    config?: Partial<WebSocketConfig>;
}

export interface WebSocketManager {
    registerHandler(handler: WebSocketRouteHandler): void;
    getConnections(path?: string): WebSocketConnection[];
    getRegisteredPaths(module?: string): RegisteredWebSocketPath[];
    sendToClient(connectionId: string, data: any): Promise<void>;
    disconnect(connectionId: string): Promise<void>;
}

export interface WebSocketDecoratorOptions {
    connections: Map<string, WebSocketConnection>;
    handlers: WebSocketRouteHandler[];
    config: WebSocketConfig;
}

// Type declaration for Fastify instance
declare module 'fastify' {
    interface FastifyInstance {
        websockets: WebSocketManager;
    }
}
