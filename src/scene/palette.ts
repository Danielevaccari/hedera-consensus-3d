// Scene colours per theme. Faint elements fade from their colour towards `base`: black on the dark
// background (so dim = darker), the background colour on the light one (so dim = paler).
import { Color } from "three";
import { BLOCK_HEX, KIND_LIST, type Kind } from "../config";
import type { HNode } from "../engine/types";

export type Theme = "light" | "dark";

export interface Palette {
    theme: Theme;
    bg: Color;
    base: Color;
    gold: Color;
    goldHex: string;
    red: Color;
    white: Color;
    block: Color[];
    blockHex: string[];
    hostLabel: string;
    kind(k: Kind): Color;
    /** calm node colour */
    nodeHex(nd: HNode): string;
}

function make(
    theme: Theme,
    o: {
        bg: string;
        base: string;
        gold: string;
        red: string;
        blockHex: string[];
        hostLabel: string;
        kindHex: (k: Kind) => string;
        nodeHex: (nd: HNode) => string;
    },
): Palette {
    const kinds = new Map(KIND_LIST.map(k => [k, new Color(o.kindHex(k))]));
    return {
        theme,
        bg: new Color(o.bg),
        base: new Color(o.base),
        gold: new Color(o.gold),
        goldHex: o.gold,
        red: new Color(o.red),
        white: new Color("#ffffff"),
        block: o.blockHex.map(h => new Color(h)),
        blockHex: o.blockHex,
        hostLabel: o.hostLabel,
        kind: k => kinds.get(k)!,
        nodeHex: o.nodeHex,
    };
}

export const PALETTES: Record<Theme, Palette> = {
    dark: make("dark", {
        bg: "#050913",
        base: "#000000",
        gold: "#fde047",
        red: "#f87171",
        blockHex: BLOCK_HEX,
        hostLabel: "#9fb0d6",
        kindHex: k => k.hex,
        nodeHex: nd => nd.hex,
    }),
    light: make("light", {
        bg: "#f3f5f9",
        base: "#f3f5f9",
        gold: "#d97706",
        red: "#dc2626",
        blockHex: ["#0891b2", "#7c3aed", "#db2777", "#16a34a", "#ea580c", "#2563eb"],
        hostLabel: "#475569",
        kindHex: k => k.hexLight,
        nodeHex: nd => nd.hexLight,
    }),
};
