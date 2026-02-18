import { WebSocketService } from "@cloudnux/core-cloud-provider";

import { getCloudProvider } from "../provider";

let _cloudWebSocket: WebSocketService | null = null;

export const cloudWebSocket = () => {
    if (_cloudWebSocket) {
        return _cloudWebSocket;
    }
    _cloudWebSocket = getCloudProvider().createWebSocketService();
    return _cloudWebSocket;
}
