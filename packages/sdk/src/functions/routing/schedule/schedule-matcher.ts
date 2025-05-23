import { FunctionContext, ScheduleFunctionContext } from "@@types"

export const scheduleMatcher = (name: string) =>
    (context: FunctionContext) => {
        // Is HTTP Context present
        if (context.type !== "Schedule")
            return false;

        const scheduleContext = context as ScheduleFunctionContext;

        // Does Method match
        if (
            name.toLowerCase() !==
            scheduleContext.request.name.toLowerCase())
            return false;

        // It does match, return true
        // set the match object as params
        return true;
    };