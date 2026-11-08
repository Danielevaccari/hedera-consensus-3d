// Dotted land for the globe: rasterise Natural Earth land polygons onto a small equirectangular
// canvas, then keep the points of an even (Fibonacci) sphere grid that fall on land.
// The map data and topojson are loaded on first use, so the tower view never downloads them.
import { MathUtils, Vector3 } from "three";
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

/** Positions (x, y, z triples) of land dots on a sphere of the given radius. */
export async function buildLandPoints(radius: number, count = 42000): Promise<Float32Array> {
    const [topojson, landModule] = await Promise.all([
        import("topojson-client"),
        import("world-atlas/land-110m.json"),
    ]);
    const topo = landModule.default as unknown as Topology;
    const land = topo.objects.land as GeometryObject;
    const polys = polygonsOf(topojson.feature(topo, land));

    const W = 2048;
    const H = 1024;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    const px = (lon: number) => ((lon + 180) / 360) * W;
    const py = (lat: number) => ((90 - lat) / 180) * H;
    for (const poly of polys) {
        // draw shifted copies so rings that cross ±180° still fill correctly
        for (const off of [-W, 0, W]) {
            ctx.beginPath();
            for (const ring of poly) {
                let prevLon: number | null = null;
                let shift = 0;
                ring.forEach(([lon, lat], i) => {
                    if (prevLon !== null && Math.abs(lon - prevLon) > 180)
                        shift += lon < prevLon ? 360 : -360;
                    prevLon = lon;
                    const x = px(lon + shift) + off;
                    const y = py(lat);
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.closePath();
            }
            ctx.fill("evenodd");
        }
    }

    const img = ctx.getImageData(0, 0, W, H).data;
    const pts: number[] = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    const v = new Vector3();
    for (let i = 0; i < count; i++) {
        const y = 1 - (2 * (i + 0.5)) / count;
        const th = golden * i;
        const lat = MathUtils.radToDeg(Math.asin(y));
        let lon = MathUtils.radToDeg(th) % 360;
        if (lon > 180) lon -= 360;
        const ix = Math.min(W - 1, Math.floor(px(lon)));
        const iy = Math.min(H - 1, Math.floor(py(lat)));
        if (img[(iy * W + ix) * 4 + 3] < 128) continue;
        latLonToUnit(lat, lon, v).multiplyScalar(radius);
        pts.push(v.x, v.y, v.z);
    }
    return new Float32Array(pts);
}
