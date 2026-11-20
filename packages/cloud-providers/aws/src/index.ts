import { CloudProvider } from "@cloudnux/core-cloud-provider";

import { createEventBrokerService } from "./services/event-broker";
import { createStorageService } from "./services/storage";
import { createLocationService } from "./services/locations";
import { createFunctionsService } from "./services/functions";
import { createWebSocketService } from "./services/websocket";
import { createInvokeService } from "./services/invoke";
import { createLoggerService } from "./services/logger";
import { createEmailService } from "./services/email";
import { createSecretsService } from "./services/secrets";

export const awsCloudProvider: CloudProvider = {
    name: "aws-cloud-provider",

    createStorageService,
    createLocationService,
    createEventBrokerService,
    createFunctionsService,
    createWebSocketService,
    createInvokeService,
    createLoggerService,
    createEmailService,
    createSecretsService,
};
export { setCurrentModule } from "./services/invoke";
export { SECRETS_STORE_ENV, type AwsSecretsStore } from "./services/secrets";
