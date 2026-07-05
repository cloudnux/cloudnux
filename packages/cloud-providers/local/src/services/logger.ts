import { LoggerService } from "@cloudnux/core-cloud-provider";

import { logger } from "../logger";

export function createLocalLoggerService(): LoggerService {
    return logger;
}
