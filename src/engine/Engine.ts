// Owns the live model, the mirror-node feed and the 3D views, runs the frame loop, and publishes
// what the React UI needs through three stores: a UI snapshot (~5 Hz), the hover target, and a
// "focus" counter that ticks when the visitor picks a transaction to follow.
import { STORAGE_KEYS, UI_INTERVAL } from "../config";
import { AbortedError, MirrorClient } from "../api/MirrorClient";
import { readStorage, writeStorage } from "../lib/storage";
import { Store } from "../lib/store";
import { GlobeView } from "../scene/globe/GlobeView";
import type { Theme } from "../scene/palette";
import { createRenderer } from "../scene/renderer";
import { TowerView } from "../scene/TowerView";
import type { View3D, ViewId } from "../scene/View3D";
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

const initialView = (): ViewId => {
    const fromUrl = new URLSearchParams(location.search).get("view");
    const saved = fromUrl ?? readStorage(STORAGE_KEYS.view);
    return saved === "globe" ? "globe" : "tower";
};

export class Engine {
    readonly market = new Market();
    readonly ui: Store<UiSnapshot>;
    readonly hover = new Store<HoverState | null>(null);
    /** increments whenever the visitor picks a transaction to follow (UI can reveal the journey) */
    readonly focus = new Store<number>(0);

    private logger: Logger;
    private state: LiveState;
    private client = new MirrorClient();
    private feed: Feed;
    private renderer;
    private tower: TowerView;
    private globe: GlobeView;
    private view: ViewId;
    private phase: Phase = "loading";
    private error: string | null = null;
    private paused = false;
    private present = false;
    private charts: boolean;
    private raf = 0;
    private last = 0;
    private uiTimer = 0;
    private disposed = false;
    private resizeObserver: ResizeObserver;
    private intersectionObserver: IntersectionObserver;
    private onScreen = true;
    private theme: Theme;
    /** the visitor's flashy/calm choice; effects adapt to the theme */
    private fxPref: boolean;
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
        this.renderer = createRenderer(canvas);
        this.tower = new TowerView(this.renderer, canvas, this.state, this.market);
        this.globe = new GlobeView(this.renderer, canvas, this.state);

        const pings = readStorage(STORAGE_KEYS.pings);
        if (pings) this.state.hidePings = pings === "hidden";
        this.fxPref = readStorage(STORAGE_KEYS.style) !== "calm"; // flashy unless the visitor chose calm
        this.charts = readStorage(STORAGE_KEYS.charts) === "on";
        // the inline script in index.html has already applied the saved theme to <html>
        this.theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        this.view = initialView();
        for (const v of [this.tower, this.globe]) {
            v.setTheme(this.theme);
            v.setFx(this.fxPref);
        }
        this.activate();

        this.ui = new Store(this.snapshot());
        this.resizeObserver = new ResizeObserver(() => this.resize(viewport));
        this.resizeObserver.observe(viewport);
        // stop drawing while the 3D view is scrolled out of sight (the data keeps updating)
        this.intersectionObserver = new IntersectionObserver(([entry]) => {
            this.onScreen = entry.isIntersecting;
        });
        this.intersectionObserver.observe(viewport);
        this.bindPointer();
        this.bindFullscreen();
        void this.start();
    }

    private get active(): View3D {
        return this.view === "globe" ? this.globe : this.tower;
    }

    private resize(viewport: HTMLElement) {
        const w = viewport.clientWidth;
        const h = viewport.clientHeight;
        // a zero-size framebuffer is invalid; happens briefly while the layout switches
        if (!w || !h) return;
        this.renderer.setSize(w, h, false);
        this.tower.resize(w, h);
        this.globe.resize(w, h);
    }

    /** Only the shown view reacts to the pointer. */
    private activate() {
        this.tower.setActive(this.view === "tower");
        this.globe.setActive(this.view === "globe");
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
        this.tower.buildNodes();
        this.globe.buildNodes();
        if (this.globe.unmapped.length)
            this.logger.log(
                "warn",
                `**Location not mapped** for ${this.globe.unmapped.map(n => `${n.acct} (${n.loc || "no location"})`).join(", ")}: shown in the panels but not on the globe.`,
            );
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
        this.intersectionObserver.disconnect();
        for (const c of this.cleanups) c();
        this.tower.dispose();
        this.globe.dispose();
        this.renderer.dispose();
    }

    private frame = (now: number) => {
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        const state = this.state;
        state.realT += dt;
        if (!this.paused) state.advance(dt);
        if (this.onScreen) {
            this.active.frame(dt);
            this.updateHover();
        }
        this.uiTimer += dt;
        if (this.uiTimer > UI_INTERVAL) {
            this.uiTimer = 0;
            if (!this.paused) state.autoAdvanceTracking();
            this.tower.removeBlockLabels(state.prune());
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
            fx: this.fxPref,
            theme: this.theme,
            view: this.view,
            hidePings: this.state.hidePings,
            unrolled: this.tower.unrolled,
            autoRotate: this.active.autoRotate,
            charts: this.charts,
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
            // the charts strip is optional and hidden while presenting
            charts: live && this.charts && !this.present ? computeCharts(s) : null,
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

    setView(view: ViewId) {
        if (view === this.view) return;
        this.view = view;
        writeStorage(STORAGE_KEYS.view, view);
        const url = new URL(location.href);
        url.searchParams.set("view", view);
        history.replaceState(null, "", url);
        this.hover.set(null);
        this.activate();
        this.publish();
    }

    toggleFx() {
        this.fxPref = !this.fxPref;
        writeStorage(STORAGE_KEYS.style, this.fxPref ? "flashy" : "calm");
        this.tower.setFx(this.fxPref);
        this.globe.setFx(this.fxPref);
        this.publish();
    }

    toggleTheme() {
        this.theme = this.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = this.theme;
        writeStorage(STORAGE_KEYS.theme, this.theme);
        this.tower.setTheme(this.theme);
        this.globe.setTheme(this.theme);
        this.publish();
    }

    toggleCharts() {
        this.charts = !this.charts;
        writeStorage(STORAGE_KEYS.charts, this.charts ? "on" : "off");
        this.publish();
    }

    toggleUnroll() {
        this.tower.unrolled = !this.tower.unrolled;
        this.publish();
    }

    toggleAutoRotate() {
        this.active.autoRotate = !this.active.autoRotate;
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
        this.focus.set(this.focus.get() + 1);
        this.publish();
    }

    /** The visitor picked this transaction (canvas click or ledger row). */
    track(tx: Tx) {
        this.state.setTracked(tx, true);
        this.focus.set(this.focus.get() + 1);
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
        const target = p && !this.present ? this.active.pick(p.x, p.y) : null;
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
