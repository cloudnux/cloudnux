import { locations } from "@@cloud";

async function searchPlaces(text: string, maxResults: number, nearby?: {
    latitude: number,
    longitude: number
}) {
    return locations.searchPlaces(text, maxResults, nearby);
}

function getPlaceDetails(placeId: string) {
    return locations.getPlaceDetails(placeId);
}

export const cloudLocations = {
    searchPlaces,
    getPlaceDetails
}