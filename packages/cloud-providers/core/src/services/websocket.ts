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
