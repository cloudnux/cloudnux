import { CloudProvider, ServiceKind, IService, registerServices, LoggerService, EventBrokerService, StorageService, LocationService, FunctionsService, WebSocketService, InvokeService, EmailService } from "@cloudnux/core-cloud-provider";
import { cloudLogger, resetCloudLogger } from "./services/logger";
import { cloudEventBroker, resetCloudEventBroker } from "./services/event-broker";
import { cloudStorage, resetCloudStorage } from "./services/storage";
import { cloudLocations, resetCloudLocations } from "./services/locations";
import { cloudFunctions, resetCloudFunctions } from "./services/functions/cloud-functions";
import { cloudWebSocket, resetCloudWebSocket } from "./services/websocket";
import { cloudInvoke, resetCloudInvoke } from "./services/invoke";
import { cloudEmail, resetCloudEmail } from "./services/email";

export type CloudProviderOptions = {
    serviceFactories?: Partial<Record<ServiceKind, () => IService>>;
}

let provider: CloudProvider | null = null;

/**
 * Retrieves the current cloud provider instance.
 * @returns The current cloud provider instance.
 * @throws Will throw an error if the cloud provider is not set
 **/
export function getCloudProvider() {
    if (!provider) {
        throw new Error("Cloud provider is not defined. Please set a valid cloud provider using useProvider.");
    }
    return provider;
}

/**
 * Sets the cloud provider to be used by the SDK.
 * @param cloudProvider - The cloud provider instance to set.
 * @throws Will throw an error if the cloud provider is not provided
 **/
export function useCloudProvider(cloudProvider: CloudProvider, options?: CloudProviderOptions) {
    if (!cloudProvider) {
        throw new Error("Cloud provider is not defined. Please set a valid cloud provider using useProvider.");
    }
    const services = {
        "logger": cloudLogger,
        "event-broker": cloudEventBroker,
        "storage": cloudStorage,
        "location": cloudLocations,
        "functions": cloudFunctions,
        "websocket": cloudWebSocket,
        "invoke": cloudInvoke,
        "email": cloudEmail
    }
    registerServices(services);

    //==================================
    provider = {
        ...cloudProvider,
        createLoggerService: (options?.serviceFactories?.logger || cloudProvider.createLoggerService) as () => LoggerService,
        createEventBrokerService: (options?.serviceFactories?.["event-broker"] || cloudProvider.createEventBrokerService) as () => EventBrokerService,
        createStorageService: (options?.serviceFactories?.storage || cloudProvider.createStorageService) as () => StorageService,
        createLocationService: (options?.serviceFactories?.location || cloudProvider.createLocationService) as () => LocationService,
        createFunctionsService: (options?.serviceFactories?.functions || cloudProvider.createFunctionsService) as () => FunctionsService,
        createWebSocketService: (options?.serviceFactories?.websocket || cloudProvider.createWebSocketService) as () => WebSocketService,
        createInvokeService: (options?.serviceFactories?.invoke || cloudProvider.createInvokeService) as () => InvokeService,
        createEmailService: (options?.serviceFactories?.email || cloudProvider.createEmailService) as () => EmailService,
    };

    resetCloudLogger();
    resetCloudEventBroker();
    resetCloudStorage();
    resetCloudLocations();
    resetCloudFunctions();
    resetCloudWebSocket();
    resetCloudInvoke();
    resetCloudEmail();
}