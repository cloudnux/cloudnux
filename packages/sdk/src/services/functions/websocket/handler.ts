import { WebSocketFunctionContext } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createWebSocketContext } from "./create-websocket-context";

type Handler = (context: WebSocketFunctionContext) => Promise<void> | void;

export async function websocketHandler(handler: Handler, ...args: any[]) {
    try {
        logger.debug({ args }, "Executing WebSocket handler with args");
        const [wsRequest] = cloudFunctions().createWebSocketRequest(...args);
        logger.debug({
            request: wsRequest,
        }, "Created WebSocket request");
        const context = createWebSocketContext(wsRequest);
        await handler(context);
        logger.debug({ response: context.response }, "WebSocket Handler executed successfully, building response");
        return cloudFunctions().buildWebSocketResponse(context, ...args);
    }
    catch (error) {
        logger.error(error as any);
        throw error;
    }
}
