import { EventResponse, EventFunctionContext, EventRequest } from "@cloudnux/core-cloud-provider";

export function createEventContext(request: EventRequest): EventFunctionContext {
    const response: EventResponse = {
        status: "success" as "success" | "error",
        body: {} as Record<string, any>
    };
    return {
        timestamp: request.timestamp || new Date(),
        attempts: request.attempts || 0,
        type: "Event" as const,
        response,
        request,
        message<T = Record<string, any>>() {
            if (typeof request.body === "string")
                return JSON.parse(request.body || "{}") as T
            return request.body as T
        },
        attributes<T = Record<string, any>>() {
            return request.attributes as T
        },

        retryWithDelay(seconds: number) {
            response.status = "error";
            response.retryDelay = seconds;
        },
        error(error?: any) {
            response.body = error;
            response.status = "error";
        },
        success(body?: any) {
            response.body = body;
            response.status = "success";
        },
        serverError(err: Error) {
            response.status = "error";
            response.body = err;
        },
        notFound(body?: any) {
            response.body = body || {};
            response.status = "error"; // Not found is treated as an error in this context
        }
    }
}