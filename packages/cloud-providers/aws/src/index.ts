import { CloudProvider } from "@cloudnux/core-cloud-provider";

import { createEventBrokerService } from "./services/event-broker";
import { createStorageService } from "./services/storage";
import { createLocationService } from "./services/locations";
import { createLocalFunctionsService } from "./services/functions";

export const awsCloudProvider: CloudProvider = {
    name: "aws-cloud-provider",

    createStorageService,
    createLocationService,
    createEventBrokerService,
    createFunctionsService: createLocalFunctionsService
};