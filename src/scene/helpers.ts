import {
    AdditiveBlending,
    CanvasTexture,
    DynamicDrawUsage,
    FrontSide,
    InstancedBufferAttribute,
    InstancedMesh,
    type Color,
    type Matrix4,
    MeshBasicMaterial,
    NormalBlending,
    Sprite,
    SpriteMaterial,
    SRGBColorSpace,
    type BufferGeometry,
    type Scene,
    type Side,
} from "three";

interface InstancedOpts {
    transparent?: boolean;
    additive?: boolean;
    fog?: boolean;
    side?: Side;
}

/**
 * Instanced meshes with per-instance colours, rewritten every frame. The batch starts at
 * `initialCap` instances and doubles whenever it fills up, so nothing is ever dropped.
 */
export class InstancedBatch {
    readonly material: MeshBasicMaterial;
    private mesh: InstancedMesh;
    private n = 0;

    constructor(
        private scene: Scene,
        private geo: BufferGeometry,
        private cap: number,
        opts: InstancedOpts = {},
    ) {
        this.material = new MeshBasicMaterial({
            color: 0xffffff,
            transparent: !!opts.transparent,
            blending: opts.additive ? AdditiveBlending : NormalBlending,
            depthWrite: !opts.transparent,
            fog: opts.fog ?? true,
            side: opts.side ?? FrontSide,
        });
        this.mesh = this.create(cap);
    }

    private create(cap: number) {
        const m = new InstancedMesh(this.geo, this.material, cap);
        m.instanceMatrix.setUsage(DynamicDrawUsage);
        m.instanceColor = new InstancedBufferAttribute(new Float32Array(cap * 3), 3);
        m.instanceColor.setUsage(DynamicDrawUsage);
        m.frustumCulled = false;
        m.count = 0;
        this.scene.add(m);
        return m;
    }

    /** Starts a new frame: forget last frame's instances. */
    reset() {
        this.n = 0;
    }

    add(matrix: Matrix4, color: Color) {
        if (this.n >= this.cap) this.grow();
        this.mesh.setMatrixAt(this.n, matrix);
        this.mesh.setColorAt(this.n, color);
        this.n++;
    }

    private grow() {
        const old = this.mesh;
        this.cap *= 2;
        this.mesh = this.create(this.cap);
        this.mesh.instanceMatrix.array.set(old.instanceMatrix.array);
        this.mesh.instanceColor!.array.set(old.instanceColor!.array);
        this.scene.remove(old);
        old.dispose(); // frees its instance buffers; the shared geometry and material stay
    }

    /** Publishes this frame's instances to the GPU. */
    flush() {
        this.mesh.count = this.n;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor!.needsUpdate = true;
    }

    dispose() {
        this.scene.remove(this.mesh);
        this.mesh.dispose();
        this.material.dispose();
    }
}

/** label canvases are drawn at 3x so text stays sharp when zoomed in */
const TEXT_SCALE = 3;

export type TextSprite = Sprite & { material: SpriteMaterial & { map: CanvasTexture } };

export function textSprite(
    text: string,
    color: string,
    px: number,
    weight: number,
    anisotropy: number,
) {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d")!;
    const font = `${weight} ${px * TEXT_SCALE}px "JetBrains Mono", Consolas, monospace`;
    ctx.font = font;
    const w = Math.ceil(ctx.measureText(text).width) + 20 * TEXT_SCALE;
    const h = Math.ceil(px * TEXT_SCALE * 1.5);
    c.width = w;
    c.height = h;
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2 + TEXT_SCALE);
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = anisotropy;
    const s = new Sprite(
        new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }),
    ) as TextSprite;
    s.userData.aspect = w / h;
    return s;
}

/** Sets a label's world height, keeping its aspect ratio. */
export function sizeSprite(s: Sprite, height: number) {
    s.scale.set(s.userData.aspect * height, height, 1);
}

export function disposeSprite(scene: Scene, s: TextSprite) {
    scene.remove(s);
    s.material.map.dispose();
    s.material.dispose();
}

/** Quadratic Bézier point, written into `out` to avoid allocations in the frame loop. */
// prettier-ignore
export function bezier(out: number[], ax: number, ay: number, az: number, cx: number, cy: number,
                       cz: number, bx: number, by: number, bz: number, u: number) {
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
    out[0] = a * ax + b * cx + c * bx;
    out[1] = a * ay + b * cy + c * by;
    out[2] = a * az + b * cz + c * bz;
}
