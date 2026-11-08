import type { Kind } from "../config";

/** A Hedera consensus node, as placed on the tower ring. */
export interface HNode {
    /** position on the ring */
    i: number;
    id: number;
    acct: string;
    host: string;
    loc: string;
    /** stake in HBAR */
    stake: number;
    /** sphere scale, follows stake */
    size: number;
    /** realT of the last landing, drives the pulse */
    pulse: number;
    /** transactions currently in view, recomputed by the scene each frame */
    count: number;
    /** calm and flashy colours */
    hex: string;
    hexFx: string;
}

/** The largest HBAR, token and NFT movement in a transaction, kept raw for later formatting. */
export interface Amounts {
    hbar: number;
    hbarTo: string | null;
    hbarFrom: string | null;
    tok: { id: string; amt: number; to: string } | null;
    nft: { id: string; serial: number; to: string } | null;
}

export interface Block {
    num: number;
    count: number;
    name: string;
    fromTs: string;
    toTs: string;
    /** seconds relative to T0 */
    from: number;
    to: number;
    /** realT when the consensus clock passed the block's end */
    sealedAt: number | null;
}

export interface Tx {
    key: string;
    /** consensus timestamp string */
    ts: string;
    /** consensus time, seconds relative to T0 */
    ct: number;
    /** valid start timestamp string */
    vs: string;
    id: string;
    name: string;
    kind: Kind;
    payer: string;
    node: HNode | null;
    nodeAcct: string;
    entity: string | null;
    result: string;
    fee: number;
    memo: string;
    amt: Amounts;
    ping: boolean;
    landed: boolean;
    /** realT when it landed (-99 = was already in the past at load time) */
    landedReal: number;
    block: Block | null;
    whaleAt?: number;
    /** per-transaction random offsets for the fly-in path */
    jit: number;
    jy: number;
    /** scene scratch: last drawn position and the frame it was drawn in */
    px: number;
    py: number;
    pz: number;
    frame: number;
}

export type LogKind = "conn" | "block" | "track" | "warn" | "whalelog";

export interface LogEntry {
    id: number;
    kind: LogKind;
    time: string;
    /** text with **bold** segments */
    text: string;
}

export type Hover = { type: "node"; node: HNode } | { type: "tx"; tx: Tx };
