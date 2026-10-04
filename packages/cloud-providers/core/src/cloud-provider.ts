import { EventBrokerService } from "./services/event-broker";
import { LocationService } from "./services/location";
import { StorageService } from "./services/storage";
import { FunctionsService } from "./services/functions";
import { WebSocketService } from "./services/websocket";
import { InvokeService } from "./services/invoke";
import { LoggerService } from "./services/logger";
import { EmailService } from "./services/email";

export interface CloudProvider {
    name: string;

    // Service factories
    createStorageService(): StorageService;
    createLocationService(): LocationService;
    createEventBrokerService(): EventBrokerService;
    createFunctionsService(): FunctionsService;
    createWebSocketService(): WebSocketService;
    createInvokeService(): InvokeService;
    createLoggerService(): LoggerService;
    createEmailService(): EmailService;
}