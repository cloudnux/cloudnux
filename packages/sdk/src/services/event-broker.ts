import { getCloudProvider } from "../provider";
export const cloudEventBroker = getCloudProvider().createEventBrokerService();