export type ProviderKey = 'aws' | 'azure' | 'gcp';

export interface ProviderDefinition {
    label: string;
    available: boolean;
    /** The @cloudnux/*-cloud-provider package this provider deploys through. */
    packageName: string;
}

export const PROVIDERS: Record<ProviderKey, ProviderDefinition> = {
    aws: { label: 'AWS', available: true, packageName: '@cloudnux/aws-cloud-provider' },
    // TODO: flip to true once @cloudnux/azure-cloud-provider ships
    azure: { label: 'Azure', available: false, packageName: '@cloudnux/azure-cloud-provider' },
    // TODO: flip to true once @cloudnux/gcp-cloud-provider ships
    gcp: { label: 'GCP', available: false, packageName: '@cloudnux/gcp-cloud-provider' }
};

export function availableProviders(): ProviderKey[] {
    return (Object.keys(PROVIDERS) as ProviderKey[]).filter(key => PROVIDERS[key].available);
}

export function isAvailableProvider(value: string): value is ProviderKey {
    return availableProviders().includes(value as ProviderKey);
}
