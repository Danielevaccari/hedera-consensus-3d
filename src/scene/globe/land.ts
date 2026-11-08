// Natural Earth land polygons rasterised onto an equirectangular canvas. The map data and topojson
// are loaded on first use, so the tower view never downloads them.
import type { GeometryObject, Topology } from "topojson-specification";

type Ring = number[][];
type Poly = Ring[];

export interface LandRaster {
    /** white land on transparent ocean */
    canvas: HTMLCanvasElement;
    /** the canvas's alpha channel, one byte per pixel (255 = land) */
    alpha: Uint8Array;
    w: number;
    h: number;
}

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

export async function rasterizeLand(w = 2048, h = 1024): Promise<LandRaster> {
    const [topojson, landModule] = await Promise.all([
        import("topojson-client"),
        import("world-atlas/land-110m.json"),
    ]);
    const topo = landModule.default as unknown as Topology;
    const land = topo.objects.land as GeometryObject;
    const polys = polygonsOf(topojson.feature(topo, land));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#fff";
    const px = (lon: number) => ((lon + 180) / 360) * w;
    const py = (lat: number) => ((90 - lat) / 180) * h;
    for (const poly of polys) {
        // draw shifted copies so rings that cross ±180° still fill correctly
        for (const off of [-w, 0, w]) {
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

    const rgba = ctx.getImageData(0, 0, w, h).data;
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < alpha.length; i++) alpha[i] = rgba[i * 4 + 3];
    return { canvas, alpha, w, h };
}
