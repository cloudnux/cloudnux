import { describe, expect, it } from 'vitest';

import { createLocationService } from '../../services/location';
import { distanceKm, liveEnv, PLACES } from './helpers';

describe.skipIf(!liveEnv.mapsEnabled)('live: location (Azure Maps)', () => {
    const location = createLocationService({ retryAttempts: 2 });

    it('calculateRoute: Stockholm → Arlanda → Uppsala, avoiding tolls', async () => {
        const route = await location.calculateRoute(PLACES.stockholm, PLACES.uppsala, [PLACES.arlanda], true);

        // ~75–85 km by road; keep the bounds loose, the point is that the mapping is sane.
        expect(route.totalDistanceKm).toBeGreaterThan(60);
        expect(route.totalDistanceKm).toBeLessThan(120);
        expect(route.totalDurationMinutes).toBeGreaterThan(40);
        expect(route.totalDurationMinutes).toBeLessThan(150);

        // One leg per waypoint gap, and legs add up to the total.
        expect(route.legs).toHaveLength(2);
        const legSum = route.legs.reduce((sum, leg) => sum + leg.distanceKm, 0);
        expect(Math.abs(legSum - route.totalDistanceKm) / route.totalDistanceKm).toBeLessThan(0.05);
        for (const leg of route.legs) {
            expect(leg.coordinates.length).toBeGreaterThan(1);
        }

        // Geometry is [lat, lng] the right way round: ends near the requested points.
        expect(route.coordinates.length).toBeGreaterThan(20);
        expect(distanceKm(route.coordinates[0], PLACES.stockholm)).toBeLessThan(3);
        expect(distanceKm(route.coordinates[route.coordinates.length - 1], PLACES.uppsala)).toBeLessThan(3);
        expect(distanceKm(route.legs[0].endPosition, PLACES.arlanda)).toBeLessThan(5);
        expect(distanceKm(route.legs[1].startPosition, PLACES.arlanda)).toBeLessThan(5);

        const [minLng, minLat, maxLng, maxLat] = route.bbox;
        for (const p of [PLACES.stockholm, PLACES.arlanda, PLACES.uppsala]) {
            expect(p.lng).toBeGreaterThan(minLng);
            expect(p.lng).toBeLessThan(maxLng);
            expect(p.lat).toBeGreaterThan(minLat);
            expect(p.lat).toBeLessThan(maxLat);
        }

        // Sampled along the geometry; the polyline length should be close to the reported distance.
        expect(route.sampledPoints[0].distanceFromStartKm).toBe(0);
        const sampledKm = route.sampledPoints[route.sampledPoints.length - 1].distanceFromStartKm;
        expect(Math.abs(sampledKm - route.totalDistanceKm) / route.totalDistanceKm).toBeLessThan(0.15);
    });

    it('getSuggestions → getLocationDetails for an address', async () => {
        const suggestions = await location.getSuggestions({
            query: 'Drottninggatan 10, Stockholm',
            biasPosition: PLACES.stockholm,
            maxResults: 5,
        });
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.length).toBeLessThanOrEqual(5);
        for (const s of suggestions) {
            expect(s.provider).toBe('azure');
            expect(s.placeId).toEqual(expect.any(String));
        }

        const details = await location.getLocationDetails!(suggestions[0].placeId!);
        expect(details.countryCode).toBe('SWE');
        expect(details.fullAddress.toLowerCase()).toContain('drottninggatan');
        expect(distanceKm(details.coordinates, PLACES.drottninggatan10)).toBeLessThan(3);
    });

    it('getSuggestions → getLocationDetails for a place', async () => {
        const suggestions = await location.getSuggestions({ query: 'Uppsala', biasPosition: PLACES.uppsala });
        const uppsala = suggestions.find(s => s.title.includes('Uppsala'));
        expect(uppsala, `"Uppsala" among: ${suggestions.map(s => s.title).join(', ')}`).toBeDefined();

        const details = await location.getLocationDetails!(uppsala!.placeId!);
        expect(details.countryCode).toBe('SWE');
        expect(distanceKm(details.coordinates, PLACES.uppsala)).toBeLessThan(15);
    });

    it('getSuggestions with several countries filters client-side', async () => {
        const suggestions = await location.getSuggestions({
            query: 'Oslo',
            countries: ['SWE', 'NOR'],
            biasPosition: PLACES.oslo,
        });
        expect(suggestions.some(s => s.title.includes('Oslo'))).toBe(true);
        for (const s of suggestions) {
            const iso = s.rawData?.properties?.address?.countryRegion?.ISO;
            if (iso) expect(['SE', 'NO']).toContain(iso);
        }
    });

    it('reverseGeocode: central Stockholm', async () => {
        const address = await location.reverseGeocode({ coordinates: PLACES.drottninggatan10 });
        expect(address.countryCode).toBe('SWE');
        expect(address.city).toBe('Stockholm');
        expect(address.fullAddress.length).toBeGreaterThan(0);
        expect(address.coordinates).toEqual(PLACES.drottninggatan10);
        expect(address.provider).toBe('azure');
    });
});
