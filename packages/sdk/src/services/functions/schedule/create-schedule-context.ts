import { ScheduleFunctionContext, ScheduleRequest, ScheduleResponse, LoggerService } from "@cloudnux/core-cloud-provider";

export function createScheduleContext(request: ScheduleRequest, logger: LoggerService): ScheduleFunctionContext {
    const response: ScheduleResponse = {
        status: "error",
        body: null as any
    };

    return {
        type: "Schedule",
        request,
        response,
        logger,
        success: (body?: any) => {
            response.status = "success";
            response.body = body;
        },

        error: (body?: any) => {
            response.status = "error";
            response.body = body;
        },
        serverError(err: Error) {
            response.status = "error";
            response.body = err;
        },
        notFound: (body?: any) => {
            response.status = "error";
            response.body = body;
        }
    }
}