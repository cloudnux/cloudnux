import { ScheduleFunctionContext, ScheduleRequest } from "@@types";

export function createScheduleContext(request: ScheduleRequest): ScheduleFunctionContext {
    const result = {
        status: 200,
        body: null as any,
    };

    const output = (status: number, body?: any): void => {
        result.status = status;
        result.body = body;
    };

    return {
        type: "Schedule",
        request,
        success: (body?: any) => {
            output(200, body);
        },
        error: (body?: any) => {
            output(500, body || "Internal Server Error");
        },
        notFound: (body?: any) => {
            output(404, body || "Resource Not Found");
        },
        output: () => result,
    };
}