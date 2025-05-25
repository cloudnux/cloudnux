import {
    LocationClient,
    SearchPlaceIndexForSuggestionsCommand,
    GetPlaceCommand,
    Place,
    SearchForSuggestionsResult
} from '@aws-sdk/client-location';

import { env } from "@cloudnux/utils";


/**
 * Map AWS search result to our common interface
 * @param result AWS search result 
 * @returns Standardized place search result
 */
function mapAwsResultToPlaceSearchResult(result: SearchForSuggestionsResult) {
    return {
        placeId: result.PlaceId ?? '',
        text: result.Text ?? '',
    };
}

/**
 * Map AWS place details to our common interface
 * @param place AWS place details
 * @returns Standardized place details
 */
function mapAwsPlaceToPlaceDetails(place: Place, placeId: string) {
    const placeDetails = {
        placeId: placeId,
        text: place.Label ?? '',
        address: place.AddressNumber ?? undefined,
        coordinates: {
            latitude: place.Geometry?.Point?.[1] ?? 0,
            longitude: place.Geometry?.Point?.[0] ?? 0,
        },
        formattedAddress: place.Label ?? '',
        categories: place.Categories ?? [],
        additionalData: place
    };

    return placeDetails;
}

/**
 * Create AWS Location service
 * @returns AWS Location service implementation
 */
export function createLocationService() {
    // Create Location client
    const locationClient = new LocationClient();
    const placeIndexName = env("LOCATION_INDEX_NAME");
    return {
        /**
         * Search for places based on a query
         * @param query Search query
         * @param options Search options like bounding box, filters, etc.
         * @returns Promise containing search results
         */
        async searchPlaces(query: string, options?: any): Promise<any[]> {
            const command = new SearchPlaceIndexForSuggestionsCommand({
                IndexName: placeIndexName,
                Text: query,
                FilterBBox: options?.boundingBox ? [
                    options.boundingBox.minLongitude,
                    options.boundingBox.minLatitude,
                    options.boundingBox.maxLongitude,
                    options.boundingBox.maxLatitude,
                ] : undefined,
                MaxResults: options?.maxResults,
                //TODO : Filter by country should set properly from the frontend
                FilterCategories: ["AddressType", "StreetType", "RegionType", "MunicipalityType", "NeighborhoodType"],
                FilterCountries: ["SWE"],
            });

            const response = await locationClient.send(command);

            return (response.Results ?? []).map(mapAwsResultToPlaceSearchResult);
        },

        /**
         * Get detailed information about a specific place
         * @param placeId ID of the place to get details for
         * @returns Promise containing place details
         */
        async getPlaceDetails(placeId: string): Promise<any> {
            const command = new GetPlaceCommand({
                IndexName: placeIndexName,
                PlaceId: placeId,
            });

            const response = await locationClient.send(command);

            if (!response.Place) {
                throw new Error(`Place not found: ${placeId}`);
            }

            return mapAwsPlaceToPlaceDetails(response.Place, placeId);
        }
    };
}