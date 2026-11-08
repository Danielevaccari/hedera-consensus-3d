import {
    AdditiveBlending,
    BufferAttribute,
    BufferGeometry,
    Color,
    DynamicDrawUsage,
    InstancedInterleavedBuffer,
    InterleavedBufferAttribute,
    LineBasicMaterial,
    LineSegments,
    type Scene,
} from "three";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

/**
 * A per-frame rebuilt batch of coloured line segments.
 *
 * Both meshes read the same arrays: 1-pixel lines for the calm style, and thick screen-space lines
 * (fatWidth CSS px) for the flashy style, which stay visible under the bloom glow.
 */
export class LineBuf {
    private n = 0;
    private base = new Color(0, 0, 0);
    private clamp = false;
    private gain = 1;
    private pos: Float32Array;
    private col: Float32Array;
    private geo = new BufferGeometry();
    private pa: BufferAttribute;
    private ca: BufferAttribute;
    private fatGeo = new LineSegmentsGeometry();
    private ib: InstancedInterleavedBuffer;
    private cb: InstancedInterleavedBuffer;
    readonly thin: LineSegments;
    readonly fat: LineSegments2;

    constructor(
        scene: Scene,
        private cap: number,
        fatWidth = 1.4,
    ) {
        this.pos = new Float32Array(cap * 6);
        this.col = new Float32Array(cap * 6);
        this.pa = new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage);
        this.ca = new BufferAttribute(this.col, 3).setUsage(DynamicDrawUsage);
        this.geo.setAttribute("position", this.pa);
        this.geo.setAttribute("color", this.ca);
        this.thin = new LineSegments(
            this.geo,
            new LineBasicMaterial({ vertexColors: true, depthWrite: false }),
        );
        this.thin.frustumCulled = false;
        scene.add(this.thin);

        this.ib = new InstancedInterleavedBuffer(this.pos, 6, 1).setUsage(DynamicDrawUsage);
        this.cb = new InstancedInterleavedBuffer(this.col, 6, 1).setUsage(DynamicDrawUsage);
        this.fatGeo.setAttribute("instanceStart", new InterleavedBufferAttribute(this.ib, 3, 0));
        this.fatGeo.setAttribute("instanceEnd", new InterleavedBufferAttribute(this.ib, 3, 3));
        this.fatGeo.setAttribute(
            "instanceColorStart",
            new InterleavedBufferAttribute(this.cb, 3, 0),
        );
        this.fatGeo.setAttribute("instanceColorEnd", new InterleavedBufferAttribute(this.cb, 3, 3));
        this.fat = new LineSegments2(
            this.fatGeo,
            new LineMaterial({
                vertexColors: true,
                linewidth: fatWidth,
                worldUnits: false,
                transparent: true,
                depthWrite: false,
                blending: AdditiveBlending,
            }),
        );
        this.fat.frustumCulled = false;
        scene.add(this.fat);
    }

    setFx(fx: boolean) {
        this.thin.visible = !fx;
        this.fat.visible = fx;
    }

    setResolution(w: number, h: number) {
        this.fat.material.resolution.set(w, h);
    }

    reset() {
        this.n = 0;
    }

    /**
     * The colour faint segments fade towards: black on a dark background, the background colour on
     * a light one. Intensities above 1 (flashy glow) only make sense on black, so light clamps.
     * `gain` scales intensities: thin pale lines read weaker on white than bright ones on black.
     */
    setBase(base: Color, clamp: boolean, gain = 1) {
        this.base.copy(base);
        this.clamp = clamp;
        this.gain = gain;
    }

    /** Adds a segment whose ends have colours c1 and c2 at intensities k1 and k2 (0 = base). */
    // prettier-ignore
    push(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number,
         c1: Color, k1: number, c2: Color, k2: number) {
        if (this.n >= this.cap) return;
        k1 *= this.gain; k2 *= this.gain;
        if (this.clamp) { k1 = Math.min(1, k1); k2 = Math.min(1, k2); }
        const o = this.n * 6, p = this.pos, c = this.col, b = this.base;
        p[o] = x1; p[o + 1] = y1; p[o + 2] = z1; p[o + 3] = x2; p[o + 4] = y2; p[o + 5] = z2;
        c[o] = b.r + (c1.r - b.r) * k1; c[o + 1] = b.g + (c1.g - b.g) * k1; c[o + 2] = b.b + (c1.b - b.b) * k1;
        c[o + 3] = b.r + (c2.r - b.r) * k2; c[o + 4] = b.g + (c2.g - b.g) * k2; c[o + 5] = b.b + (c2.b - b.b) * k2;
        this.n++;
    }

    flush() {
        this.geo.setDrawRange(0, this.n * 2);
        this.pa.needsUpdate = true;
        this.ca.needsUpdate = true;
        this.fatGeo.instanceCount = this.n;
        this.ib.needsUpdate = true;
        this.cb.needsUpdate = true;
    }

    dispose() {
        this.geo.dispose();
        this.fatGeo.dispose();
        (this.thin.material as LineBasicMaterial).dispose();
        this.fat.material.dispose();
    }
}
