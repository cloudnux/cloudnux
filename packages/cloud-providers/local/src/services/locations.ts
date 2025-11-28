import * as fs from 'fs';
import * as path from 'path';

import {
    LocationService,
    LocationAddress,
    LocationSuggestion,
    SuggestionParams,
    ReverseGeocodeParams,
    Coordinates
} from "@cloudnux/core-cloud-provider";
import { env, logger } from "@cloudnux/utils";

// Use fs.promises for async file operations
const { readFile, writeFile, access, mkdir } = fs.promises;

/**
 * Internal structure for storing location data
 */
interface StoredLocation {
    placeId: string;
    title: string;
    subtitle?: string;
    coordinates: Coordinates;

    // Address components
    street?: string;
    streetNumber?: string;
    city?: string;
    district?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;

    // Full address
    fullAddress: string;

    // Metadata
    placeType?: string;
    categories?: string[];
}

/**
 * Mock location data for testing - Central Stockholm locations
 */
const DEFAULT_MOCK_LOCATIONS: Record<string, StoredLocation> = {
    'place-001': {
        placeId: 'place-001',
        title: 'Gamla Stan',
        subtitle: 'Old Town, Stockholm',
        coordinates: {
            lat: 59.3254,
            lng: 18.0716
        },
        street: 'Gamla Stan',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '111 27',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Gamla Stan, 111 27 Stockholm, Sweden',
        placeType: 'locality',
        categories: ['historical', 'tourist_attraction', 'landmark']
    },
    'place-002': {
        placeId: 'place-002',
        title: 'Kungliga Slottet',
        subtitle: 'Royal Palace of Stockholm',
        coordinates: {
            lat: 59.3268,
            lng: 18.0718
        },
        street: 'Slottsbacken',
        streetNumber: '1',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '111 30',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Slottsbacken 1, 111 30 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['tourist_attraction', 'landmark', 'palace']
    },
    'place-003': {
        placeId: 'place-003',
        title: 'Espresso House Kungsträdgården',
        subtitle: 'Coffee shop in central Stockholm',
        coordinates: {
            lat: 59.3311,
            lng: 18.0720
        },
        street: 'Kungsträdgården',
        streetNumber: '18',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '111 47',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Kungsträdgården 18, 111 47 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['cafe', 'coffee_shop', 'food']
    },
    'place-004': {
        placeId: 'place-004',
        title: 'ICA Nära Stureplan',
        subtitle: 'Grocery store',
        coordinates: {
            lat: 59.3372,
            lng: 18.0737
        },
        street: 'Humlegårdsgatan',
        streetNumber: '17',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '114 46',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Humlegårdsgatan 17, 114 46 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['grocery', 'supermarket', 'food']
    },
    'place-005': {
        placeId: 'place-005',
        title: 'Stockholm Central Station',
        subtitle: 'Main railway station',
        coordinates: {
            lat: 59.3303,
            lng: 18.0604
        },
        street: 'Centralplan',
        streetNumber: '15',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '111 20',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Centralplan 15, 111 20 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['train_station', 'transport', 'travel']
    },
    'place-006': {
        placeId: 'place-006',
        title: 'Fotografiska',
        subtitle: 'Photography museum',
        coordinates: {
            lat: 59.3188,
            lng: 18.0860
        },
        street: 'Stadsgårdshamnen',
        streetNumber: '22',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '116 45',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Stadsgårdshamnen 22, 116 45 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['museum', 'art', 'photography', 'cultural']
    },
    'place-007': {
        placeId: 'place-007',
        title: 'IKEA City',
        subtitle: 'Furniture store in central Stockholm',
        coordinates: {
            lat: 59.3378,
            lng: 18.0597
        },
        street: 'Sveavägen',
        streetNumber: '44',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '111 34',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Sveavägen 44, 111 34 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['furniture', 'shopping', 'home_goods']
    },
    'place-008': {
        placeId: 'place-008',
        title: 'Skansen',
        subtitle: 'Open-air museum and zoo',
        coordinates: {
            lat: 59.3263,
            lng: 18.1066
        },
        street: 'Djurgårdsslätten',
        streetNumber: '49-51',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '115 21',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Djurgårdsslätten 49-51, 115 21 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['museum', 'park', 'tourist_attraction', 'zoo']
    },
    'place-009': {
        placeId: 'place-009',
        title: 'Drop Coffee',
        subtitle: 'Specialty coffee roastery',
        coordinates: {
            lat: 59.3149,
            lng: 18.0608
        },
        street: 'Wollmar Yxkullsgatan',
        streetNumber: '10',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '118 50',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Wollmar Yxkullsgatan 10, 118 50 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['cafe', 'coffee_shop', 'food']
    },
    'place-010': {
        placeId: 'place-010',
        title: 'Vasa Museum',
        subtitle: 'Maritime museum',
        coordinates: {
            lat: 59.3280,
            lng: 18.0914
        },
        street: 'Galärvarvsvägen',
        streetNumber: '14',
        city: 'Stockholm',
        region: 'Stockholm County',
        postalCode: '115 21',
        country: 'Sweden',
        countryCode: 'SWE',
        fullAddress: 'Galärvarvsvägen 14, 115 21 Stockholm, Sweden',
        placeType: 'poi',
        categories: ['museum', 'tourist_attraction', 'historical']
    }
};

