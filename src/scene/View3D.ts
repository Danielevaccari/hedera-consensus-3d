import type { Hover } from "../engine/types";
import type { Theme } from "./palette";

export type ViewId = "tower" | "globe";

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
    resize(w: number, h: number): void;
    frame(dt: number): void;
    pick(x: number, y: number): Hover | null;
    dispose(): void;
}
