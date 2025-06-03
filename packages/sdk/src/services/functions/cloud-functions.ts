import { FunctionsService } from "@cloudnux/core-cloud-provider"

import { getCloudProvider } from "../../provider";

let _cloudFunctionsService: FunctionsService | null = null;

export const cloudFunctions = () => {
    if (_cloudFunctionsService) {
        return _cloudFunctionsService;
    }
    _cloudFunctionsService = getCloudProvider().createFunctionsService();
    return _cloudFunctionsService;
}