import { WebSocketFunctionContext } from "@cloudnux/core-cloud-provider";
import { logger } from "@cloudnux/utils";

import { cloudFunctions } from "../cloud-functions";
import { createWebSocketContext } from "./create-websocket-context";

type Handler = (context: WebSocketFunctionContext) => Promise<void> | void;

export async function websocketHandler(handler: Handler, ...args: any[]) {
    try {
        logger.debug("Executing WebSocket handler with args", { args });
        const [wsRequest] = cloudFunctions().createWebSocketRequest(...args);
        logger.debug("Created WebSocket request", {
            request: wsRequest,
        });
        const context = createWebSocketContext(wsRequest);
        await handler(context);
        logger.debug("WebSocket Handler executed successfully, building response", { response: context.response });
        return cloudFunctions().buildWebSocketResponse(context, ...args);
    }
    catch (error) {
        logger.error("Error in WebSocket handler", { error });
        throw error;
    }
}
