import {
    GeoPlacesClient,
    SuggestCommand,
    ReverseGeocodeCommand,
    GetPlaceCommand,
    SuggestResultItem,
    ReverseGeocodeResultItem
} from '@aws-sdk/client-geo-places';

import {
    GeoRoutesClient,
    CalculateRoutesCommand,
    CalculateRoutesCommandInput,
} from '@aws-sdk/client-geo-routes';


import type {
    LocationService,
    LocationProviderConfig,
    SuggestionParams,
    LocationSuggestion,
    ReverseGeocodeParams,
    LocationAddress,
    Coordinates,
    RoutePoint,
    RouteResult
} from '@cloudnux/core-cloud-provider';


/**
 * Map AWS GeoPlaces suggest result to LocationSuggestion interface
 * @param result AWS GeoPlaces suggest result
 * @returns Standardized location suggestion
 */
function mapGeoPlacesSuggestToLocationSuggestion(result: SuggestResultItem): LocationSuggestion {
    // Extract place type from result
    const placeType = result.Place?.PlaceType?.toLowerCase() ??
        result.SuggestResultItemType?.toLowerCase() ?? 'place';

    return {
        title: result.Title ?? '',
        subtitle: result.Place?.Address?.Label,
        coordinates: result.Place?.Position ? {
            lat: result.Place.Position[1],
            lng: result.Place.Position[0]
        } : undefined,
        placeId: result.Place?.PlaceId,
        queryId: result.Query?.QueryId, // For follow-up SearchText calls
        placeType,
        distance: result.Place?.Distance,
        provider: 'aws',
        rawData: result
    };
}

/**
 * Map AWS GeoPlaces reverse geocode result to LocationAddress interface
 * @param result AWS GeoPlaces reverse geocode result
 * @param coordinates Original coordinates
 * @returns Standardized location address
 */
function mapGeoPlacesReverseGeocodeToLocationAddress(
    result: ReverseGeocodeResultItem,
    coordinates: Coordinates
): LocationAddress {
    const address = result.Address;
    const placeType = result.PlaceType?.toLowerCase() ?? 'place';

    return {
        fullAddress: address?.Label ?? '',
        street: address?.Street,
        streetNumber: address?.AddressNumber,
        city: address?.Locality,
        district: address?.District,
        region: address?.Region?.Name,
        postalCode: address?.PostalCode,
        country: address?.Country?.Name,
        countryCode: address?.Country?.Code3, // ISO 3166-1 alpha-3
        coordinates,
        placeType,
        provider: 'aws',
        rawData: result
    };
}

/**
 * Map AWS GeoPlaces GetPlace result to LocationAddress interface
 * @param place AWS GeoPlaces place details
 * @returns Standardized location address
 */
function mapGeoPlacesGetPlaceToLocationAddress(place: any): LocationAddress {
    const address = place.Address;
    const placeType = place.PlaceType?.toLowerCase() ?? 'place';

    return {
        fullAddress: address?.Label ?? '',
        street: address?.Street,
        streetNumber: address?.AddressNumber,
        city: address?.Locality,
        district: address?.District,
        region: address?.Region?.Name,
        postalCode: address?.PostalCode,
        country: address?.Country?.Name,
        countryCode: address?.Country?.Code3,
        coordinates: place.Position ? {
            lat: place.Position[1],
            lng: place.Position[0]
        } : { lat: 0, lng: 0 },
        placeType,
        provider: 'aws',
        rawData: place
    };
}

/**
 * Sample points along the route at regular intervals for corridor search
 */
