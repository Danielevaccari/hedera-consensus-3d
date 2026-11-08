// The read-only view of the engine that React renders, rebuilt a few times per second.
import { CFG, KIND_LIST, LEDGER_ROWS, type Kind } from "../config";
import type { Theme } from "../scene/palette";
import type { LiveState } from "./LiveState";
import type { Block, HNode, LogEntry, Tx } from "./types";

export type Phase = "loading" | "error" | "live";

export interface Options {
    paused: boolean;
    /** flashy effects actually showing (needs the dark theme) */
    fx: boolean;
    theme: Theme;
    hidePings: boolean;
    unrolled: boolean;
    autoRotate: boolean;
    present: boolean;
}

export interface Stats {
    nodes: number;
    totalStake: number;
    minSMNodes: number;
    /** share of transactions in the window that are health-check pings */
    pingShare: number | null;
    /** shown transactions per second over the last 30 s */
    tps: number;
    latestBlock: number | null;
    lag: number;
    clock: string;
}

export interface TrackerView {
    tx: Tx;
    landed: boolean;
    arriving: boolean;
    block: Block | null;
    /** seconds from valid start to consensus */
    sinceValid: number;
}

export interface ChartData {
    /** tx/s per 5 s bin, oldest first (the still-filling newest bin is left out) */
    rate: number[];
    avgRate: number;
    total: number;
    mix: { kind: Kind; count: number }[];
    perNode: { node: HNode; count: number }[];
}

export interface UiSnapshot {
    phase: Phase;
    error: string | null;
    online: boolean;
    options: Options;
    stats: Stats | null;
    ledger: Tx[];
    log: LogEntry[];
    tracker: TrackerView | null;
    charts: ChartData | null;
}

export function computeStats(s: LiveState): Stats {
    let recent = 0;
    let all = 0;
    let pings = 0;
    for (let k = s.txs.length - 1; k >= 0; k--) {
        const t = s.txs[k];
        if (!t.landed) continue;
        const age = s.displayRel - t.ct;
        if (age > CFG.window) break;
        all++;
        if (t.ping) pings++;
        if (age < 30 && s.shown(t)) recent++;
    }
    return {
        nodes: s.nodes.length,
        totalStake: s.totalStake,
        minSMNodes: s.minSMNodes,
        pingShare: all ? pings / all : null,
        tps: recent / 30,
        latestBlock: s.latestShownBlock?.num ?? null,
        lag: s.lag,
        clock: s.clock(),
    };
}

/** The newest landed, shown transactions, newest first. */
export function computeLedger(s: LiveState): Tx[] {
    const rows: Tx[] = [];
    for (let k = s.txs.length - 1; k >= 0 && rows.length < LEDGER_ROWS; k--) {
        const tx = s.txs[k];
        if (tx.landed && s.shown(tx)) rows.push(tx);
    }
    return rows;
}

export function computeTracker(s: LiveState): TrackerView | null {
    const tx = s.tracked;
    if (!tx) return null;
    return {
        tx,
        landed: tx.landed,
        arriving: !tx.landed && s.displayRel >= tx.ct - CFG.FLY,
        block: tx.block,
        sinceValid: tx.ct - s.relTs(tx.vs),
    };
}

export function computeCharts(s: LiveState): ChartData {
    const BIN = 5;
    const nb = Math.ceil(CFG.window / BIN);
    const bins = new Array<number>(nb).fill(0);
    const kinds = new Map<Kind, number>();
    const perNode = new Map<HNode, number>();
    let total = 0;
    for (let k = s.txs.length - 1; k >= 0; k--) {
        const tx = s.txs[k];
        if (!tx.landed) continue;
        const age = s.displayRel - tx.ct;
        if (age > CFG.window) break;
        if (!s.shown(tx)) continue;
        bins[Math.min(nb - 1, Math.floor(age / BIN))]++;
        total++;
        kinds.set(tx.kind, (kinds.get(tx.kind) ?? 0) + 1);
        if (tx.node) perNode.set(tx.node, (perNode.get(tx.node) ?? 0) + 1);
    }
    return {
        rate: bins
            .slice(1)
            .reverse()
            .map(v => v / BIN),
        avgRate: total / CFG.window,
        total,
        mix: KIND_LIST.map(kind => ({ kind, count: kinds.get(kind) ?? 0 })),
        perNode: s.nodes.map(node => ({ node, count: perNode.get(node) ?? 0 })),
    };
}
