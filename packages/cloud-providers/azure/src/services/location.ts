import { DefaultAzureCredential, TokenCredential } from '@azure/identity';
import countries from 'i18n-iso-countries';

import type {
    Coordinates,
    LocationAddress,
    LocationProviderConfig,
    LocationService,
    LocationSuggestion,
    ReverseGeocodeParams,
    RouteResult,
    SuggestionParams,
} from '@cloudnux/core-cloud-provider';
import { env } from '@cloudnux/utils';

import { paddedBbox, sampleRoutePoints } from './location-geo';

// ---------------------------------------------------------------------------
// Azure Maps location service (REST, no SDK)
//
//   getSuggestions     -> GET  /geocode:autocomplete   (2026-01-01)
//   getLocationDetails -> GET  /geocode                (2026-01-01)
//   reverseGeocode     -> GET  /reverseGeocode         (2026-01-01)
//   calculateRoute     -> POST /route/directions       (2025-01-01)
//
// Autocomplete returns no coordinates and no place id. Each suggestion's
// `placeId` is therefore an opaque token carrying what the geocoder needs;
// getLocationDetails(placeId) geocodes it. Same handler flow as AWS.
//
// Auth (first match wins):
//   config.apiKey | AZURE_MAPS_KEY          -> subscription-key header
//   otherwise DefaultAzureCredential        -> Bearer token + x-ms-client-id
//             (config.metadata.clientId | AZURE_MAPS_CLIENT_ID, required)
// Endpoint: config.metadata.endpoint | AZURE_MAPS_ENDPOINT | https://atlas.microsoft.com
// ---------------------------------------------------------------------------

const SEARCH_API_VERSION = '2026-01-01';
const ROUTE_API_VERSION = '2025-01-01';
const DEFAULT_ENDPOINT = 'https://atlas.microsoft.com';
const MAPS_SCOPE = 'https://atlas.microsoft.com/.default';

const DEFAULT_MAX_RESULTS = 5;
/** Autocomplete needs a bias point; same fallback centre as the AWS adapter (lng, lat). */
const DEFAULT_CENTER: Coordinates = { lng: 15.0, lat: 58.0 };
const SAMPLE_INTERVAL_KM = 10;

// ---------------------------------------------------------------------------
// Response types (only the fields we read)
// ---------------------------------------------------------------------------

type GeoJsonPoint = { type: 'Point'; coordinates: [number, number] };

export interface AzureAddress {
    addressLine?: string;
    streetName?: string;
    streetNumber?: string;
    formattedAddress?: string;
    locality?: string;
    neighborhood?: string;
    postalCode?: string;
    adminDistricts?: Array<{ name?: string; shortName?: string }>;
    countryRegion?: { ISO?: string; name?: string };
}

interface GeocodeFeature {
    geometry?: GeoJsonPoint | null;
    properties: {
        type?: string;
        typeGroup?: string;
        name?: string;
        confidence?: string;
        address?: AzureAddress;
        geocodePoints?: Array<{ geometry: GeoJsonPoint; usageTypes?: string[] }>;
    };
}

interface FeatureCollection<T> {
    features?: T[];
}

interface RouteLeg {
    distanceInMeters?: number;
    durationInSeconds?: number;
    routePathRange?: { legIndex?: number; range?: [number, number] };
}

interface RouteFeature {
    geometry?: { type: string; coordinates: unknown };
    properties: {
        type?: string;
        distanceInMeters?: number;
        durationInSeconds?: number;
        legs?: RouteLeg[];
    };
}

// ---------------------------------------------------------------------------
// Country codes: the interface speaks ISO alpha-3, Azure Maps alpha-2
// ---------------------------------------------------------------------------

export function toAlpha2(code: string): string | undefined {
    return code.length === 2 ? code.toUpperCase() : countries.alpha3ToAlpha2(code.toUpperCase());
}

export function toAlpha3(code?: string): string | undefined {
    if (!code) return undefined;
    return code.length === 3 ? code.toUpperCase() : countries.alpha2ToAlpha3(code.toUpperCase());
}

// ---------------------------------------------------------------------------
// Place types: map Azure's types onto the vocabulary used by the interface
// ("locality", "street", "address", "poi", ...)
// ---------------------------------------------------------------------------

