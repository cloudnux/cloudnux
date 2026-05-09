import { CloudProvider } from "@cloudnux/core-cloud-provider";
import "./logging/pretty-writer";

import { createLocalEventBrokerService } from "./services/event-broker";
import { createLocalStorageService } from "./services/storage";
import { createLocalLocationService } from "./services/locations";
import { createLocalFunctionsService } from "./services/functions";
import { createLocalWebSocketService } from "./services/websocket";

export const localCloudProvider: CloudProvider = {
    name: "local-cloud-provider",

    createStorageService: createLocalStorageService,
    createLocationService: createLocalLocationService,
    createEventBrokerService: createLocalEventBrokerService,
    createFunctionsService: createLocalFunctionsService,
    createWebSocketService: createLocalWebSocketService
};

export * from "./router";