function sampleRoutePoints(coordinates: Coordinates[], intervalKm: number): RoutePoint[] {
    const sampled: RoutePoint[] = [];
    let accumulatedDistance = 0;
    let lastSampledDistance = 0;

    // Add origin
    sampled.push({
        lng: coordinates[0].lng,
        lat: coordinates[0].lat,
        distanceFromStartKm: 0,
    });

    for (let i = 1; i < coordinates.length; i++) {
        const { lng: prevLng, lat: prevLat } = coordinates[i - 1];
        const { lng: currLng, lat: currLat } = coordinates[i];

        const segmentDistance = haversineDistance(
            { lat: prevLat, lng: prevLng },
            { lat: currLat, lng: currLng }
        );

        accumulatedDistance += segmentDistance;

        if (accumulatedDistance - lastSampledDistance >= intervalKm) {
            sampled.push({
                lng: currLng,
                lat: currLat,
                distanceFromStartKm: accumulatedDistance,
            });
            lastSampledDistance = accumulatedDistance;
        }
    }

    // Add destination if not already included
    const lastCoord = coordinates[coordinates.length - 1];
    const lastSampled = sampled[sampled.length - 1];
    if (lastSampled.lng !== lastCoord.lng || lastSampled.lat !== lastCoord.lat) {
        sampled.push({
            lng: lastCoord.lng,
            lat: lastCoord.lat,
            distanceFromStartKm: accumulatedDistance,
        });
    }

    return sampled;
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(point1: Coordinates, point2: Coordinates): number {
    const R = 6371;
    const dLat = toRad(point2.lat - point1.lat);
    const dLon = toRad(point2.lng - point1.lng);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(point1.lat)) *
        Math.cos(toRad(point2.lat)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}


/**
 * Create AWS GeoPlaces Location service (V2 API)
 * @param config Optional configuration for the location service
 * @returns AWS GeoPlaces Location service implementation
 */
export function createLocationService(config?: LocationProviderConfig): LocationService {
    // Create GeoPlaces client with optional region
    const geoPlacesClient = new GeoPlacesClient(
        config?.region ? { region: config.region } : {}
    );
    const geoRoutesClient = new GeoRoutesClient(
        config?.region ? { region: config.region } : {}
    );

    // Get default settings from config
    const defaultLanguage = config?.language ?? 'en';
    const defaultCountries = config?.countries ?? ['SWE'];
    const defaultMaxResults = 5;

    return {
        /**
         * Get autocomplete suggestions for search box
         * Uses AWS GeoPlaces V2 Suggest API
         * @param params Suggestion parameters
         * @returns Promise containing location suggestions
         */
        async getSuggestions(params: SuggestionParams): Promise<LocationSuggestion[]> {
            const command = new SuggestCommand({
                QueryText: params.query,
                MaxResults: params.maxResults ?? defaultMaxResults,
                Language: params.language ?? defaultLanguage,
                // BiasPosition for geographic bias
                BiasPosition: params.biasPosition ? [
                    params.biasPosition.lng,
                    params.biasPosition.lat
                ] : undefined,
                // Filter by countries
                Filter: {
                    IncludeCountries: params.countries ?? defaultCountries,
                }
            });

            const response = await geoPlacesClient.send(command);

            // Filter by place types client-side if specified
            let results = response.ResultItems ?? [];
            if (params.placeTypes && params.placeTypes.length > 0) {
                results = results.filter(item => {
                    const itemType = item.Place?.PlaceType?.toLowerCase();
                    return itemType && params.placeTypes?.some(t => itemType.includes(t.toLowerCase()));
                });
            }

            return results.map(mapGeoPlacesSuggestToLocationSuggestion);
        },

        /**
         * Get address from coordinates (reverse geocoding)
         * Uses AWS GeoPlaces V2 ReverseGeocode API
         * @param params Reverse geocode parameters
         * @returns Promise containing location address
         */
        async reverseGeocode(params: ReverseGeocodeParams): Promise<LocationAddress> {
            const command = new ReverseGeocodeCommand({
                QueryPosition: [params.coordinates.lng, params.coordinates.lat],
                MaxResults: params.maxResults ?? 1,
                Language: params.language ?? defaultLanguage,
            });

            const response = await geoPlacesClient.send(command);

            if (!response.ResultItems || response.ResultItems.length === 0) {
                throw new Error(
                    `No address found for coordinates: ${params.coordinates.lat}, ${params.coordinates.lng}`
                );
            }

            const firstResult = response.ResultItems[0];
            return mapGeoPlacesReverseGeocodeToLocationAddress(firstResult, params.coordinates);
        },

        /**
         * Get detailed location info for a place ID
         * Uses AWS GeoPlaces V2 GetPlace API
         * @param placeId ID of the place to get details for
         * @returns Promise containing location address
         */
        async getLocationDetails(placeId: string): Promise<LocationAddress> {
            const command = new GetPlaceCommand({
                PlaceId: placeId,
                Language: defaultLanguage,
            });

            const response = await geoPlacesClient.send(command);

            if (!response) {
                throw new Error(`Place not found: ${placeId}`);
            }

            return mapGeoPlacesGetPlaceToLocationAddress(response);
        },

        /** 
         * Calculate route between origin and destination with optional waypoints
         */
        async calculateRoute(
            origin: Coordinates,
            destination: Coordinates,
            waypoints: Coordinates[] = [],
            avoidTolls: boolean = false
        ): Promise<RouteResult> {
            const input: CalculateRoutesCommandInput = {
                Origin: [origin.lng, origin.lat],
                Destination: [destination.lng, destination.lat],
                TravelMode: 'Car',
                LegGeometryFormat: 'Simple', // Returns decoded coordinates directly
                LegAdditionalFeatures: ['Summary'], // Request summary for distance/duration
            };

            // Add waypoints if provided
            if (waypoints.length > 0) {
                input.Waypoints = waypoints.map(wp => ({
                    Position: [wp.lng, wp.lat],
                }));
            }

            // Add toll avoidance
            if (avoidTolls) {
                input.Avoid = {
                    TollRoads: true,
                };
            }

            const command = new CalculateRoutesCommand(input);
            const response = await geoRoutesClient.send(command);

            if (!response.Routes || response.Routes.length === 0) {
                throw new Error('No routes found');
            }

            // Use the first (best) route
            const route = response.Routes[0];

            if (!route.Legs || route.Legs.length === 0) {
                throw new Error('Route has no legs');
            }

            // Extract geometry from all legs
            const allCoordinates: Coordinates[] = [];
            const legs: RouteResult['legs'] = [];

            let minLng = Infinity, maxLng = -Infinity;
            let minLat = Infinity, maxLat = -Infinity;

            for (const leg of route.Legs) {
                const legCoords: Coordinates[] = [];

                // Extract coordinates from leg geometry
                if (leg.Geometry?.LineString) {
                    for (const coord of leg.Geometry.LineString) {
                        const [lng, lat] = coord;
                        legCoords.push({ lng, lat });
                        allCoordinates.push({ lng, lat });

                        minLng = Math.min(minLng, lng);
                        maxLng = Math.max(maxLng, lng);
                        minLat = Math.min(minLat, lat);
                        maxLat = Math.max(maxLat, lat);
                    }
                }

                // Get distance and duration from VehicleLegDetails.Summary
                // v2 API: distance in meters, duration in seconds
                let distanceMeters = 0;
                let durationSeconds = 0;
                let startPos: Coordinates = { lng: 0, lat: 0 };
                let endPos: Coordinates = { lng: 0, lat: 0 };

                if (leg.VehicleLegDetails) {
                    // Car/Truck mode
                    const summary = leg.VehicleLegDetails.Summary?.Overview;
                    distanceMeters = summary?.Distance || 0;
                    durationSeconds = summary?.Duration || 0;

                    // Get start/end from Departure/Arrival
                    const depPlace = leg.VehicleLegDetails.Departure?.Place;
                    const arrPlace = leg.VehicleLegDetails.Arrival?.Place;

                    if (depPlace?.Position) {
                        startPos = { lng: depPlace.Position[0], lat: depPlace.Position[1] };
                    }
                    if (arrPlace?.Position) {
                        endPos = { lng: arrPlace.Position[0], lat: arrPlace.Position[1] };
                    }
                } else if (leg.FerryLegDetails) {
                    // Ferry mode
                    const summary = leg.FerryLegDetails.Summary?.Overview;
                    distanceMeters = summary?.Distance || 0;
                    durationSeconds = summary?.Duration || 0;

                    const depPlace = leg.FerryLegDetails.Departure?.Place;
                    const arrPlace = leg.FerryLegDetails.Arrival?.Place;

                    if (depPlace?.Position) {
                        startPos = { lng: depPlace.Position[0], lat: depPlace.Position[1] };
                    }
                    if (arrPlace?.Position) {
                        endPos = { lng: arrPlace.Position[0], lat: arrPlace.Position[1] };
                    }
                } else if (leg.PedestrianLegDetails) {
                    // Pedestrian mode
                    const summary = leg.PedestrianLegDetails.Summary?.Overview;
                    distanceMeters = summary?.Distance || 0;
                    durationSeconds = summary?.Duration || 0;

                    const depPlace = leg.PedestrianLegDetails.Departure?.Place;
                    const arrPlace = leg.PedestrianLegDetails.Arrival?.Place;

                    if (depPlace?.Position) {
                        startPos = { lng: depPlace.Position[0], lat: depPlace.Position[1] };
                    }
                    if (arrPlace?.Position) {
                        endPos = { lng: arrPlace.Position[0], lat: arrPlace.Position[1] };
                    }
                }

                // Fallback to geometry endpoints if not available
                if (startPos.lng === 0 && legCoords.length > 0) {
                    startPos = { lng: legCoords[0].lng, lat: legCoords[0].lat };
                }
                if (endPos.lng === 0 && legCoords.length > 0) {
                    endPos = { lng: legCoords[legCoords.length - 1].lng, lat: legCoords[legCoords.length - 1].lat };
                }

                legs.push({
                    distanceKm: distanceMeters / 1000,
                    durationMinutes: durationSeconds / 60,
                    coordinates: legCoords,
                    startPosition: startPos,
                    endPosition: endPos,
                });
            }

            // Get total from route summary (meters and seconds)
            const totalDistanceKm = (route.Summary?.Distance || 0) / 1000;
            const totalDurationMinutes = (route.Summary?.Duration || 0) / 60;

            // Sample points for corridor search
            const sampledPoints = sampleRoutePoints(allCoordinates, 10);

            // Add padding to bbox
            const latPadding = (maxLat - minLat) * 0.1;
            const lngPadding = (maxLng - minLng) * 0.1;

            return {
                totalDistanceKm,
                totalDurationMinutes,
                coordinates: allCoordinates,
                sampledPoints,
                bbox: [
                    minLng - lngPadding,
                    minLat - latPadding,
                    maxLng + lngPadding,
                    maxLat + latPadding,
                ],
                legs,
            };
        }
    };
}
