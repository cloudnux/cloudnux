import { ScheduleFunctionContext, ScheduleRequest, ScheduleResponse } from "@cloudnux/core-cloud-provider";

export function createScheduleContext(request: ScheduleRequest): ScheduleFunctionContext {
    const response: ScheduleResponse = {
        status: 200,
        body: null as any
    };

    return {
        type: "Schedule",
        request,
        response,
        success: (body?: any) => {
            response.status = 200;
            response.body = body;
        },

        error: (body?: any) => {
            response.status = 500;
            response.body = body;
        },
        notFound: (body?: any) => {
            response.status = 404;
            response.body = body;
        }
    }
}