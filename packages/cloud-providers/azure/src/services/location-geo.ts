import type { Coordinates, RoutePoint } from '@cloudnux/core-cloud-provider';

// Geometry helpers for RouteResult. Same algorithm as the AWS adapter, so
// sampledPoints/bbox are comparable across providers.

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

/** Great-circle distance in km. */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Points every `intervalKm` along the route, always including origin and destination. */
export function sampleRoutePoints(coordinates: Coordinates[], intervalKm: number): RoutePoint[] {
    if (coordinates.length === 0) return [];

    const sampled: RoutePoint[] = [{ ...coordinates[0], distanceFromStartKm: 0 }];
    let accumulated = 0;
    let lastSampled = 0;

    for (let i = 1; i < coordinates.length; i++) {
        accumulated += haversineDistance(coordinates[i - 1], coordinates[i]);
        if (accumulated - lastSampled >= intervalKm) {
            sampled.push({ ...coordinates[i], distanceFromStartKm: accumulated });
            lastSampled = accumulated;
        }
    }

    const last = coordinates[coordinates.length - 1];
    const lastPoint = sampled[sampled.length - 1];
    if (lastPoint.lat !== last.lat || lastPoint.lng !== last.lng) {
        sampled.push({ ...last, distanceFromStartKm: accumulated });
    }
    return sampled;
}

/** [minLng, minLat, maxLng, maxLat] padded by 10% on each axis. */
export function paddedBbox(coordinates: Coordinates[]): [number, number, number, number] {
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const { lng, lat } of coordinates) {
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
    }
    const lngPad = (maxLng - minLng) * 0.1;
    const latPad = (maxLat - minLat) * 0.1;
    return [minLng - lngPad, minLat - latPad, maxLng + lngPad, maxLat + latPad];
}
