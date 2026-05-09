import { ApiGatewayManagementApiClient, PostToConnectionCommand, DeleteConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { WebSocketService } from "@cloudnux/core-cloud-provider";
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

export function createAwsWebSocketService(): WebSocketService {
    return {
        async sendToClient(connectionId: string, data: any): Promise<void> {
            const client = getClient();
            const payload = typeof data === "string" ? data : JSON.stringify(data);
            await client.send(new PostToConnectionCommand({
                ConnectionId: connectionId,
                Data: new TextEncoder().encode(payload),
            }));
        },
        async disconnect(connectionId: string): Promise<void> {
            const client = getClient();
            await client.send(new DeleteConnectionCommand({ ConnectionId: connectionId }));
        },
    };
}
