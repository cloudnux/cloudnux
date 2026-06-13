import { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { WebSocketConnectionGoneError, WebSocketService } from "@cloudnux/core-cloud-provider";
import { env } from "@cloudnux/utils";

let _client: ApiGatewayManagementApiClient | null = null;

function getClient(endpoint?: string): ApiGatewayManagementApiClient {
    if (!_client) {
        _client = new ApiGatewayManagementApiClient({
            endpoint: endpoint || env("WEBSOCKET_API_ENDPOINT"),
        });
    }
    return _client;
}

function isGoneException(error: unknown): boolean {
    return error instanceof Error && error.name === "GoneException";
}

export function createWebSocketService(): WebSocketService {
    return {
        async sendToClient(connectionId: string, data: any): Promise<void> {
            const client = getClient();
            const payload = typeof data === "string" ? data : JSON.stringify(data);
            try {
                await client.send(new PostToConnectionCommand({
                    ConnectionId: connectionId,
                    Data: new TextEncoder().encode(payload),
                }));
            } catch (error) {
                if (isGoneException(error)) {
                    throw new WebSocketConnectionGoneError(connectionId);
                }
                throw error;
            }
        },
        async disconnect(connectionId: string): Promise<void> {
            const client = getClient();
            try {
                await client.send(new DeleteConnectionCommand({ ConnectionId: connectionId }));
            } catch (error) {
                if (isGoneException(error)) {
                    throw new WebSocketConnectionGoneError(connectionId);
                }
                throw error;
            }
        },
    };
}
