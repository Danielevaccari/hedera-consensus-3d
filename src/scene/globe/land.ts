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
    const segment = (p: Pt, q: Pt) => {
        latLonToUnit(p[1], p[0], a).multiplyScalar(radius);
        latLonToUnit(q[1], q[0], b).multiplyScalar(radius);
        out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    };
    for (const poly of polys) {
        for (const ring of poly) {
            for (const line of smoothedLines(ring)) {
                const last = line.closed ? line.points.length : line.points.length - 1;
                for (let i = 0; i < last; i++)
                    segment(line.points[i], line.points[(i + 1) % line.points.length]);
            }
        }
    }
    return new Float32Array(out);
}

type Pt = number[]; // [lon, lat]

/** How many times the corners of a coastline are cut. Each round rounds it further. */
const SMOOTHING_ROUNDS = 2;

/** The polygons are cut along the date line and at the south pole: those edges are not coast. */
const isCut = (p: Pt, q: Pt) =>
    (Math.abs(p[0]) > 179.99 && Math.abs(q[0]) > 179.99) || (p[1] < -89.99 && q[1] < -89.99);

/** Corner cutting (Chaikin): every corner becomes two points a quarter of the way along its edges. */
function cutCorners(points: Pt[], closed: boolean): Pt[] {
    const n = points.length;
    if (n < 3) return points;
    const out: Pt[] = [];
    const edges = closed ? n : n - 1;
    for (let i = 0; i < edges; i++) {
        const p = points[i];
        const q = points[(i + 1) % n];
        // an open line keeps its two end points where they are
        if (closed || i > 0) out.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]]);
        if (closed || i < edges - 1)
            out.push([0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]);
    }
    return closed ? out : [points[0], ...out, points[n - 1]];
}

/**
 * A polygon ring as smooth lines. Real coastline is split into runs wherever the polygon was cut
 * (those edges are dropped) and each run is smoothed on its own, so smoothing can never draw
 * across a cut. An island, which has no cuts, is smoothed all the way round.
 */
function smoothedLines(ring: Pt[]): { points: Pt[]; closed: boolean }[] {
    const smooth = (pts: Pt[], closed: boolean) => {
        for (let k = 0; k < SMOOTHING_ROUNDS; k++) pts = cutCorners(pts, closed);
        return { points: pts, closed };
    };
    const hasCut = ring.some((p, i) => i > 0 && isCut(ring[i - 1], p));
    if (!hasCut) return [smooth(ring.slice(0, -1), true)]; // the last point repeats the first
    const runs: Pt[][] = [];
    let run: Pt[] = [ring[0]];
    for (let i = 1; i < ring.length; i++) {
        if (isCut(ring[i - 1], ring[i])) {
            if (run.length > 1) runs.push(run);
            run = [ring[i]];
        } else run.push(ring[i]);
    }
    if (run.length > 1) runs.push(run);
    return runs.map(r => smooth(r, false));
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
