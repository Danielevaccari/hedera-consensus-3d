// Shared WebGL setup. One renderer draws both views (a canvas can only have one context), each
// view owning its own scene, camera, controls and post-processing chain.
import {
    HalfFloatType,
    Vector2,
    WebGLRenderer,
    WebGLRenderTarget,
    type PerspectiveCamera,
    type Scene,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { isLowPowerDevice } from "../lib/device";

export function createRenderer(canvas: HTMLCanvasElement) {
    const renderer = new WebGLRenderer({
        canvas,
        antialias: true,
        powerPreference: "high-performance",
    });
    // render at least 1.5x so thin lines and labels stay sharp on standard-DPI screens too;
    // low-power devices stay at 1.5x at most, since fill rate is what drains phones
    const dpr = window.devicePixelRatio;
    const ratio = isLowPowerDevice() ? Math.min(dpr, 1.5) : Math.min(Math.max(dpr, 1.5), 3);
    renderer.setPixelRatio(ratio);
    return renderer;
}

export interface BloomOptions {
    strength: number;
    radius: number;
    /** only parts brighter than this glow */
    threshold: number;
}

/** Bloom chain for flashy mode on dark backgrounds (glow only reads as light on dark). */
export function createComposer(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
    bloom: BloomOptions = { strength: 0.9, radius: 0.3, threshold: 0.55 },
) {
    // multisampled target, so edges stay antialiased under the glow
    const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(
        new UnrealBloomPass(new Vector2(256, 256), bloom.strength, bloom.radius, bloom.threshold),
    );
    composer.addPass(new OutputPass());
    return composer;
}
