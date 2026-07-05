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
        error(message: string, code?: ErrorCode) {
            response.status = "error";
            response.body = message;
            response.code = code;
        },
        serverError(err: Error) {
            response.status = "error";
            response.body = err;
            response.code = ErrorCode.UNKNOWN_ERROR;
        },
        notFound(resource: string, id?: string | number) {
            response.status = "error";
            response.code = ErrorCode.RESOURCE_NOT_FOUND;
            response.body = id ? `${resource} ${id} not found` : `${resource} not found`;
        }
    }
}
