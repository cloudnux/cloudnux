import { CloudProvider, IService } from "@cloudnux/core-cloud-provider";

import { createStorageService } from "./services/storage";
import { createLocationService } from "./services/location";
import { createLoggerService } from "./services/logger";
import { createEventBrokerService } from "./services/event-broker";
import { createEmailService } from "./services/email";

/**
 * Services land one at a time (see claude/azure-provider-plan.md in the project).
 * Until a service is implemented its factory throws, so a handler that needs it
 * fails loudly on first use instead of silently doing nothing. The SDK creates
 * services lazily, so unused stubs never throw.
 */
function notImplemented<T extends IService>(service: string): () => T {
    return () => {
        throw new Error(`The ${service} service is not implemented yet in @cloudnux/azure-cloud-provider.`);
    };
}

export const azureCloudProvider: CloudProvider = {
    name: "azure-cloud-provider",

    createStorageService: () => createStorageService(),
    createLocationService: () => createLocationService(),
    createEventBrokerService: () => createEventBrokerService(),
    createFunctionsService: notImplemented("functions"),
    createWebSocketService: notImplemented("websocket"),
    createInvokeService: notImplemented("invoke"),
    createLoggerService: () => createLoggerService(),
    createEmailService: () => createEmailService(),
};

export { createStorageService, createBlobServiceClient } from "./services/storage";
export { createLocationService, AzureMapsError } from "./services/location";
export { createEventBrokerService } from "./services/event-broker";
export { createEmailService } from "./services/email";
export { createLoggerService, runWithLogContext, enterLogContext, getLogContext } from "./services/logger";
export type { LogContext, InvocationLogger } from "./services/logger";
