import { FastifyPluginOptions } from "fastify";
import { WebSocket } from "ws";

export type WebSocketEvent = "connect" | "disconnect" | "message";

export interface WebSocketConnection {
    connectionId: string;
    socket: WebSocket;
    path: string;
    connectedAt: Date;
}

export type WebSocketEventHandler = (connectionId: string, event: WebSocketEvent, data?: any) => Promise<any>;

export interface WebSocketRouteHandler {
    path: string;
    event: WebSocketEvent;
    route?: string;
    handler: WebSocketEventHandler;
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
    sendToClient(connectionId: string, data: any): Promise<void>;
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
