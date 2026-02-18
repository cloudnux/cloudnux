import { WebSocketFunctionContext, WebSocketRequest, WebSocketResponse } from "@cloudnux/core-cloud-provider";

export function createWebSocketContext(request: WebSocketRequest): WebSocketFunctionContext {
    const response: WebSocketResponse = {
        status: "success",
        body: {} as any
    };

    return {
        type: "WebSocket" as const,
        connectionId: request.connectionId,
        event: request.event,
        request,
        response,
        message<T = Record<string, any>>() {
            if (typeof request.body === "string")
                return JSON.parse(request.body || "{}") as T;
            return (request.body ?? {}) as T;
        },
        success(body?: any) {
            response.status = "success";
            response.body = body;
        },
        error(error?: any) {
            response.status = "error";
            response.body = error;
        },
        notFound(body?: any) {
            response.status = "error";
            response.body = body;
        }
    };
}
