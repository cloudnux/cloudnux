import { ErrorCode, WebSocketFunctionContext, WebSocketRequest, WebSocketResponse, LoggerService } from "@cloudnux/core-cloud-provider";

export function createWebSocketContext(request: WebSocketRequest, logger: LoggerService): WebSocketFunctionContext {
    const response: WebSocketResponse = {
        status: "success",
        body: {} as any,
        statusCode: 101,
    };

    const reject = (statusCode: number, body?: any) => {
        response.status = "error";
        response.statusCode = statusCode;
        response.body = body;
    };

    return {
        type: "WebSocket" as const,
        connectionId: request.connectionId,
        event: request.event,
        request,
        response,
        logger,
        message<T = Record<string, any>>() {
            if (typeof request.body === "string")
                return JSON.parse(request.body || "{}") as T;
            return (request.body ?? {}) as T;
        },
        params<T = Record<string, string>>() {
            return {
                ...request.params || {},
                ...request.queryString || {},
            } as T;
        },
        success(body?: any) {
            response.status = "success";
            response.body = body;
        },
        error(message: string, code?: ErrorCode, details?: Record<string, any>) {
            reject(500, { message, code, details });
        },
        serverError(err: Error) {
            reject(500, { message: err.message, code: ErrorCode.UNKNOWN_ERROR });
        },
        notFound(resource: string, id?: string | number) {
            const message = id
                ? `${resource} with ID ${id} was not found`
                : `${resource} not found`;
            reject(404, { message });
        },
        unauthorized(body?: any) {
            reject(401, body);
        },
        forbidden(body?: any) {
            reject(403, body);
        },
        validationError(details: Record<string, any>) {
            reject(400, { message: 'Validation failed', details });
        },
    };
}
