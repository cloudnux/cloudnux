import * as fs from 'fs';
import * as path from 'path';

import { LocationService, PlaceDetails, PlaceSearchOptions, PlaceSearchResult } from "@cloudnux/core-cloud-provider";
import { env, logger } from "@cloudnux/utils";

// Use fs.promises for async file operations
const { readFile, writeFile, access, mkdir } = fs.promises;

/**
 * Mock location data for testing - Central Stockholm locations
 */
const DEFAULT_MOCK_PLACES: Record<string, PlaceDetails> = {
    'place-001': {
        placeId: 'place-001',
        text: 'Gamla Stan',
        address: 'Gamla Stan, Stockholm, Sweden',
        formattedAddress: 'Gamla Stan, Stockholm, 111 27, Sweden',
        coordinates: {
            latitude: 59.3254,
            longitude: 18.0716
        },
        categories: ['historical', 'tourist_attraction', 'landmark'],
        phoneNumber: '+46 8 508 29 000',
        website: 'https://www.visitstockholm.com/gamla-stan/',
        openingHours: {
            periods: [
                { day: 0, open: '00:00', close: '00:00' }, // 24/7
                { day: 1, open: '00:00', close: '00:00' },
                { day: 2, open: '00:00', close: '00:00' },
                { day: 3, open: '00:00', close: '00:00' },
                { day: 4, open: '00:00', close: '00:00' },
                { day: 5, open: '00:00', close: '00:00' },
                { day: 6, open: '00:00', close: '00:00' }
            ],
            weekdayText: [
                'Monday: Open 24 hours',
                'Tuesday: Open 24 hours',
                'Wednesday: Open 24 hours',
                'Thursday: Open 24 hours',
                'Friday: Open 24 hours',
                'Saturday: Open 24 hours',
                'Sunday: Open 24 hours'
            ]
        }
    },
    'place-002': {
        placeId: 'place-002',
        text: 'Kungliga Slottet (Royal Palace)',
        address: 'Slottsbacken 1, Stockholm, Sweden',
        formattedAddress: 'Kungliga Slottet, Slottsbacken 1, 111 30 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3268,
            longitude: 18.0718
        },
        categories: ['tourist_attraction', 'landmark', 'palace'],
        phoneNumber: '+46 8 402 61 30',
        website: 'https://www.kungligaslotten.se/',
        openingHours: {
            periods: [
                { day: 0, open: '10:00', close: '17:00' },
                { day: 1, open: '10:00', close: '17:00' },
                { day: 2, open: '10:00', close: '17:00' },
                { day: 3, open: '10:00', close: '17:00' },
                { day: 4, open: '10:00', close: '17:00' },
                { day: 5, open: '10:00', close: '17:00' },
                { day: 6, open: '10:00', close: '17:00' }
            ],
            weekdayText: [
                'Monday: 10:00 AM – 5:00 PM',
                'Tuesday: 10:00 AM – 5:00 PM',
                'Wednesday: 10:00 AM – 5:00 PM',
                'Thursday: 10:00 AM – 5:00 PM',
                'Friday: 10:00 AM – 5:00 PM',
                'Saturday: 10:00 AM – 5:00 PM',
                'Sunday: 10:00 AM – 5:00 PM'
            ]
        }
    },
    'place-003': {
        placeId: 'place-003',
        text: 'Espresso House Kungsträdgården',
        address: 'Kungsträdgården 18, Stockholm, Sweden',
        formattedAddress: 'Espresso House, Kungsträdgården 18, 111 47 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3311,
            longitude: 18.0720
        },
        categories: ['cafe', 'coffee_shop', 'food'],
        phoneNumber: '+46 8 611 07 26',
        website: 'https://espressohouse.com/',
        openingHours: {
            periods: [
                { day: 0, open: '07:00', close: '20:00' },
                { day: 1, open: '07:00', close: '21:00' },
                { day: 2, open: '07:00', close: '21:00' },
                { day: 3, open: '07:00', close: '21:00' },
                { day: 4, open: '07:00', close: '21:00' },
                { day: 5, open: '07:00', close: '22:00' },
                { day: 6, open: '08:00', close: '21:00' }
            ],
            weekdayText: [
                'Monday: 7:00 AM – 9:00 PM',
                'Tuesday: 7:00 AM – 9:00 PM',
                'Wednesday: 7:00 AM – 9:00 PM',
                'Thursday: 7:00 AM – 9:00 PM',
                'Friday: 7:00 AM – 10:00 PM',
                'Saturday: 8:00 AM – 9:00 PM',
                'Sunday: 7:00 AM – 8:00 PM'
            ]
        }
    },
    'place-004': {
        placeId: 'place-004',
        text: 'ICA Nära Stureplan',
        address: 'Humlegårdsgatan 17, Stockholm, Sweden',
        formattedAddress: 'ICA Nära Stureplan, Humlegårdsgatan 17, 114 46 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3372,
            longitude: 18.0737
        },
        categories: ['grocery', 'supermarket', 'food'],
        phoneNumber: '+46 8 611 78 30',
        website: 'https://www.ica.se/butiker/nara/stockholm/ica-nara-stureplan-1339/start/',
        openingHours: {
            periods: [
                { day: 0, open: '07:00', close: '23:00' },
                { day: 1, open: '07:00', close: '23:00' },
                { day: 2, open: '07:00', close: '23:00' },
                { day: 3, open: '07:00', close: '23:00' },
                { day: 4, open: '07:00', close: '23:00' },
                { day: 5, open: '07:00', close: '23:00' },
                { day: 6, open: '07:00', close: '23:00' }
            ],
            weekdayText: [
                'Monday: 7:00 AM – 11:00 PM',
                'Tuesday: 7:00 AM – 11:00 PM',
                'Wednesday: 7:00 AM – 11:00 PM',
                'Thursday: 7:00 AM – 11:00 PM',
                'Friday: 7:00 AM – 11:00 PM',
                'Saturday: 7:00 AM – 11:00 PM',
                'Sunday: 7:00 AM – 11:00 PM'
            ]
        }
    },
    'place-005': {
        placeId: 'place-005',
        text: 'Stockholm Central Station',
        address: 'Centralplan 15, Stockholm, Sweden',
        formattedAddress: 'Stockholm Central Station, Centralplan 15, 111 20 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3303,
            longitude: 18.0604
        },
        categories: ['train_station', 'transport', 'travel'],
        phoneNumber: '+46 77 175 75 75',
        website: 'https://www.jernhusen.se/stockholm-centralstation/',
        openingHours: {
            periods: [
                { day: 0, open: '04:00', close: '01:00' },
                { day: 1, open: '04:00', close: '01:00' },
                { day: 2, open: '04:00', close: '01:00' },
                { day: 3, open: '04:00', close: '01:00' },
                { day: 4, open: '04:00', close: '01:00' },
                { day: 5, open: '04:00', close: '01:00' },
                { day: 6, open: '04:00', close: '01:00' }
            ],
            weekdayText: [
                'Monday: 4:00 AM – 1:00 AM',
                'Tuesday: 4:00 AM – 1:00 AM',
                'Wednesday: 4:00 AM – 1:00 AM',
                'Thursday: 4:00 AM – 1:00 AM',
                'Friday: 4:00 AM – 1:00 AM',
                'Saturday: 4:00 AM – 1:00 AM',
                'Sunday: 4:00 AM – 1:00 AM'
            ]
        }
    },
    'place-006': {
        placeId: 'place-006',
        text: 'Fotografiska',
        address: 'Stadsgårdshamnen 22, Stockholm, Sweden',
        formattedAddress: 'Fotografiska, Stadsgårdshamnen 22, 116 45 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3188,
            longitude: 18.0860
        },
        categories: ['museum', 'art', 'photography', 'cultural'],
        phoneNumber: '+46 8 509 005 00',
        website: 'https://www.fotografiska.com/sto/',
        openingHours: {
            periods: [
                { day: 0, open: '10:00', close: '23:00' },
                { day: 1, open: '10:00', close: '23:00' },
                { day: 2, open: '10:00', close: '23:00' },
                { day: 3, open: '10:00', close: '23:00' },
                { day: 4, open: '10:00', close: '01:00' },
                { day: 5, open: '10:00', close: '01:00' },
                { day: 6, open: '10:00', close: '23:00' }
            ],
            weekdayText: [
                'Monday: 10:00 AM – 11:00 PM',
                'Tuesday: 10:00 AM – 11:00 PM',
                'Wednesday: 10:00 AM – 11:00 PM',
                'Thursday: 10:00 AM – 11:00 PM',
                'Friday: 10:00 AM – 1:00 AM',
                'Saturday: 10:00 AM – 1:00 AM',
                'Sunday: 10:00 AM – 11:00 PM'
            ]
        }
    },
    'place-007': {
        placeId: 'place-007',
        text: 'IKEA City',
        address: 'Sveavägen 44, Stockholm, Sweden',
        formattedAddress: 'IKEA City, Sveavägen 44, 111 34 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3378,
            longitude: 18.0597
        },
        categories: ['furniture', 'shopping', 'home_goods'],
        phoneNumber: '+46 775 700 500',
        website: 'https://www.ikea.com/se/sv/stores/stockholm-city/',
        openingHours: {
            periods: [
                { day: 0, open: '10:00', close: '18:00' },
                { day: 1, open: '10:00', close: '19:00' },
                { day: 2, open: '10:00', close: '19:00' },
                { day: 3, open: '10:00', close: '19:00' },
                { day: 4, open: '10:00', close: '19:00' },
                { day: 5, open: '10:00', close: '19:00' },
                { day: 6, open: '10:00', close: '18:00' }
            ],
            weekdayText: [
                'Monday: 10:00 AM – 7:00 PM',
                'Tuesday: 10:00 AM – 7:00 PM',
                'Wednesday: 10:00 AM – 7:00 PM',
                'Thursday: 10:00 AM – 7:00 PM',
                'Friday: 10:00 AM – 7:00 PM',
                'Saturday: 10:00 AM – 6:00 PM',
                'Sunday: 10:00 AM – 6:00 PM'
            ]
        }
    },
    'place-008': {
        placeId: 'place-008',
        text: 'Skansen',
        address: 'Djurgårdsslätten 49-51, Stockholm, Sweden',
        formattedAddress: 'Skansen, Djurgårdsslätten 49-51, 115 21 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3263,
            longitude: 18.1066
        },
        categories: ['museum', 'park', 'tourist_attraction', 'zoo'],
        phoneNumber: '+46 8 442 80 00',
        website: 'https://www.skansen.se/',
        openingHours: {
            periods: [
                { day: 0, open: '10:00', close: '18:00' },
                { day: 1, open: '10:00', close: '18:00' },
                { day: 2, open: '10:00', close: '18:00' },
                { day: 3, open: '10:00', close: '18:00' },
                { day: 4, open: '10:00', close: '18:00' },
                { day: 5, open: '10:00', close: '20:00' },
                { day: 6, open: '10:00', close: '20:00' }
            ],
            weekdayText: [
                'Monday: 10:00 AM – 6:00 PM',
                'Tuesday: 10:00 AM – 6:00 PM',
                'Wednesday: 10:00 AM – 6:00 PM',
                'Thursday: 10:00 AM – 6:00 PM',
                'Friday: 10:00 AM – 8:00 PM',
                'Saturday: 10:00 AM – 8:00 PM',
                'Sunday: 10:00 AM – 6:00 PM'
            ]
        }
    },
    'place-009': {
        placeId: 'place-009',
        text: 'Drop Coffee',
        address: 'Wollmar Yxkullsgatan 10, Stockholm, Sweden',
        formattedAddress: 'Drop Coffee, Wollmar Yxkullsgatan 10, 118 50 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3149,
            longitude: 18.0608
        },
        categories: ['cafe', 'coffee_shop', 'food'],
        phoneNumber: '+46 8 642 06 09',
        website: 'https://dropcoffee.com/',
        openingHours: {
            periods: [
                { day: 0, open: '08:00', close: '18:00' },
                { day: 1, open: '07:30', close: '18:00' },
                { day: 2, open: '07:30', close: '18:00' },
                { day: 3, open: '07:30', close: '18:00' },
                { day: 4, open: '07:30', close: '18:00' },
                { day: 5, open: '07:30', close: '18:00' },
                { day: 6, open: '08:00', close: '18:00' }
            ],
            weekdayText: [
                'Monday: 7:30 AM – 6:00 PM',
                'Tuesday: 7:30 AM – 6:00 PM',
                'Wednesday: 7:30 AM – 6:00 PM',
                'Thursday: 7:30 AM – 6:00 PM',
                'Friday: 7:30 AM – 6:00 PM',
                'Saturday: 8:00 AM – 6:00 PM',
                'Sunday: 8:00 AM – 6:00 PM'
            ]
        }
    },
    'place-010': {
        placeId: 'place-010',
        text: 'Vasa Museum',
        address: 'Galärvarvsvägen 14, Stockholm, Sweden',
        formattedAddress: 'Vasa Museum, Galärvarvsvägen 14, 115 21 Stockholm, Sweden',
        coordinates: {
            latitude: 59.3280,
            longitude: 18.0914
        },
        categories: ['museum', 'tourist_attraction', 'historical'],
        phoneNumber: '+46 8 519 548 00',
        website: 'https://www.vasamuseet.se/',
        openingHours: {
            periods: [
                { day: 0, open: '10:00', close: '17:00' },
                { day: 1, open: '10:00', close: '17:00' },
                { day: 2, open: '10:00', close: '17:00' },
                { day: 3, open: '10:00', close: '17:00' },
                { day: 4, open: '10:00', close: '20:00' },
                { day: 5, open: '10:00', close: '17:00' },
                { day: 6, open: '10:00', close: '17:00' }
            ],
            weekdayText: [
                'Monday: 10:00 AM – 5:00 PM',
                'Tuesday: 10:00 AM – 5:00 PM',
                'Wednesday: 10:00 AM – 5:00 PM',
                'Thursday: 10:00 AM – 8:00 PM',
                'Friday: 10:00 AM – 5:00 PM',
                'Saturday: 10:00 AM – 5:00 PM',
                'Sunday: 10:00 AM – 5:00 PM'
            ]
        }
    }
};

