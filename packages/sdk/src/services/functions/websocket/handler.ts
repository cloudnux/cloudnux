import { WebSocketFunctionContext } from "@cloudnux/core-cloud-provider";

import { cloudFunctions } from "../cloud-functions";
import { cloudLogger } from "../../logger";
import { createWebSocketContext } from "./create-websocket-context";

type Handler = (context: WebSocketFunctionContext) => Promise<void> | void;

export async function websocketHandler(handler: Handler, ...args: any[]) {
    const log = cloudLogger();
    try {
        log.debug({ args }, "Executing WebSocket handler with args");
        const [wsRequest] = cloudFunctions().createWebSocketRequest(...args);
        log.setBindings({ reqId: wsRequest.requestId ?? "", module: wsRequest.moduleName ?? "" });
        log.debug({
            request: wsRequest,
        }, "Created WebSocket request");
        const context = createWebSocketContext(wsRequest, log);
        await handler(context);
        log.debug({ response: context.response }, "WebSocket Handler executed successfully, building response");
        return cloudFunctions().buildWebSocketResponse(context, ...args);
    }
    catch (error) {
        log.error(error as any);
        throw error;
    }
}
