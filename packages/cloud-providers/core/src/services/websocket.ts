/**
 * Thrown when a sendToClient/disconnect is attempted against a connectionId
 * that is no longer connected (AWS API Gateway GoneException equivalent, HTTP 410).
 */
export class WebSocketConnectionGoneError extends Error {
    public readonly connectionId: string;

    constructor(connectionId: string) {
        super(`WebSocket connection ${connectionId} is gone`);
        this.name = "WebSocketConnectionGoneError";
        this.connectionId = connectionId;
    }
}

export interface WebSocketService {
    /**
     * Send a message to a specific connected client
     * @param connectionId The connection ID of the target client
     * @param data The data to send
     */
    sendToClient(connectionId: string, data: any): Promise<void>;

    /**
     * Disconnect a specific connected client
     * @param connectionId The connection ID of the client to disconnect
     */
    disconnect(connectionId: string): Promise<void>;
}
