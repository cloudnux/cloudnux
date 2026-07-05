import { CloudProvider } from "@cloudnux/core-cloud-provider";

import { createLocalEventBrokerService } from "./services/event-broker";
import { createLocalStorageService } from "./services/storage";
import { createLocalLocationService } from "./services/locations";
import { createLocalFunctionsService } from "./services/functions";
import { createLocalWebSocketService } from "./services/websocket";
import { createLocalInvokeService } from "./services/invoke";
import { createLocalLoggerService } from "./services/logger";

export const localCloudProvider: CloudProvider = {
    name: "local-cloud-provider",

    createStorageService: createLocalStorageService,
    createLocationService: createLocalLocationService,
    createEventBrokerService: createLocalEventBrokerService,
    createFunctionsService: createLocalFunctionsService,
    createWebSocketService: createLocalWebSocketService,
    createInvokeService: createLocalInvokeService,
    createLoggerService: createLocalLoggerService,
};

export * from "./router";