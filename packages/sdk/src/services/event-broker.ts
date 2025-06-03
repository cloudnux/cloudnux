import { EventBrokerService } from "@cloudnux/core-cloud-provider";

import { getCloudProvider } from "../provider";

let _cloudEventBroker: EventBrokerService | null = null;

export const cloudEventBroker = () => {
    if (_cloudEventBroker) {
        return _cloudEventBroker;
    }
    _cloudEventBroker = getCloudProvider().createEventBrokerService();
    return _cloudEventBroker;
}