/**
 * Calculate distance between two coordinates in kilometers using Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
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
    async function loadPlaces(): Promise<Record<string, PlaceDetails>> {
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
                await writeFile(placesFilePath, JSON.stringify(DEFAULT_MOCK_PLACES, null, 2), 'utf8');
                return DEFAULT_MOCK_PLACES;
            }
        } catch (error) {
            logger.warn(`Error loading places data: ${String(error)}`);
            return DEFAULT_MOCK_PLACES;
        }
    }

    return {
        /**
         * Search for places based on a query
         * @param query Search query
         * @param options Search options
         * @returns Promise containing search results
         */
        async searchPlaces(query: string, options?: PlaceSearchOptions): Promise<PlaceSearchResult[]> {
            const places = await loadPlaces();

            // Simple search implementation
            const queryLower = query.toLowerCase();

            // Filter places by query and categories
            let results = Object.values(places).filter(place => {
                // Match by name or address
                const matchesQuery = place.text.toLowerCase().includes(queryLower) ||
                    (place.address?.toLowerCase().includes(queryLower));

                // Match by categories if provided
                const matchesCategories = !options?.categories ||
                    options.categories.some(category =>
                        place.categories?.some(cat => cat.toLowerCase().includes(category.toLowerCase()))
                    );

                return matchesQuery && matchesCategories;
            });

            // Filter by bounding box if provided
            if (options?.boundingBox) {
                results = results.filter(place => {
                    const lat = place.coordinates.latitude;
                    const lng = place.coordinates.longitude;

                    return lat >= options.boundingBox!.minLatitude &&
                        lat <= options.boundingBox!.maxLatitude &&
                        lng >= options.boundingBox!.minLongitude &&
                        lng <= options.boundingBox!.maxLongitude;
                });
            }

            // Calculate distances (from center of bounding box or default to NYC center)
            const centerLat = options?.boundingBox ?
                (options.boundingBox.minLatitude + options.boundingBox.maxLatitude) / 2 :
                40.7128;
            const centerLng = options?.boundingBox ?
                (options.boundingBox.minLongitude + options.boundingBox.maxLongitude) / 2 :
                -74.0060;

            results.forEach(place => {
                place.distance = calculateDistance(
                    centerLat,
                    centerLng,
                    place.coordinates.latitude,
                    place.coordinates.longitude
                );
            });

            // Sort by distance
            results.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

            // Limit results
            if (options?.maxResults && options.maxResults > 0) {
                results = results.slice(0, options.maxResults);
            }

            return results;
        },

        /**
         * Get detailed information about a specific place
         * @param placeId ID of the place to get details for
         * @returns Promise containing place details
         */
        async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
            const places = await loadPlaces();

            const place = places[placeId];
            if (!place) {
                throw new Error(`Place not found: ${placeId}`);
            }

            return place;
        }
    };
}