import { EventBrokerService } from "./services/event-broker";
import { LocationService } from "./services/location";
import { StorageService } from "./services/storage";
import { FunctionsService } from "./services/functions";
import { WebSocketService } from "./services/websocket";

export interface CloudProvider {
    name: string;

    // Service factories
    createStorageService(): StorageService;
    createLocationService(): LocationService;
    createEventBrokerService(): EventBrokerService;
    createFunctionsService(): FunctionsService;
    createWebSocketService(): WebSocketService;
}