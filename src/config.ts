// Static configuration shared by the data layer, the 3D scene and the UI.

export const MIRROR_HOST = "https://mainnet-public.mirrornode.hedera.com";
export const MIRROR_API = `${MIRROR_HOST}/api/v1`;
export const HASHSCAN_TX = "https://hashscan.io/mainnet/transaction/";

/** Tower geometry and timing. */
export const CFG = {
    /** seconds of history kept in the tower */
    window: 120,
    /** world units per second of consensus time (vertical scale) */
    VS: 0.3,
    /** tower radius */
    R: 13,
    /** column spacing once the tower is unrolled into a flat wall */
    gap: 1.0,
    /** height of the node spheres above the consensus clock */
    NODE_Y: 1.5,
    /** seconds a transaction takes to fly into its node before it lands */
    FLY: 0.9,
    /** pause between poll cycles; with two spaced requests one cycle takes ~2.5 s */
    POLL_MS: 1300,
} as const;

/** seconds over which the oldest history fades out */
export const FADE = 15;
/** HBAR transfers worth at least this many USD get a whale alert */
export const WHALE_USD = 10_000;
/** the public mirror node rate-limits per IP: keep requests at least this far apart */
export const MIN_GAP_MS = 1200;
export const LEDGER_ROWS = 200;
export const LOG_ROWS = 40;
/** UI snapshot rate (seconds) */
export const UI_INTERVAL = 0.2;

export const BLOCK_HEX = ["#22d3ee", "#a78bfa", "#f472b6", "#4ade80", "#fb923c", "#60a5fa"];

export type KindId = "transfer" | "hcs" | "evm" | "token" | "other";
export interface Kind {
    id: KindId;
    /** short label used on badges */
    key: string;
    /** legend label */
    label: string;
    /** on dark backgrounds and as UI badge fill */
    hex: string;
    /** in the 3D scene on the light background */
    hexLight: string;
}
export const KINDS: Record<KindId, Kind> = {
    transfer: {
        id: "transfer",
        key: "TRANSFER",
        label: "Transfer",
        hex: "#5eead4",
        hexLight: "#0d9488",
    },
    hcs: { id: "hcs", key: "HCS MSG", label: "HCS message", hex: "#c4b5fd", hexLight: "#7c3aed" },
    evm: { id: "evm", key: "EVM", label: "EVM / contract", hex: "#fdba74", hexLight: "#ea580c" },
    token: { id: "token", key: "TOKEN", label: "Token", hex: "#f9a8d4", hexLight: "#db2777" },
    other: { id: "other", key: "OTHER", label: "Other", hex: "#93c5fd", hexLight: "#2563eb" },
};
export const KIND_LIST = Object.values(KINDS);

/** accounts that only receive network and node fees; skipped when summarising a transfer */
export const FEE_ACCOUNTS = new Set(["0.0.98", "0.0.800", "0.0.801", "0.0.802"]);

/** Hedera's own health-check traffic: the mirror-node monitor names itself in the memo */
export const isPingMemo = (memo: string) => /monitor/i.test(memo);

export const STORAGE_KEYS = {
    pings: "hedera-tower-pings",
    style: "hedera-tower-style",
    panels: "hedera-tower-panels",
    /** also read by the inline script in index.html */
    theme: "hedera-tower-theme",
} as const;
