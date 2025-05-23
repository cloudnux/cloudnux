export interface LocationService {
    /**
     * Search for places based on a query
     * @param query Search query
     * @param options Search options like bounding box, filters, etc.
     * @returns Promise containing search results
     */
    searchPlaces(query: string, options?: PlaceSearchOptions): Promise<PlaceSearchResult[]>;

    /**
     * Get detailed information about a specific place
     * @param placeId ID of the place to get details for
     * @returns Promise containing place details
     */
    getPlaceDetails(placeId: string): Promise<PlaceDetails>;
}

export interface PlaceSearchOptions {
    /** Bounding box to search within */
    boundingBox?: {
        minLongitude: number;
        minLatitude: number;
        maxLongitude: number;
        maxLatitude: number;
    };
    /** Maximum number of results to return */
    maxResults?: number;
    /** Filter results by category */
    categories?: string[];
    /** Language code for results */
    language?: string;
}

export interface PlaceSearchResult {
    /** Unique identifier for the place */
    placeId: string;
    /** Place name */
    text: string;
}

export interface PlaceDetails extends PlaceSearchResult {
    /** Place address */
    address?: string;
    /** Geographic coordinates */
    coordinates: {
        latitude: number;
        longitude: number;
    };
    /** Distance from search center if applicable */
    distance?: number;
    /** Place categories/types */
    categories?: string[];
    /** Full formatted address */
    formattedAddress: string;
    /** Phone number */
    phoneNumber?: string;
    /** Website URL */
    website?: string;
    /** Opening hours */
    openingHours?: {
        periods: {
            day: number;
            open?: string;
            close?: string;
        }[];
        weekdayText?: string[];
    };
    /** Reviews if available */
    reviews?: {
        rating: number;
        text?: string;
        time?: number;
    }[];
    /** Additional place data */
    additionalData?: Record<string, any>;
}