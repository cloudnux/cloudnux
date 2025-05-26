import { CloudProvider } from "@cloudnux/core-cloud-provider";

let provider: CloudProvider | null = null;

/**
 * Retrieves the current cloud provider instance.
 * @returns The current cloud provider instance.
 * @throws Will throw an error if the cloud provider is not set
 **/
export function getCloudProvider() {
    if (!provider) {
        throw new Error("Cloud provider is not defined. Please set a valid cloud provider using useProvider.");
    }
    return provider;
}

/**
 * Sets the cloud provider to be used by the SDK.
 * @param cloudProvider - The cloud provider instance to set.
 * @throws Will throw an error if the cloud provider is not provided
 **/
export function useCloudProvider(cloudProvider: CloudProvider) {
    if (!cloudProvider) {
        throw new Error("Cloud provider is not defined. Please set a valid cloud provider using useProvider.");
    }
    provider = cloudProvider;
}