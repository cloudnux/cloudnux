import { StorageService } from "@cloudnux/core-cloud-provider";

import { getCloudProvider } from "../provider";

let _cloudStorageService: StorageService | null = null;

export const cloudStorage = () => {
    if (_cloudStorageService) {
        return _cloudStorageService;
    }
    _cloudStorageService = getCloudProvider().createStorageService();
    return _cloudStorageService;
}