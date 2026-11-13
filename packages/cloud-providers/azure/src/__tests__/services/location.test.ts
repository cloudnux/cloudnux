import { describe, expect, it, vi } from 'vitest';
import type { TokenCredential } from '@azure/identity';

import {
    AzureMapsError,
    createLocationService,
    decodePlaceToken,
    encodePlaceToken,
    mapPlaceType,
    toAlpha2,
    toAlpha3,
} from '../../services/location';
import { haversineDistance, paddedBbox, sampleRoutePoints } from '../../services/location-geo';

// ---------------------------------------------------------------------------
// Fixtures: shapes follow the Azure Maps REST reference samples
// ---------------------------------------------------------------------------

const autocompleteResponse = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            geometry: null,
            properties: {
                typeGroup: 'Address',
                type: 'Address',
                address: {
                    addressLine: 'Drottninggatan 10',
                    streetName: 'Drottninggatan',
                    streetNumber: '10',
                    locality: 'Stockholm',
                    postalCode: '111 51',
                    countryRegion: { ISO: 'SE', name: 'Sweden' },
                    formattedAddress: 'Drottninggatan 10, 111 51 Stockholm',
                },
            },
        },
        {
            type: 'Feature',
            geometry: null,
            properties: {
                typeGroup: 'Place',
                type: 'PopulatedPlace',
                name: 'Stockholm',
                address: {
                    locality: 'Stockholm',
                    adminDistricts: [{ name: 'Stockholm County', shortName: 'AB' }],
                    countryRegion: { ISO: 'SE', name: 'Sweden' },
                    formattedAddress: 'Stockholm, Stockholm County',
                },
            },
        },
        {
            type: 'Feature',
            geometry: null,
            properties: {
                typeGroup: 'Place',
                type: 'PopulatedPlace',
                name: 'Stockton',
                address: { countryRegion: { ISO: 'US', name: 'United States' }, formattedAddress: 'Stockton, California' },
            },
        },
    ],
};

const geocodeFeature = {
    type: 'Feature',
    properties: {
        type: 'Address',
        confidence: 'High',
        address: {
            addressLine: 'Drottninggatan 10',
            streetName: 'Drottninggatan',
            streetNumber: '10',
            locality: 'Stockholm',
            neighborhood: 'Norrmalm',
            postalCode: '111 51',
            adminDistricts: [{ name: 'Stockholm County', shortName: 'AB' }, { name: 'Stockholm' }],
            countryRegion: { ISO: 'SE', name: 'Sweden' },
            formattedAddress: 'Drottninggatan 10, 111 51 Stockholm',
        },
        geocodePoints: [{ geometry: { type: 'Point', coordinates: [18.0649, 59.3326] }, usageTypes: ['Display'] }],
    },
    geometry: { type: 'Point', coordinates: [18.0649, 59.3326] },
};

