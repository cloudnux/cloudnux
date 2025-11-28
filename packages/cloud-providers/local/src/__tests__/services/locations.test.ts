import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLocalLocationService } from '../../services/locations';
import { createTempDir, cleanupDir } from '../helpers/test-utils';

describe('LocalLocationService', () => {
  let tempDir: string;
  let locationService: ReturnType<typeof createLocalLocationService>;

  beforeEach(() => {
    // Create a temporary directory for each test
    tempDir = createTempDir();
    process.env.DEV_CLOUD_LOCATION_PATH = tempDir;
    locationService = createLocalLocationService();
  });

  afterEach(() => {
    // Clean up temporary directory after each test
    cleanupDir(tempDir);
    delete process.env.DEV_CLOUD_LOCATION_PATH;
  });

  describe('getSuggestions', () => {
    it('should return location suggestions based on query', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Stockholm',
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0]).toHaveProperty('title');
      expect(suggestions[0]).toHaveProperty('coordinates');
      expect(suggestions[0]).toHaveProperty('placeId');
      expect(suggestions[0].provider).toBe('local');
    });

    it('should filter suggestions by query text', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Gamla Stan',
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].title).toContain('Gamla Stan');
    });

    it('should match query in title', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Kungliga',
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].title).toContain('Kungliga');
    });

    it('should match query in subtitle', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Coffee',
      });

      const titles = suggestions.map(s => s.title);
      expect(titles.some(title => title.includes('Coffee') || title.includes('Espresso'))).toBe(true);
    });

    it('should match query in city', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Stockholm',
      });

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should be case insensitive', async () => {
      const lower = await locationService.getSuggestions({ query: 'stockholm' });
      const upper = await locationService.getSuggestions({ query: 'STOCKHOLM' });
      const mixed = await locationService.getSuggestions({ query: 'StOcKhOlM' });

      expect(lower.length).toBeGreaterThan(0);
      expect(upper.length).toBeGreaterThan(0);
      expect(mixed.length).toBeGreaterThan(0);
      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    it('should limit results to maxResults', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Stockholm',
        maxResults: 3,
      });

      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should default to 5 results if maxResults not specified', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Stockholm',
      });

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should calculate distance when biasPosition is provided', async () => {
      const biasPosition = {
        lat: 59.3293,
        lng: 18.0686,
      };

      const suggestions = await locationService.getSuggestions({
        query: 'Stockholm',
        biasPosition,
      });

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(suggestion.distance).toBeDefined();
        expect(typeof suggestion.distance).toBe('number');
        expect(suggestion.distance).toBeGreaterThan(0);
      });
    });

    it('should sort by distance when biasPosition is provided', async () => {
      const biasPosition = {
        lat: 59.3293,
        lng: 18.0686,
      };

      const suggestions = await locationService.getSuggestions({
        query: 'Stockholm',
        biasPosition,
        maxResults: 10,
      });

      // Check if sorted by distance (ascending)
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i].distance!).toBeGreaterThanOrEqual(suggestions[i - 1].distance!);
      }
    });

    it('should filter by placeTypes', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Stockholm',
        placeTypes: ['poi'],
      });

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(suggestion.placeType).toBe('poi');
      });
    });

    it('should return empty array if no matches found', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'NonExistentLocation123456',
      });

      expect(suggestions).toEqual([]);
    });

    it('should include rawData in suggestions', async () => {
      const suggestions = await locationService.getSuggestions({
        query: 'Gamla Stan',
      });

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].rawData).toBeDefined();
      expect(suggestions[0].rawData).toHaveProperty('placeId');
      expect(suggestions[0].rawData).toHaveProperty('fullAddress');
    });
  });

  describe('reverseGeocode', () => {
    it('should return address for given coordinates', async () => {
      const coordinates = {
        lat: 59.3254,
        lng: 18.0716,
      };

      const address = await locationService.reverseGeocode({ coordinates });

      expect(address).toHaveProperty('fullAddress');
      expect(address).toHaveProperty('coordinates');
      expect(address.provider).toBe('local');
    });

    it('should return the closest location to coordinates', async () => {
      // Coordinates very close to Gamla Stan
      const coordinates = {
        lat: 59.3255,
        lng: 18.0715,
      };

      const address = await locationService.reverseGeocode({ coordinates });

      expect(address.fullAddress).toContain('Gamla Stan');
    });

    it('should include all address components', async () => {
      const coordinates = {
        lat: 59.3268,
        lng: 18.0718,
      };

      const address = await locationService.reverseGeocode({ coordinates });

      expect(address).toHaveProperty('street');
      expect(address).toHaveProperty('city');
      expect(address).toHaveProperty('region');
      expect(address).toHaveProperty('postalCode');
      expect(address).toHaveProperty('country');
      expect(address).toHaveProperty('countryCode');
    });

    it('should work with coordinates far from exact match', async () => {
      // Random coordinates in Stockholm area
      const coordinates = {
        lat: 59.33,
        lng: 18.07,
      };

      const address = await locationService.reverseGeocode({ coordinates });

      expect(address).toBeDefined();
      expect(address.fullAddress).toBeTruthy();
      expect(address.city).toBe('Stockholm');
    });

    it('should include rawData in address', async () => {
      const coordinates = {
        lat: 59.3254,
        lng: 18.0716,
      };

      const address = await locationService.reverseGeocode({ coordinates });

      expect(address.rawData).toBeDefined();
      expect(address.rawData).toHaveProperty('placeId');
    });
  });

  describe('getLocationDetails', () => {
    it('should return location details by placeId', async () => {
      const details = await locationService.getLocationDetails('place-001');

      expect(details).toBeDefined();
      expect(details.fullAddress).toBeTruthy();
      expect(details.coordinates).toBeDefined();
      expect(details.provider).toBe('local');
    });

    it('should include all address fields', async () => {
      const details = await locationService.getLocationDetails('place-002');

      expect(details).toHaveProperty('fullAddress');
      expect(details).toHaveProperty('street');
      expect(details).toHaveProperty('streetNumber');
      expect(details).toHaveProperty('city');
      expect(details).toHaveProperty('region');
      expect(details).toHaveProperty('postalCode');
      expect(details).toHaveProperty('country');
      expect(details).toHaveProperty('countryCode');
      expect(details).toHaveProperty('coordinates');
    });

    it('should throw error for non-existent placeId', async () => {
      await expect(
        locationService.getLocationDetails('non-existent-place')
      ).rejects.toThrow('Place not found');
    });

    it('should include rawData', async () => {
      const details = await locationService.getLocationDetails('place-001');

      expect(details.rawData).toBeDefined();
      expect(details.rawData).toHaveProperty('placeId');
      expect(details.rawData).toHaveProperty('title');
    });

    it('should return correct details for different placeIds', async () => {
      const details1 = await locationService.getLocationDetails('place-001');
      const details2 = await locationService.getLocationDetails('place-002');

      expect(details1.fullAddress).not.toBe(details2.fullAddress);
      expect(details1.coordinates).not.toEqual(details2.coordinates);
    });
  });

  describe('integration tests', () => {
    it('should work with getSuggestions -> getLocationDetails workflow', async () => {
      // Get suggestions
      const suggestions = await locationService.getSuggestions({
        query: 'Kungliga',
      });

      expect(suggestions.length).toBeGreaterThan(0);

      // Get details for first suggestion
      const details = await locationService.getLocationDetails(suggestions[0].placeId);

      expect(details).toBeDefined();
      expect(details.fullAddress).toBeTruthy();
      expect(details.coordinates).toEqual(suggestions[0].coordinates);
    });

    it('should work with biasPosition and reverseGeocode', async () => {
      const testCoords = {
        lat: 59.3268,
        lng: 18.0718,
      };

      // Reverse geocode
      const address = await locationService.reverseGeocode({
        coordinates: testCoords,
      });

      expect(address).toBeDefined();

      // Get suggestions near this location
      const suggestions = await locationService.getSuggestions({
        query: 'Stockholm',
        biasPosition: testCoords,
        maxResults: 5,
      });

      expect(suggestions.length).toBeGreaterThan(0);
      // First result should be the closest
      expect(suggestions[0].distance).toBeLessThan(1000); // Within 1km
    });
  });
});
