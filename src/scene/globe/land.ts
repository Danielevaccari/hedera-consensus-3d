// The globe's map: Natural Earth coastlines (50 m) and a faint lat/lon grid, as plain vector lines
// on the sphere. The map data and topojson are loaded on first use, so the tower view never
// downloads them.
import type { GeometryObject, Topology } from "topojson-specification";
import { latLonToUnit } from "./geo";

type Ring = number[][];
type Poly = Ring[];

function polygonsOf(geo: unknown): Poly[] {
    const out: Poly[] = [];
    const visit = (g: {
        type: string;
        coordinates?: unknown;
        geometry?: unknown;
        features?: unknown;
    }) => {
        if (g.type === "FeatureCollection") (g.features as (typeof g)[]).forEach(visit);
        else if (g.type === "Feature") visit(g.geometry as typeof g);
        else if (g.type === "Polygon") out.push(g.coordinates as Poly);
        else if (g.type === "MultiPolygon") out.push(...(g.coordinates as Poly[]));
    };
    visit(geo as Parameters<typeof visit>[0]);
    return out;
}

/**
 * Coastline segments (x, y, z of both ends, six floats per segment) on a sphere of the given
 * radius. The polygons are cut along the date line and at the south pole, which would draw
 * straight lines across the map, so those edges are skipped.
 */
export async function loadCoastlines(radius: number): Promise<Float32Array> {
    const [topojson, landModule] = await Promise.all([
        import("topojson-client"),
        import("world-atlas/land-50m.json"),
    ]);
    const topo = landModule.default as unknown as Topology;
    const land = topo.objects.land as GeometryObject;
    const polys = polygonsOf(topojson.feature(topo, land));

    const out: number[] = [];
    const a = latLonToUnit(0, 0);
    const b = latLonToUnit(0, 0);
    for (const poly of polys) {
        for (const ring of poly) {
            for (let i = 1; i < ring.length; i++) {
                const [lon1, lat1] = ring[i - 1];
                const [lon2, lat2] = ring[i];
                const onDateLine = Math.abs(lon1) > 179.99 && Math.abs(lon2) > 179.99;
                const atPole = lat1 < -89.99 && lat2 < -89.99;
                if (onDateLine || atPole) continue;
                latLonToUnit(lat1, lon1, a).multiplyScalar(radius);
                latLonToUnit(lat2, lon2, b).multiplyScalar(radius);
                out.push(a.x, a.y, a.z, b.x, b.y, b.z);
            }
        }
    }
    return new Float32Array(out);
}

/** A lat/lon grid every `step` degrees, as line segments on a sphere of the given radius. */
export function buildGraticule(radius: number, step = 30): Float32Array {
    const out: number[] = [];
    const a = latLonToUnit(0, 0);
    const b = latLonToUnit(0, 0);
    const seg = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        latLonToUnit(lat1, lon1, a).multiplyScalar(radius);
        latLonToUnit(lat2, lon2, b).multiplyScalar(radius);
        out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    };
    const fine = 3; // degrees per segment along a line, so it follows the curve
    for (let lat = -90 + step; lat < 90; lat += step)
        for (let lon = -180; lon < 180; lon += fine) seg(lat, lon, lat, lon + fine);
    for (let lon = -180; lon < 180; lon += step)
        for (let lat = -90; lat < 90; lat += fine) seg(lat, lon, lat + fine, lon);
    return new Float32Array(out);
}
