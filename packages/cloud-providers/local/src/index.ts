import { CloudProvider } from "@cloudnux/core-cloud-provider";

import { createLocalEventBrokerService } from "./services/event-broker";
import { createLocalStorageService } from "./services/storage";
import { createLocalLocationService } from "./services/locations";
import { createLocalFunctionsService } from "./services/functions";
import { createLocalWebSocketService } from "./services/websocket";
import { createLocalInvokeService } from "./services/invoke";
import { createLocalLoggerService } from "./services/logger";
import { createLocalEmailService } from "./services/email";

export const localCloudProvider: CloudProvider = {
    name: "local-cloud-provider",

    createStorageService: createLocalStorageService,
    createLocationService: createLocalLocationService,
    createEventBrokerService: createLocalEventBrokerService,
    createFunctionsService: createLocalFunctionsService,
    createWebSocketService: createLocalWebSocketService,
    createInvokeService: createLocalInvokeService,
    createLoggerService: createLocalLoggerService,
    createEmailService: createLocalEmailService,
};

export * from "./router";