/**
 * Calculate distance between two coordinates in meters using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Radius of the Earth in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in meters
    return distance;
}

/**
 * Convert stored location to LocationSuggestion
 */
function toLocationSuggestion(location: StoredLocation, distance?: number): LocationSuggestion {
    return {
        title: location.title,
        subtitle: location.subtitle,
        coordinates: location.coordinates,
        placeId: location.placeId,
        placeType: location.placeType,
        distance,
        provider: 'local',
        rawData: location
    };
}

/**
 * Convert stored location to LocationAddress
 */
function toLocationAddress(location: StoredLocation): LocationAddress {
    return {
        fullAddress: location.fullAddress,
        street: location.street,
        streetNumber: location.streetNumber,
        city: location.city,
        district: location.district,
        region: location.region,
        postalCode: location.postalCode,
        country: location.country,
        countryCode: location.countryCode,
        coordinates: location.coordinates,
        placeType: location.placeType,
        provider: 'local',
        rawData: location
    };
}

/**
 * Create a local mock location service
 * @returns Local mock location service implementation
 */
export function createLocalLocationService(): LocationService {
    // Get base directory from environment variables or use default
    const baseDir = env("DEV_CLOUD_LOCATION_PATH", path.join(process.cwd(), '.develop', '.local-location'))!;
    const placesFilePath = path.join(baseDir, 'places.json');

    /**
     * Load places data from file or use default mock data
     * @returns Places data
     */
    async function loadPlaces(): Promise<Record<string, StoredLocation>> {
        try {
            // Create directory if it doesn't exist
            try {
                await access(baseDir);
            } catch {
                await mkdir(baseDir, { recursive: true });
            }

            // Try to load from file
            try {
                await access(placesFilePath);
                const data = await readFile(placesFilePath, 'utf8');
                return JSON.parse(data);
            } catch {
                // File doesn't exist, create it with default data
                await writeFile(placesFilePath, JSON.stringify(DEFAULT_MOCK_LOCATIONS, null, 2), 'utf8');
                logger.info(`Created default places file at: ${placesFilePath}`);
                return DEFAULT_MOCK_LOCATIONS;
            }
        } catch (error) {
            logger.warn(`Error loading places data: ${String(error)}`);
            return DEFAULT_MOCK_LOCATIONS;
        }
    }

    return {
        /**
         * Get autocomplete suggestions for search box
         * Use case: User types "Stock..." → Show ["Stockholm", "Stockton", ...]
         */
        async getSuggestions(params: SuggestionParams): Promise<LocationSuggestion[]> {
            const places = await loadPlaces();
            const queryLower = params.query.toLowerCase();

            // Filter places by query
            const results = Object.values(places).filter(place => {
                // Match by title, subtitle, or address
                const matchesQuery =
                    place.title.toLowerCase().includes(queryLower) ||
                    (place.subtitle?.toLowerCase().includes(queryLower)) ||
                    place.fullAddress.toLowerCase().includes(queryLower) ||
                    (place.city?.toLowerCase().includes(queryLower));

                // Match by place types if provided
                const matchesPlaceTypes = !params.placeTypes ||
                    params.placeTypes.includes(place.placeType || '');

                return matchesQuery && matchesPlaceTypes;
            });

            // Calculate distances if bias position is provided
            let resultsWithDistance: Array<{ place: StoredLocation; distance?: number }>;

            if (params.biasPosition) {
                resultsWithDistance = results.map(place => ({
                    place,
                    distance: calculateDistance(
                        params.biasPosition!.lat,
                        params.biasPosition!.lng,
                        place.coordinates.lat,
                        place.coordinates.lng
                    )
                }));

                // Sort by distance
                resultsWithDistance.sort((a, b) => (a.distance || 0) - (b.distance || 0));
            } else {
                // Sort by relevance (simple alphabetical for now)
                results.sort((a, b) => a.title.localeCompare(b.title));
                resultsWithDistance = results.map(place => ({ place }));
            }

            // Limit results
            const maxResults = params.maxResults || 5;
            const limitedResults = resultsWithDistance.slice(0, maxResults);

            // Convert to LocationSuggestion
            return limitedResults.map(({ place, distance }) =>
                toLocationSuggestion(place, distance)
            );
        },

        /**
         * Get address from coordinates (reverse geocoding)
         * Use case: User clicks "Get my location" → Show "Drottninggatan 10, Stockholm"
         */
        async reverseGeocode(params: ReverseGeocodeParams): Promise<LocationAddress> {
            const places = await loadPlaces();

            // Find the closest place to the given coordinates
            const placesWithDistance = Object.values(places).map(place => ({
                place,
                distance: calculateDistance(
                    params.coordinates.lat,
                    params.coordinates.lng,
                    place.coordinates.lat,
                    place.coordinates.lng
                )
            }));

            // Sort by distance and get the closest
            placesWithDistance.sort((a, b) => a.distance - b.distance);

            const closest = placesWithDistance[0];

            if (!closest) {
                throw new Error('No places found near the given coordinates');
            }

            return toLocationAddress(closest.place);
        },

        /**
         * Get detailed location info if suggestion doesn't have coordinates
         * Use case: User selects suggestion → Need full coordinates
         */
        async getLocationDetails(placeId: string): Promise<LocationAddress> {
            const places = await loadPlaces();
            const place = places[placeId];

            if (!place) {
                throw new Error(`Place not found: ${placeId}`);
            }

            return toLocationAddress(place);
        }
    };
}
