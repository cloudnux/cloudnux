import { CloudProvider } from "@cloudnux/core-cloud-provider";

import { createLocalEventBrokerService } from "./services/event-broker";
import { createLocalStorageService } from "./services/storage";
import { createLocalLocationService } from "./services/locations";
import { createLocalFunctionsService } from "./services/functions";

export const localCloudProvider: CloudProvider = {
    name: "local-cloud-provider",

    createStorageService: createLocalStorageService,
    createLocationService: createLocalLocationService,
    createEventBrokerService: createLocalEventBrokerService,
    createFunctionsService: createLocalFunctionsService
};