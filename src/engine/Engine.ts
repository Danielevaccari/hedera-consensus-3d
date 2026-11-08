// Owns the live model, the mirror-node feed and the 3D scene, runs the frame loop, and publishes
// what the React UI needs through two stores: a UI snapshot (~5 Hz) and the hover target.
import { STORAGE_KEYS, UI_INTERVAL } from "../config";
import { AbortedError, MirrorClient } from "../api/MirrorClient";
import { readStorage, writeStorage } from "../lib/storage";
import { Store } from "../lib/store";
import { SceneView } from "../scene/SceneView";
import { errorMessage, Feed } from "./Feed";
import { LiveState } from "./LiveState";
import { Logger } from "./Logger";
import { Market } from "./Market";
import {
    computeCharts,
    computeLedger,
    computeStats,
    computeTracker,
    type Options,
    type Phase,
    type UiSnapshot,
} from "./snapshot";
import type { Hover, Tx } from "./types";

export interface HoverState {
    target: Hover;
    /** pointer position relative to the canvas */
    x: number;
    y: number;
}

export class Engine {
    readonly market = new Market();
    readonly ui: Store<UiSnapshot>;
    readonly hover = new Store<HoverState | null>(null);

    private logger: Logger;
    private state: LiveState;
    private client = new MirrorClient();
    private feed: Feed;
    private scene: SceneView;
    private phase: Phase = "loading";
    private error: string | null = null;
    private paused = false;
    private present = false;
    private raf = 0;
    private last = 0;
    private uiTimer = 0;
    private disposed = false;
    private resizeObserver: ResizeObserver;
    private pointer: { x: number; y: number } | null = null;
    private pointerDirty = false;
    private downAt: { x: number; y: number } | null = null;
    private cleanups: (() => void)[] = [];

    constructor(
        private canvas: HTMLCanvasElement,
        viewport: HTMLElement,
    ) {
        this.logger = new Logger(() => this.state.clock());
        this.state = new LiveState(this.market, this.logger);
        this.feed = new Feed(this.client, this.state, this.market, this.logger);
        this.scene = new SceneView(canvas, this.state, this.market);

        const pings = readStorage(STORAGE_KEYS.pings);
        if (pings) this.state.hidePings = pings === "hidden";
        const style = readStorage(STORAGE_KEYS.style);
        this.scene.setFx(style ? style === "flashy" : true);

        this.ui = new Store(this.snapshot());
        this.resizeObserver = new ResizeObserver(() =>
            this.scene.resize(viewport.clientWidth, viewport.clientHeight),
        );
        this.resizeObserver.observe(viewport);
        this.bindPointer();
        this.bindFullscreen();
        void this.start();
    }

    // =================================================================
    // Lifecycle
    // =================================================================

