import { InvokeRequest, InvokeResponse, InvokeFunctionContext, ErrorCode, LoggerService } from "@cloudnux/core-cloud-provider";

export function createInvokeContext(request: InvokeRequest, logger: LoggerService): InvokeFunctionContext {
    const response: InvokeResponse = {
        status: "success",
    };
    return {
        type: "Invoke" as const,
        request,
        response,
        logger,
        payload<T = Record<string, any>>() {
            return request.payload as T;
        },
        success(data: any) {
            response.status = "success";
            response.body = data;
        },
        error(message: string, code?: ErrorCode | string, details?: Record<string, any>) {
            response.status = "error";
            response.body = message;
            response.code = code;
            response.details = details;
        },
        serverError(err: Error) {
            response.status = "error";
            // an Error object serializes to {} — keep the message
            response.body = err?.message ?? String(err);
            response.code = ErrorCode.UNKNOWN_ERROR;
        },
        notFound(resource: string, id?: string | number) {
            response.status = "error";
            response.code = ErrorCode.RESOURCE_NOT_FOUND;
            response.body = id ? `${resource} ${id} not found` : `${resource} not found`;
        }
    }
}