const PLACE_TYPE_MAP: Record<string, string> = {
    Address: 'address',
    RoadBlock: 'street',
    RoadIntersection: 'street',
    PopulatedPlace: 'locality',
    GreaterPopulatedPlace: 'locality',
    Neighborhood: 'district',
    Postcode1: 'postalcode',
    AdminDivision1: 'region',
    AdminDivision2: 'subregion',
    AdminDivision3: 'subregion',
    CountryRegion: 'country',
};

export function mapPlaceType(type?: string): string {
    if (!type) return 'place';
    return PLACE_TYPE_MAP[type] ?? 'poi';
}

// ---------------------------------------------------------------------------
// placeId token
//
// Opaque to callers. Carries a structured address when Azure gave one (more
// precise than free text), otherwise a free-text query. base64url keeps it
// URL-safe so handlers can pass it through routes/query strings.
// ---------------------------------------------------------------------------

type PlaceToken =
    | { v: 1; q: string }
    | { v: 1; a: { addressLine?: string; locality?: string; postalCode?: string; countryRegion?: string } };

export function encodePlaceToken(feature: GeocodeFeature): string | undefined {
    const { address, name, typeGroup } = feature.properties;
    const iso = address?.countryRegion?.ISO;

    let token: PlaceToken | undefined;
    if (typeGroup === 'Address' && address?.addressLine) {
        token = {
            v: 1,
            a: { addressLine: address.addressLine, locality: address.locality, postalCode: address.postalCode, countryRegion: iso },
        };
    } else {
        // The geocoder rejects countryRegion alongside a free-text query, so the
        // place's name and formatted address carry all the context.
        const formatted = address?.formattedAddress;
        const query = name && formatted && !formatted.startsWith(name)
            ? `${name}, ${formatted}`
            : formatted ?? name;
        if (query) token = { v: 1, q: query };
    }
    return token ? Buffer.from(JSON.stringify(token)).toString('base64url') : undefined;
}

