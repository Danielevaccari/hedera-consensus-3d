import type { Hover, HNode, Tx } from "../engine/types";
import type { Theme } from "./palette";

export type ViewId = "tower" | "globe";

/** A point in the view, in CSS pixels from the canvas's top-left corner. */
export interface MorphPoint {
    x: number;
    y: number;
    /** CSS colour of the thing at this point */
    color: string;
    /** on the far side of the globe (or behind the camera): fade it rather than fly it */
    hidden: boolean;
}

/** Where things are on screen right now, so the view switch can fly them to their new places. */
export interface MorphSample {
    nodes: Map<HNode, MorphPoint>;
    /** transactions that have a position of their own in this view (the tower has them, the globe doesn't) */
    txs: (MorphPoint & { tx: Tx })[];
}

/** What the engine needs from a 3D view. The two views share one renderer and one data model. */
export interface View3D {
    readonly fx: boolean;
    autoRotate: boolean;
    /** switches the colour palette */
    setTheme(theme: Theme): void;
    /** flashy effects on/off (they adapt to the theme) */
    setFx(fx: boolean): void;
    /** (Re)creates per-node visuals; call once the nodes are known */
    buildNodes(): void;
    /** only the active view reacts to the pointer */
    setActive(on: boolean): void;
    /** a small image shift from the phone's tilt, x and y in -1..1 (0, 0 clears it) */
    setParallax(x: number, y: number): void;
    resize(w: number, h: number): void;
    frame(dt: number): void;
    pick(x: number, y: number): Hover | null;
    /** screen positions as of the last frame; used to animate a switch between views */
    sample(limit: number): MorphSample;
    dispose(): void;
}
