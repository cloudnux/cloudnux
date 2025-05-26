import { getCloudProvider } from "../../provider";
export const cloudFunctions = getCloudProvider().createFunctionsService();