    /** Connects to the mirror node; on failure the UI shows an error with a retry button. */
    async start() {
        this.phase = "loading";
        this.error = null;
        this.publish();
        try {
            await (document.fonts ? document.fonts.ready : Promise.resolve());
            await this.feed.boot();
        } catch (err) {
            if (err instanceof AbortedError || this.disposed) return;
            this.phase = "error";
            this.error = errorMessage(err);
            this.publish();
            return;
        }
        if (this.disposed) return;
        this.state.booted = true;
        this.scene.buildNodes();
        this.phase = "live";
        this.publish();
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.frame);
        this.feed.start();
    }

    dispose() {
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        this.feed.stop();
        this.client.abort();
        this.resizeObserver.disconnect();
        for (const c of this.cleanups) c();
        this.scene.dispose();
    }

    private frame = (now: number) => {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        const state = this.state;
        state.realT += dt;
        if (!this.paused) state.advance(dt);
        this.scene.frame(dt);
        this.updateHover();
        this.uiTimer += dt;
        if (this.uiTimer > UI_INTERVAL) {
            this.uiTimer = 0;
            if (!this.paused) state.autoAdvanceTracking();
            this.scene.removeBlockLabels(state.prune());
            this.publish();
        }
        this.raf = requestAnimationFrame(this.frame);
    };

    // =================================================================
    // UI snapshot
    // =================================================================

    get options(): Options {
        return {
            paused: this.paused,
            fx: this.scene.fx,
            hidePings: this.state.hidePings,
            unrolled: this.scene.unrolled,
            autoRotate: this.scene.autoRotate,
            present: this.present,
        };
    }

    private snapshot(): UiSnapshot {
        const s = this.state;
        const live = this.phase === "live";
        return {
            phase: this.phase,
            error: this.error,
            online: this.feed.online,
            options: this.options,
            stats: live ? computeStats(s) : null,
            ledger: live ? computeLedger(s) : [],
            log: this.logger.entries,
            tracker: live ? computeTracker(s) : null,
            // the charts strip is hidden while presenting
            charts: live && !this.present ? computeCharts(s) : null,
        };
    }

    private publish() {
        this.ui.set(this.snapshot());
    }

    // =================================================================
    // Actions
    // =================================================================

    togglePause() {
        this.paused = !this.paused;
        this.publish();
    }

    toggleFx() {
        this.scene.setFx(!this.scene.fx);
        writeStorage(STORAGE_KEYS.style, this.scene.fx ? "flashy" : "calm");
        this.publish();
    }

    toggleUnroll() {
        this.scene.unrolled = !this.scene.unrolled;
        this.publish();
    }

    toggleAutoRotate() {
        this.scene.autoRotate = !this.scene.autoRotate;
        this.publish();
    }

    togglePings() {
        const s = this.state;
        s.hidePings = !s.hidePings;
        writeStorage(STORAGE_KEYS.pings, s.hidePings ? "hidden" : "shown");
        if (s.tracked && !s.shown(s.tracked)) s.tracked = null;
        this.logger.log(
            "conn",
            s.hidePings
                ? "Network health-check pings **hidden**: showing real user activity only."
                : "Network health-check pings **shown**.",
        );
        this.publish();
    }

    /** Follow the next transaction that has not reached the consensus clock yet. */
    trackNext() {
        const s = this.state;
        s.autoTrack = true;
        // nothing queued yet: take the next one that arrives
        if (!s.pickNext() && s.tracked) s.trackedDoneAt = -1e9;
        this.publish();
    }

    track(tx: Tx) {
        this.state.setTracked(tx, true);
        this.publish();
    }

    /** Presentation mode: hide every panel and go full screen, leaving only the 3D view. */
    setPresent(on: boolean) {
        if (on === this.present) return;
        this.present = on;
        this.hover.set(null);
        const doc = document.documentElement;
        if (on && doc.requestFullscreen && !document.fullscreenElement)
            doc.requestFullscreen().catch(() => {});
        if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
        this.publish();
    }

    // =================================================================
    // Pointer: hover tooltip and click-to-track
    // =================================================================

    private listen<K extends keyof HTMLElementEventMap>(
        target: HTMLElement,
        type: K,
        fn: (ev: HTMLElementEventMap[K]) => void,
    ) {
        target.addEventListener(type, fn);
        this.cleanups.push(() => target.removeEventListener(type, fn));
    }

    private bindPointer() {
        const c = this.canvas;
        this.listen(c, "pointermove", ev => {
            const r = c.getBoundingClientRect();
            this.pointer = { x: ev.clientX - r.left, y: ev.clientY - r.top };
            this.pointerDirty = true;
        });
        this.listen(c, "pointerleave", () => {
            this.pointer = null;
            this.hover.set(null);
            c.style.cursor = "";
        });
        this.listen(c, "pointerdown", ev => {
            this.downAt = { x: ev.clientX, y: ev.clientY };
        });
        this.listen(c, "pointerup", ev => {
            if (!this.downAt) return;
            const moved = Math.hypot(ev.clientX - this.downAt.x, ev.clientY - this.downAt.y);
            this.downAt = null;
            const h = this.hover.get();
            if (moved <= 5 && h?.target.type === "tx") this.track(h.target.tx);
        });
    }

    private bindFullscreen() {
        const onChange = () => {
            if (!document.fullscreenElement) this.setPresent(false);
        };
        document.addEventListener("fullscreenchange", onChange);
        this.cleanups.push(() => document.removeEventListener("fullscreenchange", onChange));
    }

    /** Re-picks when the pointer moved, or every frame while something is hovered (it moves). */
    private updateHover() {
        if (!this.pointerDirty && !this.hover.get()) return;
        this.pointerDirty = false;
        const p = this.pointer;
        const target = p && !this.present ? this.scene.pick(p.x, p.y) : null;
        this.canvas.style.cursor = target ? "pointer" : "";
        const prev = this.hover.get();
        if (!target || !p) {
            if (prev) this.hover.set(null);
            return;
        }
        const same =
            prev &&
            prev.x === p.x &&
            prev.y === p.y &&
            (prev.target.type === "node"
                ? target.type === "node" && target.node === prev.target.node
                : target.type === "tx" && target.tx === prev.target.tx);
        if (!same) this.hover.set({ target, x: p.x, y: p.y });
    }
}
