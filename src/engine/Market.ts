// Prices and token metadata, filled in lazily from the mirror node, and the human-readable
// transaction summaries that depend on them.
import { KINDS, WHALE_USD } from "../config";
import { fmtHbar, fmtUsd } from "../lib/format";
import type { Tx } from "./types";

interface TokenInfo {
    symbol: string;
    decimals: number;
}

export class Market {
    hbarUsd: number | null = null;
    rateFetchedAt = -Infinity;
    /** token id -> info | null (pending) | false (lookup failed) */
    private tokens = new Map<string, TokenInfo | null | false>();
    private queue: string[] = [];

    setRate(centEquivalent: number, hbarEquivalent: number) {
        if (hbarEquivalent) this.hbarUsd = centEquivalent / hbarEquivalent / 100;
    }

    queueToken(id: string | undefined) {
        if (id && !this.tokens.has(id)) {
            this.tokens.set(id, null);
            this.queue.push(id);
        }
    }
    hasQueuedTokens() {
        return this.queue.length > 0;
    }
    nextQueuedToken() {
        return this.queue.shift();
    }
    setToken(id: string, info: TokenInfo | false) {
        this.tokens.set(id, info);
    }

    tokName(id: string) {
        const ti = this.tokens.get(id);
        return ti ? ti.symbol : `token ${id}`;
    }

    fmtTok(tok: { id: string; amt: number }) {
        const ti = this.tokens.get(tok.id);
        if (!ti) return `token ${tok.id}`;
        const v = tok.amt / 10 ** ti.decimals;
        const digits = Math.min(4, ti.decimals);
        return `${v.toLocaleString("en-US", { maximumFractionDigits: digits })} ${ti.symbol}`;
    }

    usdOf(tx: Tx) {
        return tx.amt.hbar && this.hbarUsd ? tx.amt.hbar * this.hbarUsd : 0;
    }

    isWhale(tx: Tx) {
        return this.usdOf(tx) >= WHALE_USD;
    }

    /** One-line summary of what a transaction did. */
    txText(tx: Tx) {
        const a = tx.amt;
        if (tx.name === "CRYPTOTRANSFER") {
            if (a.tok) return `${this.fmtTok(a.tok)} → ${a.tok.to}`;
            if (a.nft) return `NFT ${this.tokName(a.nft.id)} #${a.nft.serial} → ${a.nft.to}`;
            if (a.hbar) {
                const u = this.usdOf(tx);
                const usd = u >= 0.01 ? ` (${fmtUsd(u)})` : "";
                return `${fmtHbar(a.hbar)}${usd} ${a.hbarFrom || tx.payer} → ${a.hbarTo}`;
            }
            return `transfer by ${tx.payer}`;
        }
        if (tx.kind === KINDS.hcs && tx.entity) return `message → topic ${tx.entity}`;
        if (tx.kind === KINDS.evm)
            return tx.entity
                ? `EVM call · contract ${tx.entity}`
                : `EVM transaction by ${tx.payer}`;
        return `${tx.name.toLowerCase()}${tx.entity ? " · " + tx.entity : ""} by ${tx.payer}`;
    }
}