const routeResponse = {
    type: 'FeatureCollection',
    features: [
        { type: 'Feature', geometry: { type: 'Point', coordinates: [18.06, 59.33] }, properties: { type: 'Waypoint' } },
        {
            type: 'Feature',
            geometry: {
                type: 'MultiLineString',
                coordinates: [[[18.06, 59.33], [18.0, 59.3], [17.9, 59.2], [17.6, 59.0], [17.5, 58.9]]],
            },
            properties: {
                type: 'RoutePath',
                distanceInMeters: 60000,
                durationInSeconds: 3000,
                legs: [
                    { distanceInMeters: 25000, durationInSeconds: 1200, routePathRange: { legIndex: 0, range: [0, 2] } },
                    { distanceInMeters: 35000, durationInSeconds: 1800, routePathRange: { legIndex: 1, range: [2, 4] } },
                ],
            },
        },
    ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function mockFetch(...responses: Response[]) {
    const fn = vi.fn<typeof fetch>();
    for (const r of responses) fn.mockResolvedValueOnce(r);
    return fn;
}

function call(fn: ReturnType<typeof mockFetch>, i = 0) {
    const [input, init] = fn.mock.calls[i];
    const url = new URL(String(input));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    return { url, init: init!, headers, body: init?.body ? JSON.parse(String(init.body)) : undefined };
}

const keyed = (fetchFn: typeof fetch) =>
    createLocationService({ apiKey: 'test-key', retryAttempts: 0 }, { fetch: fetchFn });

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe('country codes', () => {
    it('converts between alpha-3 and alpha-2', () => {
        expect(toAlpha2('SWE')).toBe('SE');
        expect(toAlpha2('deu')).toBe('DE');
        expect(toAlpha2('SE')).toBe('SE');
        expect(toAlpha3('SE')).toBe('SWE');
        expect(toAlpha3('de')).toBe('DEU');
        expect(toAlpha3(undefined)).toBeUndefined();
    });
});

describe('mapPlaceType', () => {
    it.each([
        ['Address', 'address'],
        ['RoadBlock', 'street'],
        ['PopulatedPlace', 'locality'],
        ['CountryRegion', 'country'],
        ['Museum', 'poi'],
        [undefined, 'place'],
    ])('%s -> %s', (input, expected) => {
        expect(mapPlaceType(input)).toBe(expected);
    });
});

describe('placeId token', () => {
    it('round-trips a structured address', () => {
        const token = encodePlaceToken(autocompleteResponse.features[0] as never)!;
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // url-safe
        expect(decodePlaceToken(token)).toEqual({
            v: 1,
            a: { addressLine: 'Drottninggatan 10', locality: 'Stockholm', postalCode: '111 51', countryRegion: 'SE' },
        });
    });

    it('uses a free-text query for places', () => {
        const token = encodePlaceToken(autocompleteResponse.features[1] as never)!;
        expect(decodePlaceToken(token)).toEqual({ v: 1, q: 'Stockholm, Stockholm County' });
    });

    it('rejects garbage', () => {
        expect(() => decodePlaceToken('not-a-token')).toThrow('Invalid Azure Maps placeId');
    });
});

describe('route geometry', () => {
    const line = [{ lat: 59.33, lng: 18.06 }, { lat: 59.0, lng: 17.6 }, { lat: 58.0, lng: 15.0 }];

    it('haversine is roughly right (Stockholm -> Gothenburg ~ 398 km)', () => {
        expect(haversineDistance({ lat: 59.3293, lng: 18.0686 }, { lat: 57.7089, lng: 11.9746 })).toBeCloseTo(398, -1);
    });

    it('samples include origin and destination', () => {
        const points = sampleRoutePoints(line, 10);
        expect(points[0]).toMatchObject({ ...line[0], distanceFromStartKm: 0 });
        expect(points[points.length - 1]).toMatchObject(line[2]);
    });

    it('bbox is [minLng, minLat, maxLng, maxLat] with 10% padding', () => {
        const [minLng, minLat, maxLng, maxLat] = paddedBbox(line);
        expect(minLng).toBeCloseTo(15.0 - 0.306);
        expect(maxLat).toBeCloseTo(59.33 + 0.133);
        expect(minLat).toBeLessThan(58.0);
        expect(maxLng).toBeGreaterThan(18.06);
    });
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

describe('getSuggestions', () => {
    it('calls autocomplete with alpha-2 country, lng,lat bias and language', async () => {
        const fetchFn = mockFetch(jsonResponse(autocompleteResponse));
        await keyed(fetchFn).getSuggestions({ query: 'Drott', biasPosition: { lat: 59.33, lng: 18.06 }, language: 'sv' });

        const { url, headers, init } = call(fetchFn);
        expect(init.method).toBe('GET');
        expect(url.origin + url.pathname).toBe('https://atlas.microsoft.com/geocode:autocomplete');
        expect(url.searchParams.get('api-version')).toBe('2026-01-01');
        expect(url.searchParams.get('query')).toBe('Drott');
        expect(url.searchParams.get('coordinates')).toBe('18.06,59.33');
        expect(url.searchParams.get('countryRegion')).toBe('SE');
        expect(url.searchParams.get('top')).toBe('5');
        expect(headers['subscription-key']).toBe('test-key');
        expect(headers['Accept-Language']).toBe('sv');
    });

    it('falls back to the default centre when no bias is given', async () => {
        const fetchFn = mockFetch(jsonResponse(autocompleteResponse));
        await keyed(fetchFn).getSuggestions({ query: 'Stock' });
        expect(call(fetchFn).url.searchParams.get('coordinates')).toBe('15,58');
    });

    it('maps features to suggestions without coordinates but with a placeId', async () => {
        const fetchFn = mockFetch(jsonResponse(autocompleteResponse));
        const [address, place] = await keyed(fetchFn).getSuggestions({ query: 'Stock', countries: ['SWE', 'USA'] });

        expect(address).toMatchObject({
            title: 'Drottninggatan 10',
            subtitle: 'Drottninggatan 10, 111 51 Stockholm',
            coordinates: undefined,
            placeType: 'address',
            provider: 'azure',
        });
        expect(address.placeId).toBeTruthy();
        expect(place).toMatchObject({ title: 'Stockholm', subtitle: 'Stockholm, Stockholm County', placeType: 'locality' });
    });

    it('filters several countries client-side', async () => {
        const fetchFn = mockFetch(jsonResponse(autocompleteResponse));
        const results = await keyed(fetchFn).getSuggestions({ query: 'Stock', countries: ['SWE', 'NOR'] });

        expect(call(fetchFn).url.searchParams.has('countryRegion')).toBe(false);
        expect(call(fetchFn).url.searchParams.get('top')).toBe('20');
        expect(results.map(r => r.title)).toEqual(['Drottninggatan 10', 'Stockholm']);
    });

    it('filters placeTypes and respects maxResults', async () => {
        const fetchFn = mockFetch(jsonResponse(autocompleteResponse));
        const results = await keyed(fetchFn).getSuggestions({ query: 'Stock', countries: ['SWE', 'USA'], placeTypes: ['locality'], maxResults: 1 });
        expect(results.map(r => r.title)).toEqual(['Stockholm']);
    });
});

describe('getLocationDetails', () => {
    it('geocodes a structured-address token and returns full details', async () => {
        const suggestFetch = mockFetch(jsonResponse(autocompleteResponse));
        const [suggestion] = await keyed(suggestFetch).getSuggestions({ query: 'Drott' });

        const fetchFn = mockFetch(jsonResponse({ type: 'FeatureCollection', features: [geocodeFeature] }));
        const details = await keyed(fetchFn).getLocationDetails!(suggestion.placeId!);

        const { url } = call(fetchFn);
        expect(url.pathname).toBe('/geocode');
        expect(url.searchParams.get('addressLine')).toBe('Drottninggatan 10');
        expect(url.searchParams.get('locality')).toBe('Stockholm');
        expect(url.searchParams.get('countryRegion')).toBe('SE');
        expect(url.searchParams.has('query')).toBe(false);
        expect(url.searchParams.get('top')).toBe('1');

        expect(details).toEqual({
            fullAddress: 'Drottninggatan 10, 111 51 Stockholm',
            street: 'Drottninggatan',
            streetNumber: '10',
            city: 'Stockholm',
            district: 'Norrmalm',
            region: 'Stockholm County',
            postalCode: '111 51',
            country: 'Sweden',
            countryCode: 'SWE',
            coordinates: { lat: 59.3326, lng: 18.0649 },
            placeType: 'address',
            provider: 'azure',
            rawData: geocodeFeature,
        });
    });

    it('geocodes a place token as a free-text query (no countryRegion, which the API forbids with query)', async () => {
        const suggestFetch = mockFetch(jsonResponse(autocompleteResponse));
        const [, place] = await keyed(suggestFetch).getSuggestions({ query: 'Stock', countries: ['SWE', 'USA'] });

        const fetchFn = mockFetch(jsonResponse({ type: 'FeatureCollection', features: [geocodeFeature] }));
        await keyed(fetchFn).getLocationDetails!(place.placeId!);

        const { url } = call(fetchFn);
        expect(url.searchParams.get('query')).toBe('Stockholm, Stockholm County');
        expect(url.searchParams.has('countryRegion')).toBe(false);
    });

    it('throws when nothing is found', async () => {
        const token = encodePlaceToken(autocompleteResponse.features[1] as never)!;
        const fetchFn = mockFetch(jsonResponse({ type: 'FeatureCollection', features: [] }));
        await expect(keyed(fetchFn).getLocationDetails!(token)).rejects.toThrow('Place not found');
    });
});

describe('reverseGeocode', () => {
    it('sends lng,lat and returns the queried coordinates', async () => {
        const fetchFn = mockFetch(jsonResponse({ type: 'FeatureCollection', features: [geocodeFeature] }));
        const coordinates = { lat: 59.3327, lng: 18.065 };
        const address = await keyed(fetchFn).reverseGeocode({ coordinates });

        const { url, headers } = call(fetchFn);
        expect(url.pathname).toBe('/reverseGeocode');
        expect(url.searchParams.get('coordinates')).toBe('18.065,59.3327');
        expect(headers['Accept-Language']).toBe('en');
        expect(address.coordinates).toEqual(coordinates);
        expect(address.countryCode).toBe('SWE');
        expect(address.fullAddress).toBe('Drottninggatan 10, 111 51 Stockholm');
    });

    it('throws when no address is found', async () => {
        const fetchFn = mockFetch(jsonResponse({ type: 'FeatureCollection', features: [] }));
        await expect(keyed(fetchFn).reverseGeocode({ coordinates: { lat: 0, lng: 0 } })).rejects.toThrow('No address found');
    });
});

describe('calculateRoute', () => {
    it('posts GeoJSON waypoints in order with toll avoidance', async () => {
        const fetchFn = mockFetch(jsonResponse(routeResponse));
        await keyed(fetchFn).calculateRoute(
            { lat: 59.33, lng: 18.06 },
            { lat: 58.9, lng: 17.5 },
            [{ lat: 59.2, lng: 17.9 }],
            true
        );

        const { url, init, headers, body } = call(fetchFn);
        expect(init.method).toBe('POST');
        expect(url.pathname).toBe('/route/directions');
        expect(url.searchParams.get('api-version')).toBe('2025-01-01');
        expect(headers['Content-Type']).toBe('application/geo+json');
        expect(body.features.map((f: { geometry: { coordinates: number[] }; properties: object }) => [f.geometry.coordinates, f.properties])).toEqual([
            [[18.06, 59.33], { pointIndex: 0, pointType: 'waypoint' }],
            [[17.9, 59.2], { pointIndex: 1, pointType: 'waypoint' }],
            [[17.5, 58.9], { pointIndex: 2, pointType: 'waypoint' }],
        ]);
        expect(body.travelMode).toBe('driving');
        expect(body.routeOutputOptions).toEqual(['routePath']);
        expect(body.avoid).toEqual(['tollRoads']);
    });

    it('omits avoid when tolls are allowed', async () => {
        const fetchFn = mockFetch(jsonResponse(routeResponse));
        await keyed(fetchFn).calculateRoute({ lat: 59.33, lng: 18.06 }, { lat: 58.9, lng: 17.5 });
        expect(call(fetchFn).body.avoid).toBeUndefined();
    });

    it('maps totals, legs, geometry, samples and bbox', async () => {
        const fetchFn = mockFetch(jsonResponse(routeResponse));
        const route = await keyed(fetchFn).calculateRoute({ lat: 59.33, lng: 18.06 }, { lat: 58.9, lng: 17.5 }, [{ lat: 59.2, lng: 17.9 }]);

        expect(route.totalDistanceKm).toBe(60);
        expect(route.totalDurationMinutes).toBe(50);
        expect(route.coordinates).toHaveLength(5);
        expect(route.coordinates[0]).toEqual({ lat: 59.33, lng: 18.06 });

        expect(route.legs).toHaveLength(2);
        expect(route.legs[0]).toMatchObject({
            distanceKm: 25,
            durationMinutes: 20,
            startPosition: { lat: 59.33, lng: 18.06 },
            endPosition: { lat: 59.2, lng: 17.9 },
        });
        expect(route.legs[0].coordinates).toHaveLength(3);
        expect(route.legs[1].startPosition).toEqual({ lat: 59.2, lng: 17.9 });
        expect(route.legs[1].endPosition).toEqual({ lat: 58.9, lng: 17.5 });

        expect(route.sampledPoints[0].distanceFromStartKm).toBe(0);
        expect(route.sampledPoints[route.sampledPoints.length - 1]).toMatchObject({ lat: 58.9, lng: 17.5 });
        expect(route.bbox[0]).toBeLessThan(17.5);
        expect(route.bbox[3]).toBeGreaterThan(59.33);
    });

    it('throws when no route path comes back', async () => {
        const fetchFn = mockFetch(jsonResponse({ type: 'FeatureCollection', features: [] }));
        await expect(keyed(fetchFn).calculateRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 })).rejects.toThrow('No routes found');
    });
});

describe('auth, errors and retries', () => {
    it('uses Entra ID with x-ms-client-id when no key is configured', async () => {
        const credential: TokenCredential = { getToken: vi.fn().mockResolvedValue({ token: 'tok', expiresOnTimestamp: Date.now() + 60_000 }) };
        const fetchFn = mockFetch(jsonResponse(autocompleteResponse));
        const service = createLocationService({ metadata: { clientId: 'maps-client-id' } }, { fetch: fetchFn, credential });

        await service.getSuggestions({ query: 'x' });

        expect(credential.getToken).toHaveBeenCalledWith('https://atlas.microsoft.com/.default');
        const { headers } = call(fetchFn);
        expect(headers.Authorization).toBe('Bearer tok');
        expect(headers['x-ms-client-id']).toBe('maps-client-id');
        expect(headers['subscription-key']).toBeUndefined();
    });

    it('fails clearly with no key and no client id', async () => {
        const saved = { key: process.env.AZURE_MAPS_KEY, id: process.env.AZURE_MAPS_CLIENT_ID };
        delete process.env.AZURE_MAPS_KEY;
        delete process.env.AZURE_MAPS_CLIENT_ID;
        try {
            const service = createLocationService(undefined, { fetch: mockFetch() });
            await expect(service.getSuggestions({ query: 'x' })).rejects.toThrow(/AZURE_MAPS_KEY/);
        } finally {
            if (saved.key !== undefined) process.env.AZURE_MAPS_KEY = saved.key;
            if (saved.id !== undefined) process.env.AZURE_MAPS_CLIENT_ID = saved.id;
        }
    });

    it('reads key and endpoint from env when no config is passed', async () => {
        process.env.AZURE_MAPS_KEY = 'env-key';
        process.env.AZURE_MAPS_ENDPOINT = 'https://eu.atlas.microsoft.com/';
        try {
            const fetchFn = mockFetch(jsonResponse(autocompleteResponse));
            await createLocationService(undefined, { fetch: fetchFn }).getSuggestions({ query: 'x' });
            const { url, headers } = call(fetchFn);
            expect(url.origin).toBe('https://eu.atlas.microsoft.com');
            expect(headers['subscription-key']).toBe('env-key');
        } finally {
            delete process.env.AZURE_MAPS_KEY;
            delete process.env.AZURE_MAPS_ENDPOINT;
        }
    });

    it('throws AzureMapsError with status and code from the error body', async () => {
        const fetchFn = mockFetch(jsonResponse({ error: { code: 'InvalidSubscriptionKey', message: 'bad key' } }, 401));
        const error = await keyed(fetchFn).getSuggestions({ query: 'x' }).catch(e => e);
        expect(error).toBeInstanceOf(AzureMapsError);
        expect(error).toMatchObject({ status: 401, code: 'InvalidSubscriptionKey' });
        expect(error.message).toMatch(/bad key/);
    });

    it('retries 429 and 5xx, honouring retry-after', async () => {
        const fetchFn = mockFetch(
            jsonResponse({ error: { code: 'TooManyRequests' } }, 429, { 'retry-after': '0' }),
            jsonResponse({ error: { code: 'ServerError' } }, 503),
            jsonResponse(autocompleteResponse)
        );
        const service = createLocationService({ apiKey: 'k', retryAttempts: 2 }, { fetch: fetchFn });
        const results = await service.getSuggestions({ query: 'x' });
        expect(fetchFn).toHaveBeenCalledTimes(3);
        expect(results.length).toBeGreaterThan(0);
    });

    it('does not retry 4xx other than 429', async () => {
        const fetchFn = mockFetch(jsonResponse({ error: { code: 'BadRequest' } }, 400));
        const service = createLocationService({ apiKey: 'k', retryAttempts: 3 }, { fetch: fetchFn });
        await expect(service.getSuggestions({ query: 'x' })).rejects.toBeInstanceOf(AzureMapsError);
        expect(fetchFn).toHaveBeenCalledTimes(1);
    });
});
