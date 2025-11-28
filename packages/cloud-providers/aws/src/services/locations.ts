import {
    GeoPlacesClient,
    SuggestCommand,
    ReverseGeocodeCommand,
    GetPlaceCommand,
    SuggestResultItem,
    ReverseGeocodeResultItem
} from '@aws-sdk/client-geo-places';

import type {
    LocationService,
    LocationProviderConfig,
    SuggestionParams,
    LocationSuggestion,
    ReverseGeocodeParams,
    LocationAddress,
    Coordinates
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
 * Create AWS GeoPlaces Location service (V2 API)
 * @param config Optional configuration for the location service
 * @returns AWS GeoPlaces Location service implementation
 */
export function createLocationService(config?: LocationProviderConfig): LocationService {
    // Create GeoPlaces client with optional region
    const geoPlacesClient = new GeoPlacesClient(
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
        }
    };
}