export function decodePlaceToken(placeId: string): PlaceToken {
    try {
        const token = JSON.parse(Buffer.from(placeId, 'base64url').toString('utf-8'));
        if (token?.v === 1 && (typeof token.q === 'string' || typeof token.a === 'object')) {
            return token;
        }
    } catch {
        // fall through
    }
    throw new Error(`Invalid Azure Maps placeId: ${placeId}`);
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function pointToCoordinates(point?: GeoJsonPoint | null): Coordinates | undefined {
    if (!point?.coordinates) return undefined;
    const [lng, lat] = point.coordinates;
    return { lat, lng };
}

function featureCoordinates(feature: GeocodeFeature): Coordinates | undefined {
    return pointToCoordinates(feature.geometry) ??
        pointToCoordinates(feature.properties.geocodePoints?.find(p => p.usageTypes?.includes('Display'))?.geometry) ??
        pointToCoordinates(feature.properties.geocodePoints?.[0]?.geometry);
}

function mapSuggestion(feature: GeocodeFeature): LocationSuggestion {
    const { address, name, type } = feature.properties;
    const title = name ?? address?.addressLine ?? address?.formattedAddress ?? '';
    const subtitle = address?.formattedAddress !== title ? address?.formattedAddress : undefined;

    return {
        title,
        subtitle,
        coordinates: featureCoordinates(feature),
        placeId: encodePlaceToken(feature),
        placeType: mapPlaceType(type),
        provider: 'azure',
        rawData: feature,
    };
}

export function mapAddress(feature: GeocodeFeature, coordinates: Coordinates): LocationAddress {
    const address = feature.properties.address ?? {};
    return {
        fullAddress: address.formattedAddress ?? '',
        street: address.streetName,
        streetNumber: address.streetNumber,
        city: address.locality,
        district: address.neighborhood,
        region: address.adminDistricts?.[0]?.name ?? address.adminDistricts?.[0]?.shortName,
        postalCode: address.postalCode,
        country: address.countryRegion?.name,
        countryCode: toAlpha3(address.countryRegion?.ISO),
        coordinates,
        placeType: mapPlaceType(feature.properties.type),
        provider: 'azure',
        rawData: feature,
    };
}

/** RoutePath geometry is a MultiLineString of [lng, lat]; tolerate LineString too. */
function routeLines(geometry?: RouteFeature['geometry']): Coordinates[][] {
    if (!geometry) return [];
    const raw = geometry.type === 'LineString'
        ? [geometry.coordinates as number[][]]
        : (geometry.coordinates as number[][][]);
    return raw.map(line => line.map(([lng, lat]) => ({ lat, lng })));
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

export class AzureMapsError extends Error {
    constructor(public readonly status: number, public readonly code: string | undefined, message: string) {
        super(message);
        this.name = 'AzureMapsError';
    }
}

export interface AzureMapsLocationOptions {
    fetch?: typeof fetch;
    credential?: TokenCredential;
}

function createMapsClient(config: LocationProviderConfig | undefined, options: AzureMapsLocationOptions) {
    const doFetch = options.fetch ?? fetch;
    const endpoint = (config?.metadata?.endpoint ?? env('AZURE_MAPS_ENDPOINT', DEFAULT_ENDPOINT)).replace(/\/+$/, '');
    const apiKey = config?.apiKey ?? env('AZURE_MAPS_KEY');
    const clientId = config?.metadata?.clientId ?? env('AZURE_MAPS_CLIENT_ID');
    const timeout = config?.timeout ?? 10_000;
    const retries = Math.max(0, config?.retryAttempts ?? 2);
    let credential = options.credential;

    async function authHeaders(): Promise<Record<string, string>> {
        if (apiKey) return { 'subscription-key': apiKey };
        if (!clientId) {
            throw new Error(
                'Azure Maps is not configured: set AZURE_MAPS_KEY, or AZURE_MAPS_CLIENT_ID for Entra ID auth.'
            );
        }
        credential ??= new DefaultAzureCredential();
        const token = await credential.getToken(MAPS_SCOPE);
        if (!token) throw new Error('Could not acquire an Entra ID token for Azure Maps');
        return { Authorization: `Bearer ${token.token}`, 'x-ms-client-id': clientId };
    }

    return async function request<T>(
        method: 'GET' | 'POST',
        path: string,
        query: Record<string, string | number | undefined>,
        init: { language?: string; body?: unknown } = {}
    ): Promise<T> {
        const url = new URL(endpoint + path);
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
        }

        const headers: Record<string, string> = { ...(await authHeaders()) };
        if (init.language) headers['Accept-Language'] = init.language;
        if (init.body !== undefined) headers['Content-Type'] = 'application/geo+json';

        for (let attempt = 0; ; attempt++) {
            const response = await doFetch(url, {
                method,
                headers,
                body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
                signal: AbortSignal.timeout(timeout),
            });

            if (response.ok) return (await response.json()) as T;

            const retryable = response.status === 429 || response.status >= 500;
            if (retryable && attempt < retries) {
                const retryAfter = Number(response.headers.get('retry-after'));
                const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 200 * 2 ** attempt;
                await new Promise(resolve => setTimeout(resolve, delayMs));
                continue;
            }

            let message = response.statusText;
            let code = response.headers.get('x-ms-error-code') ?? undefined;
            try {
                const body = await response.json() as { error?: { code?: string; message?: string } };
                message = body.error?.message ?? message;
                code = body.error?.code ?? code;
            } catch {
                // non-JSON error body
            }
            throw new AzureMapsError(response.status, code, `Azure Maps ${method} ${path} failed (${response.status}): ${message}`);
        }
    };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Create Azure Maps location service.
 * @param config optional; env vars are used when omitted (the provider calls it without args)
 * @param options test hooks: custom fetch and credential
 */
export function createLocationService(
    config?: LocationProviderConfig,
    options: AzureMapsLocationOptions = {}
): LocationService {
    const request = createMapsClient(config, options);
    const defaultLanguage = config?.language ?? 'en';
    const defaultCountries = config?.countries ?? ['SWE'];

    return {
        async getSuggestions(params: SuggestionParams): Promise<LocationSuggestion[]> {
            const maxResults = params.maxResults ?? DEFAULT_MAX_RESULTS;
            const countryCodes = (params.countries ?? defaultCountries)
                .map(toAlpha2)
                .filter((c): c is string => !!c);
            const bias = params.biasPosition ?? DEFAULT_CENTER;

            // The API takes a single countryRegion. With several countries,
            // fetch the maximum and filter client-side.
            const single = countryCodes.length === 1 ? countryCodes[0] : undefined;
            const filterClientSide = countryCodes.length > 1 || (params.placeTypes?.length ?? 0) > 0;

            const response = await request<FeatureCollection<GeocodeFeature>>('GET', '/geocode:autocomplete', {
                'api-version': SEARCH_API_VERSION,
                query: params.query,
                coordinates: `${bias.lng},${bias.lat}`,
                countryRegion: single,
                top: filterClientSide ? 20 : Math.min(Math.max(maxResults, 1), 20),
            }, { language: params.language ?? defaultLanguage });

            let features = response.features ?? [];

            if (countryCodes.length > 1) {
                features = features.filter(f => {
                    const iso = f.properties.address?.countryRegion?.ISO?.toUpperCase();
                    return !iso || countryCodes.includes(iso);
                });
            }

            let suggestions = features.map(mapSuggestion);

            if (params.placeTypes && params.placeTypes.length > 0) {
                const wanted = params.placeTypes.map(t => t.toLowerCase());
                suggestions = suggestions.filter(s => wanted.some(t => s.placeType?.includes(t)));
            }

            return suggestions.slice(0, maxResults);
        },

        async getLocationDetails(placeId: string): Promise<LocationAddress> {
            const token = decodePlaceToken(placeId);
            const query = 'q' in token
                ? { query: token.q }
                : { addressLine: token.a.addressLine, locality: token.a.locality, postalCode: token.a.postalCode, countryRegion: token.a.countryRegion };

            const response = await request<FeatureCollection<GeocodeFeature>>('GET', '/geocode', {
                'api-version': SEARCH_API_VERSION,
                ...query,
                top: 1,
            }, { language: defaultLanguage });

            const feature = response.features?.[0];
            const coordinates = feature && featureCoordinates(feature);
            if (!feature || !coordinates) {
                throw new Error(`Place not found: ${placeId}`);
            }
            return mapAddress(feature, coordinates);
        },

        async reverseGeocode(params: ReverseGeocodeParams): Promise<LocationAddress> {
            const response = await request<FeatureCollection<GeocodeFeature>>('GET', '/reverseGeocode', {
                'api-version': SEARCH_API_VERSION,
                coordinates: `${params.coordinates.lng},${params.coordinates.lat}`,
            }, { language: params.language ?? defaultLanguage });

            const feature = response.features?.[0];
            if (!feature) {
                throw new Error(`No address found for coordinates: ${params.coordinates.lat}, ${params.coordinates.lng}`);
            }
            // Like the AWS adapter, return the queried coordinates.
            return mapAddress(feature, params.coordinates);
        },

        async calculateRoute(
            origin: Coordinates,
            destination: Coordinates,
            waypoints: Coordinates[] = [],
            avoidTolls = false
        ): Promise<RouteResult> {
            const points = [origin, ...waypoints, destination];
            const body = {
                type: 'FeatureCollection',
                features: points.map((p, i) => ({
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
                    properties: { pointIndex: i, pointType: 'waypoint' },
                })),
                travelMode: 'driving',
                routeOutputOptions: ['routePath'],
                ...(avoidTolls ? { avoid: ['tollRoads'] } : {}),
            };

            const response = await request<FeatureCollection<RouteFeature>>('POST', '/route/directions', {
                'api-version': ROUTE_API_VERSION,
            }, { body });

            const routePath = response.features?.find(f => f.properties.type === 'RoutePath');
            if (!routePath) {
                throw new Error('No routes found');
            }

            const lines = routeLines(routePath.geometry);
            const allCoordinates = lines.flat();
            const apiLegs = routePath.properties.legs ?? [];
            if (apiLegs.length === 0) {
                throw new Error('Route has no legs');
            }

            const legs: RouteResult['legs'] = apiLegs.map((leg, i) => {
                const line = lines[leg.routePathRange?.legIndex ?? i] ?? lines[0] ?? [];
                const range = leg.routePathRange?.range;
                const legCoords = range ? line.slice(range[0], range[1] + 1) : line;
                return {
                    distanceKm: (leg.distanceInMeters ?? 0) / 1000,
                    durationMinutes: (leg.durationInSeconds ?? 0) / 60,
                    coordinates: legCoords,
                    startPosition: legCoords[0] ?? points[i],
                    endPosition: legCoords[legCoords.length - 1] ?? points[i + 1],
                };
            });

            return {
                totalDistanceKm: (routePath.properties.distanceInMeters ?? 0) / 1000,
                totalDurationMinutes: (routePath.properties.durationInSeconds ?? 0) / 60,
                coordinates: allCoordinates,
                sampledPoints: sampleRoutePoints(allCoordinates, SAMPLE_INTERVAL_KM),
                bbox: paddedBbox(allCoordinates),
                legs,
            };
        },
    };
}
