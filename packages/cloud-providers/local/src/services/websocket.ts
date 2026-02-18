import { WebSocketService } from "@cloudnux/core-cloud-provider";
import { WebSocketManager } from "../websocket-plugin/types";

let _manager: WebSocketManager | null = null;

export function setWebSocketManager(manager: WebSocketManager) {
    _manager = manager;
}

export function createLocalWebSocketService(): WebSocketService {
    return {
        async sendToClient(connectionId: string, data: any): Promise<void> {
            if (!_manager) {
                throw new Error("WebSocket plugin not initialized");
            }
            return _manager.sendToClient(connectionId, data);
        }
    };
}
