import { BaseEntry } from "./base";

export type WebSocketEvent = "connect" | "disconnect" | "message";

export type WebSocketTrigger = {
    type: "websocket",
    options: {
        path: string,
        event: WebSocketEvent,
        route?: string,
        routeKey?: string,
    }
}

export type WebSocketEntry = BaseEntry<WebSocketTrigger>;
