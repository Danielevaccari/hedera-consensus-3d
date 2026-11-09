// The view-switch transition. The outgoing view's last frame is copied to a canvas and fades away
// while particles fly from where things were to where they now are: nodes from the ring to their
// cities (or back), and recent transactions between their tower positions and their node's city.
//
import type { MorphPoint, MorphSample } from "./View3D";

// It is a screen-space overlay rather than a shared 3D scene because the two views use different
// cameras; the incoming view is simply drawn underneath as usual.

export interface MorphParticle {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    color: string;
    /** radius in CSS pixels */
    size: number;
    /** seconds before it sets off, and how long the flight takes */
    delay: number;
    dur: number;
    /** sideways bow of the flight path, as a fraction of the distance */
    bend: number;
    /** starts / ends on the far side of the globe: fade in or out instead of popping */
    fadeIn: boolean;
    fadeOut: boolean;
}

const FADE_MS = 900;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The particles for a switch from one view to the other: every node flies to its new place, and
 * recent transactions fly between their own position and their node's (whichever view has them).
 */
export function buildMorphParticles(from: MorphSample, to: MorphSample): MorphParticle[] {
    const out: MorphParticle[] = [];
    const make = (
        a: MorphPoint,
        b: MorphPoint,
        color: string,
        size: number,
        delay: number,
        dur: number,
    ): MorphParticle => ({
        x0: a.x,
        y0: a.y,
        x1: b.x,
        y1: b.y,
        color,
        size,
        delay,
        dur,
        bend: (Math.random() - 0.5) * 0.5,
        fadeIn: a.hidden,
        fadeOut: b.hidden,
    });
    for (const [nd, a] of from.nodes) {
        const b = to.nodes.get(nd);
        if (b) out.push(make(a, b, a.color, 3.4, 0, 1.0));
    }
    for (const t of from.txs) {
        const b = t.tx.node && to.nodes.get(t.tx.node);
        if (b) out.push(make(t, b, t.color, 2, Math.random() * 0.4, 0.8));
    }
    for (const t of to.txs) {
        const a = t.tx.node && from.nodes.get(t.tx.node);
        if (a) out.push(make(a, t, t.color, 2, Math.random() * 0.4, 0.8));
    }
    return out;
}

export class MorphOverlay {
    private snap = this.makeCanvas(2);
    private fly = this.makeCanvas(3);
    private snapCtx = this.snap.getContext("2d")!;
    private flyCtx = this.fly.getContext("2d")!;
    private w = 0;
    private h = 0;
    private dpr = 1;
    private particles: MorphParticle[] = [];
    private glow = false;
    private t0 = 0;
    private total = 0;
    private running = false;

    constructor(viewport: HTMLElement) {
        viewport.append(this.snap, this.fly);
    }

    private makeCanvas(z: number) {
        const c = document.createElement("canvas");
        c.setAttribute("aria-hidden", "true");
        Object.assign(c.style, {
            position: "absolute",
            inset: "0",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            display: "none",
            zIndex: String(z),
        });
        return c;
    }

    get active() {
        return this.running;
    }

    resize(w: number, h: number) {
        this.w = w;
        this.h = h;
        this.dpr = Math.min(2, window.devicePixelRatio || 1);
        for (const c of [this.snap, this.fly]) {
            c.width = Math.round(w * this.dpr);
            c.height = Math.round(h * this.dpr);
        }
    }

    /**
     * Copies the 3D canvas as it is right now. Call it straight after rendering, in the same task,
     * or the browser will already have cleared the drawing buffer.
     */
    capture(source: HTMLCanvasElement) {
        this.cancel();
        const ctx = this.snapCtx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.w, this.h);
        ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, this.w, this.h);
        this.snap.style.transition = "none";
        this.snap.style.opacity = "1";
        this.snap.style.display = "block";
    }

    /** Starts the flight; the captured frame fades out underneath it. */
    run(particles: MorphParticle[], glow: boolean) {
        this.particles = particles;
        this.glow = glow;
        this.total = particles.reduce((m, p) => Math.max(m, p.delay + p.dur), FADE_MS / 1000);
        this.t0 = performance.now();
        this.running = true;
        this.fly.style.display = "block";
        // fade on the next frame, so the browser has painted the opaque copy first
        requestAnimationFrame(() => {
            if (!this.running) return;
            this.snap.style.transition = `opacity ${FADE_MS}ms ease-out`;
            this.snap.style.opacity = "0";
        });
    }

    /** Draws one frame of the flight; call every animation frame. */
    tick(now: number) {
        if (!this.running) return;
        const elapsed = (now - this.t0) / 1000;
        if (elapsed > this.total) {
            this.cancel();
            return;
        }
        const ctx = this.flyCtx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.clearRect(0, 0, this.w, this.h);
        // light on dark adds up; on a light background plain blending reads better
        ctx.globalCompositeOperation = this.glow ? "lighter" : "source-over";
        for (const p of this.particles) {
            const u = Math.min(1, Math.max(0, (elapsed - p.delay) / p.dur));
            // not started yet (it is still part of the fading copy), or already arrived (the real
            // dot is under it now)
            if (u <= 0 || u >= 1) continue;
            this.drawParticle(ctx, p, u);
        }
    }

    private drawParticle(ctx: CanvasRenderingContext2D, p: MorphParticle, u: number) {
        const dx = p.x1 - p.x0;
        const dy = p.y1 - p.y0;
        // control point: the midpoint pushed sideways, so flights bow instead of running straight
        const cx = p.x0 + dx / 2 - dy * p.bend;
        const cy = p.y0 + dy / 2 + dx * p.bend;
        const at = (e: number) => {
            const a = (1 - e) * (1 - e);
            const b = 2 * (1 - e) * e;
            const c = e * e;
            return [a * p.x0 + b * cx + c * p.x1, a * p.y0 + b * cy + c * p.y1] as const;
        };
        const e = easeInOut(u);
        let alpha = Math.min(1, u * 8, (1 - u) * 8); // quick fade at both ends
        if (p.fadeIn) alpha *= e;
        if (p.fadeOut) alpha *= 1 - e;
        if (alpha <= 0.01) return;
        ctx.fillStyle = p.color;
        // a short tail: the same path a few steps behind
        for (let k = 3; k >= 0; k--) {
            const [x, y] = at(Math.max(0, e - k * 0.05));
            ctx.globalAlpha = alpha * (k === 0 ? 1 : 0.38 * (1 - k / 4));
            ctx.beginPath();
            ctx.arc(x, y, p.size * (k === 0 ? 1 : 1 - k * 0.2), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    cancel() {
        this.running = false;
        this.particles = [];
        this.snap.style.display = "none";
        this.fly.style.display = "none";
        this.flyCtx.clearRect(0, 0, this.fly.width, this.fly.height);
    }

    dispose() {
        this.cancel();
        this.snap.remove();
        this.fly.remove();
    }
}
