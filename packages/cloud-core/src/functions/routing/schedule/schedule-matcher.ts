import { FunctionContext, HandlerType, ScheduleFunctionContext } from "@@types"

export const scheduleMatcher = (name: string) =>
    (handlerType: HandlerType, event?: any) => {
        // Ensure the handler type is "Schedule"
        if (handlerType !== "Schedule")
            return false;

        // Ensure the event contains the schedule name
        const scheduleName = event?.source === "aws.events" ? event?.resources?.[0]?.split("/").pop() : null;

        if (!scheduleName) {
            return false;
        }

        // Check if the schedule name matches
        return name.toLowerCase() === scheduleName.toLowerCase();

    };