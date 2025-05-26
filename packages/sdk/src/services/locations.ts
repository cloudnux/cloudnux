import { getCloudProvider } from "../provider";
export const cloudLocation = getCloudProvider().createLocationService();