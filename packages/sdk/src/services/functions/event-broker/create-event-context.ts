import { EventResponse, EventFunctionContext, EventRequest } from "@cloudnux/core-cloud-provider";

export function createEventContext({
    body,
    attributes,
    timestamp = new Date(),
    attempts = 0
}: EventRequest): EventFunctionContext {
    const response: EventResponse = {
        status: "success" as "success" | "error",
        body: {} as Record<string, any>
    };
    return {
        timestamp,
        attempts,
        type: "Event" as const,
        response,
        message<T = Record<string, any>>() {
            if (typeof body === "string")
                return JSON.parse(body || "{}") as T
            return body as T
        },
        attributes<T = Record<string, any>>() {
            return attributes as T
        },

        error(error?: any) {
            response.body = error;
            response.status = "error";
        },
        success(body?: any) {
            response.body = body;
            response.status = "success";
        },
        notFound(body?: any) {
            response.body = body || {};
            response.status = "error"; // Not found is treated as an error in this context
        }
    }
}