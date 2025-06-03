import { LocationService } from "@cloudnux/core-cloud-provider";

import { getCloudProvider } from "../provider";

let _cloudLocationService: LocationService | null = null;

export const cloudLocations = () => {
    if (_cloudLocationService) {
        return _cloudLocationService;
    }
    _cloudLocationService = getCloudProvider().createLocationService();
    return _cloudLocationService;
}