import { LocationClient, GetPlaceCommand, SearchPlaceIndexForSuggestionsCommand, } from "@aws-sdk/client-location";
import { env } from "../utils/env";

let client: LocationClient;
const ensureClient = async () => {
    if (!client) {
        client = new LocationClient();
    }
    return client;
}

export async function searchPlaces(text: string, maxResults: number, nearby?: {
    latitude: number,
    longitude: number
}) {
    const client = await ensureClient();
    const command = new SearchPlaceIndexForSuggestionsCommand({
        IndexName: env("LOCATION_INDEX_NAME"),
        Text: text,
        MaxResults: maxResults,
        BiasPosition: nearby ? [nearby.longitude, nearby.latitude] : undefined,
        //TODO: Filter by country should set properly from the frontend
        FilterCountries: ["SWE"],
        FilterCategories: ["AddressType", "StreetType", "RegionType", "MunicipalityType", "NeighborhoodType"]
    });
    const results = await client.send(command);
    return results;
}

export async function getPlaceDetails(placeId: string) {
    const client = await ensureClient();
    const command = new GetPlaceCommand({
        IndexName: env("LOCATION_INDEX_NAME"),
        PlaceId: placeId
    });
    const results = await client.send(command);
    return results;
}