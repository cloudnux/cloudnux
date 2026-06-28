import { LoggerService } from "@cloudnux/core-cloud-provider";

import { getCloudProvider } from "../provider";

let _loggingService: LoggerService | null = null;

export const cloudLogger = () => {
    if (_loggingService) {
        return _loggingService;
    }
    _loggingService = getCloudProvider().createLoggerService();
    return _loggingService;
}