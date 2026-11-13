import type { Coordinates } from '@cloudnux/core-cloud-provider';

import { haversineDistance } from '../../services/location-geo';

/** Unique per run, so tests only look at what they wrote and reruns don't collide. */
export const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Read after global-setup has loaded .env.live. */
export const liveEnv = {
    storageAccount: process.env.LIVE_STORAGE_ACCOUNT,
    storageContainer: process.env.LIVE_STORAGE_CONTAINER || 'test',

    serviceBusNamespace: process.env.LIVE_SERVICEBUS_NAMESPACE,
    queue: process.env.LIVE_SERVICEBUS_QUEUE || 'orders',
    topic: process.env.LIVE_SERVICEBUS_TOPIC || 'events',
    subscription: process.env.LIVE_SERVICEBUS_SUBSCRIPTION || 'billing',

    mapsEnabled: Boolean(process.env.AZURE_MAPS_KEY || process.env.AZURE_MAPS_CLIENT_ID),

    emailFrom: process.env.AZURE_COMMUNICATION_RESOURCE ? process.env.LIVE_EMAIL_FROM : undefined,
    emailTo: process.env.LIVE_EMAIL_TO,
};

/** Polls until fn returns a value, or throws after the timeout. */
export async function eventually<T>(
    fn: () => Promise<T | undefined>,
    { timeoutMs = 15_000, intervalMs = 500, what = 'condition' } = {}
): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const value = await fn();
        if (value !== undefined) return value;
        if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
}

export function distanceKm(a: Coordinates, b: Coordinates): number {
    return haversineDistance(a, b);
}

export const PLACES = {
    stockholm: { lat: 59.3293, lng: 18.0686 },
    drottninggatan10: { lat: 59.3326, lng: 18.0649 },
    arlanda: { lat: 59.6498, lng: 17.9238 },
    uppsala: { lat: 59.8586, lng: 17.6389 },
    oslo: { lat: 59.9139, lng: 10.7522 },
} satisfies Record<string, Coordinates>;
