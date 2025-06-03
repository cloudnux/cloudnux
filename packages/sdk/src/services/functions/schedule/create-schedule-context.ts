import { ScheduleFunctionContext, ScheduleRequest, ScheduleResponse } from "@cloudnux/core-cloud-provider";

export function createScheduleContext(request: ScheduleRequest): ScheduleFunctionContext {
    const response: ScheduleResponse = {
        status: "error",
        body: null as any
    };

    return {
        type: "Schedule",
        request,
        response,
        success: (body?: any) => {
            response.status = "success";
            response.body = body;
        },

        error: (body?: any) => {
            response.status = "error";
            response.body = body;
        },
        notFound: (body?: any) => {
            response.status = "error";
            response.body = body;
        }
    }
}