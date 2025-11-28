export interface LocationProviderConfig {
    // Authentication
    apiKey?: string;
    region?: string;

    // Defaults
    language?: string;                // "en", "sv", "de"
    countries?: string[];             // ["SWE", "DEU"] - limit search scope

    // Performance
    timeout?: number;                 // Request timeout (ms)
    retryAttempts?: number;

    // Provider-specific options
    metadata?: Record<string, any>;
}

export interface Coordinates {
    lat: number;
    lng: number;
}


export interface SuggestionParams {
    // Required
    query: string;                    // User's search query

    // Optional filters
    maxResults?: number;              // Default: 5
    language?: string;
    countries?: string[];             // Override config

    // Geographic bias (prefer nearby results)
    biasPosition?: Coordinates;       // User's current location

    // Type filters (optional)
    placeTypes?: string[];            // ["locality", "street", "address"]
}

export interface LocationSuggestion {
    // Display information
    title: string;                    // Main display text: "Stockholm, Sweden"
    subtitle?: string;                // Secondary text: "Capital of Sweden"

    // Geographic data
    coordinates?: Coordinates;        // May not always be available in suggestions

    // Provider-specific data (for follow-up calls)
    placeId?: string;                 // Google: place_id, AWS: PlaceId
    queryId?: string;                 // AWS: QueryId for SearchText follow-up

    // Metadata
    placeType?: string;               // "locality", "street", "address", "poi"
    distance?: number;                // Distance from search origin (meters)

    // Internal use
    provider: string;                 // "aws", "google", "azure"
    rawData?: any;                    // Original provider response (for debugging)
}


export interface ReverseGeocodeParams {
    // Required
    coordinates: Coordinates;

    // Optional
    language?: string;
    maxResults?: number;              // Default: 1 (closest address)
}

export interface LocationAddress {
    // Formatted address
    fullAddress: string;              // Complete formatted address

    // Address components
    street?: string;
    streetNumber?: string;
    city?: string;
    district?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    countryCode?: string;             // ISO 3166-1 alpha-3: "SWE", "DEU"

    // Geographic data
    coordinates: Coordinates;

    // Metadata
    placeType?: string;
    accuracy?: number;                // Confidence level 0-1

    // Internal use
    provider: string;
    rawData?: any;
}


export interface LocationService {
    /**
   * Get autocomplete suggestions for search box
   * Use case: User types "Stock..." → Show ["Stockholm", "Stockton", ...]
   */
    getSuggestions(params: SuggestionParams): Promise<LocationSuggestion[]>;

    /**
     * Get address from coordinates (reverse geocoding)
     * Use case: User clicks "Get my location" → Show "Drottninggatan 10, Stockholm"
     */
    reverseGeocode(params: ReverseGeocodeParams): Promise<LocationAddress>;

    /**
     * Optional: Get detailed location info if suggestion doesn't have coordinates
     * Use case: User selects suggestion → Need full coordinates
     */
    getLocationDetails?(placeId: string): Promise<LocationAddress>;
}