// A procedural, natural-looking earth built from the land mask: ocean depths with shallow coastal
// water, biome-tinted land, polar ice, a specular map for the sea, and a cloud layer. Everything is
// generated from the Natural Earth outlines, so there are no texture downloads.
import { CanvasTexture, SRGBColorSpace } from "three";
import type { LandRaster } from "./land";

// ---------- 3D value noise on the sphere (no seams at the date line or the poles) ----------
const hash = (x: number, y: number, z: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function noise3(x: number, y: number, z: number) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const u = smooth(x - xi);
    const v = smooth(y - yi);
    const w = smooth(z - zi);
    const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz);
    return lerp(
        lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
        lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
        w,
    );
}

/** Fractal noise, roughly 0..1. */
function fbm(x: number, y: number, z: number, octaves: number) {
    let amp = 0.5;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += amp * noise3(x * freq, y * freq, z * freq);
        norm += amp;
        freq *= 2;
        amp *= 0.5;
    }
    return sum / norm;
}

const smoothstep = (a: number, b: number, x: number) =>
    smooth(Math.min(1, Math.max(0, (x - a) / (b - a))));

type RGB = [number, number, number];
const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
];

const OCEAN_DEEP = hex(0x0a2547);
const OCEAN_MID = hex(0x135086);
const OCEAN_SHALLOW = hex(0x2c8aa8);
const SNOW = hex(0xdde5ee);
const FOREST = hex(0x2f6a3a);
const GRASS = hex(0x5c8b45);
const SAND = hex(0xc4a76a);
const ROCK = hex(0x8c7a5a);
const TAIGA = hex(0x35563d);
const TUNDRA = hex(0x7d8670);

function texture(canvas: HTMLCanvasElement) {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
    return t;
}

export interface EarthMaps {
    color: CanvasTexture;
    /** bright over open water so the sea catches the light, dark over land and ice */
    specular: CanvasTexture;
    /** white with an alpha pattern; laid over the globe on a slightly larger sphere */
    clouds: CanvasTexture;
}

export function buildEarthMaps(land: LandRaster): EarthMaps {
    const { w, h, alpha } = land;

    // a blurred copy of the mask gives "distance to the coast", for shallow water
    const blurCanvas = document.createElement("canvas");
    blurCanvas.width = w;
    blurCanvas.height = h;
    const bctx = blurCanvas.getContext("2d", { willReadFrequently: true })!;
    bctx.filter = "blur(7px)";
    bctx.drawImage(land.canvas, 0, 0);
    const blurData = bctx.getImageData(0, 0, w, h).data;

    const color = document.createElement("canvas");
    color.width = w;
    color.height = h;
    const cctx = color.getContext("2d")!;
    const cimg = cctx.createImageData(w, h);
    const spec = document.createElement("canvas");
    spec.width = w;
    spec.height = h;
    const sctx = spec.getContext("2d")!;
    const simg = sctx.createImageData(w, h);
    const cd = cimg.data;
    const sd = simg.data;

    for (let y = 0; y < h; y++) {
        const lat = 90 - ((y + 0.5) / h) * 180;
        const absLat = Math.abs(lat);
        const la = (lat * Math.PI) / 180;
        const cl = Math.cos(la);
        const ny = Math.sin(la);
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            const lon = ((x + 0.5) / w) * 360 - 180;
            const lo = (lon * Math.PI) / 180;
            const nx = cl * Math.cos(lo);
            const nz = cl * Math.sin(lo);
            let col: RGB;
            let shine: number;

            if (alpha[i] > 127) {
                // ---- land: biome by latitude, broken up with noise ----
                const n = fbm(nx * 5 + 11, ny * 5, nz * 5, 3);
                const rough = fbm(nx * 14, ny * 14 + 3, nz * 14, 2);
                const desert = smoothstep(12, 20, absLat) * (1 - smoothstep(30, 40, absLat));
                const aridity =
                    desert * smoothstep(0.35, 0.65, fbm(nx * 2.2 + 5, ny * 2.2, nz * 2.2, 3));
                let c = mix(FOREST, GRASS, smoothstep(0.3, 0.7, n));
                c = mix(c, absLat > 50 ? TAIGA : c, smoothstep(50, 62, absLat));
                c = mix(c, mix(SAND, ROCK, rough), aridity);
                c = mix(c, TUNDRA, smoothstep(62, 70, absLat) * 0.9);
                // ice: Antarctica, Greenland and the far north
                const greenland = lat > 60 && lat < 84 && lon > -75 && lon < -12;
                const ice =
                    lat < -63 || greenland || lat > 78 ? 1 : smoothstep(68, 76, absLat) * 0.7;
                c = mix(c, SNOW, Math.min(1, ice * (0.85 + 0.15 * rough)));
                const shade = 0.82 + 0.36 * rough;
                col = [c[0] * shade, c[1] * shade, c[2] * shade];
                shine = ice > 0.5 ? 0.35 : 0.04;
            } else {
                // ---- ocean: deeper away from the coast, darker towards the poles ----
                const coast = blurData[i * 4 + 3] / 255; // 0 open sea .. ~0.5 at the shore
                const n = fbm(nx * 3 + 40, ny * 3, nz * 3, 2);
                let c = mix(
                    OCEAN_DEEP,
                    OCEAN_MID,
                    smoothstep(0.35, 0.7, n) * 0.8 + (1 - absLat / 90) * 0.25,
                );
                c = mix(c, OCEAN_SHALLOW, smoothstep(0.04, 0.45, coast));
                const seaIce = smoothstep(72, 82, absLat) * (0.6 + 0.4 * n);
                c = mix(c, SNOW, seaIce);
                col = c;
                shine = 0.95 * (1 - seaIce);
            }

            const o = i * 4;
            cd[o] = col[0];
            cd[o + 1] = col[1];
            cd[o + 2] = col[2];
            cd[o + 3] = 255;
            const s = Math.round(shine * 255);
            sd[o] = sd[o + 1] = sd[o + 2] = s;
            sd[o + 3] = 255;
        }
    }
    cctx.putImageData(cimg, 0, 0);
    sctx.putImageData(simg, 0, 0);

    // ---- clouds: fractal noise thresholded into soft banks ----
    const cw = 1024;
    const ch = 512;
    const cloud = document.createElement("canvas");
    cloud.width = cw;
    cloud.height = ch;
    const kctx = cloud.getContext("2d")!;
    const kimg = kctx.createImageData(cw, ch);
    const kd = kimg.data;
    for (let y = 0; y < ch; y++) {
        const la = (90 - ((y + 0.5) / ch) * 180) * (Math.PI / 180);
        const cl = Math.cos(la);
        const ny = Math.sin(la);
        for (let x = 0; x < cw; x++) {
            const lo = (((x + 0.5) / cw) * 360 - 180) * (Math.PI / 180);
            const nx = cl * Math.cos(lo);
            const nz = cl * Math.sin(lo);
            const n = fbm(nx * 3.2 + 90, ny * 3.2 + 7, nz * 3.2, 5);
            // weather fronts: a little more cover in the storm belts than over the subtropics
            const belt = 0.04 * Math.cos(la * 3);
            const a = smoothstep(0.6 - belt, 0.86, n);
            const o = (y * cw + x) * 4;
            kd[o] = kd[o + 1] = kd[o + 2] = 226; // slightly grey: pure white would bloom
            kd[o + 3] = Math.round(a * 190);
        }
    }
    kctx.putImageData(kimg, 0, 0);

    return { color: texture(color), specular: texture(spec), clouds: texture(cloud) };
}
