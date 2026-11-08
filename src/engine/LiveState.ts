// The live model of the network: nodes, the transactions and blocks in the tower's window, the
// replayed consensus clock and the tracked transaction. No rendering and no network access here.
import { CFG, isPingMemo } from "../config";
import type { MirrorBlock, MirrorNode, MirrorTransaction } from "../api/types";
import { clockOf, fmtHbar, fmtInt, fmtTs, fmtUsd, nodeHue, splitTs } from "../lib/format";
import type { Logger } from "./Logger";
import type { Market } from "./Market";
import { decodeMemo, kindOf, parseAmounts } from "./transactions";
import type { Block, HNode, Tx } from "./types";

export class LiveState {
    // ---- network ----
    nodes: HNode[] = [];
    nodeByAcct = new Map<string, HNode>();
    totalStake = 0;
    /** smallest number of nodes whose combined stake is a supermajority (> 2/3) */
    minSMNodes = 0;

    // ---- data in the window ----
    txs: Tx[] = [];
    txByKey = new Map<string, Tx>();
    blocks: Block[] = [];
    blockByNum = new Map<number, Block>();
    lastTxTs: string | null = null;
    lastTxRel = -Infinity;
    lastBlockNum = 0;
    horizonRel = -Infinity;
    latestShownBlock: Block | null = null;

    // ---- clocks ----
    /** epoch second that relative times are measured from (keeps float precision at ns) */
    T0 = 0;
    /** monotonic animation time in seconds */
    realT = 0;
    /** the replayed consensus clock, seconds relative to T0 */
    displayRel = 0;
    /** how far the view runs behind real time, and where that is heading */
    lag = 6;
    lagTarget = 6;
    mirrorLag = 0;
    private lastBlockFetch: number | null = null;
    private cycleEma = 2.5;

    // ---- tracking & filters ----
    tracked: Tx | null = null;
    trackedDoneAt: number | null = null;
    autoTrack = true;
    hidePings = true;
    booted = false;

    constructor(
        private market: Market,
        private logger: Logger,
    ) {}

    // ---------- time ----------
    relTs(s: string) {
        const [a, ns] = splitTs(s);
        return a - this.T0 + +ns / 1e9;
    }
    wallRel() {
        return (performance.timeOrigin + performance.now()) / 1000 - this.T0;
    }
    clock() {
        return this.T0 ? clockOf(Math.floor(this.T0 + this.displayRel)) : "--:--:--";
    }

    shown = (tx: Tx) => !(this.hidePings && tx.ping);

    // ---------- ingest ----------
    setupNodes(raw: MirrorNode[]) {
        const n = raw.length;
        this.nodes = raw.map((r, i) => {
            const desc = (r.description || "").replace(/^Hosted by\s*/i, "");
            const [host, loc] = desc.split("|").map(s => s.trim());
            const hue = nodeHue(i, n);
            return {
                i,
                id: r.node_id,
                acct: r.node_account_id,
                host: host || r.node_account_id,
                loc: loc || "",
                stake: Number(r.stake || 0) / 1e8,
                size: 1,
                pulse: -10,
                count: 0,
                hex: `hsl(${hue},55%,64%)`,
                hexFx: `hsl(${hue},92%,62%)`,
            };
        });
        // stake unknown: equal weights
        if (this.nodes.every(nd => nd.stake === 0)) this.nodes.forEach(nd => (nd.stake = 1));
        this.nodeByAcct = new Map(this.nodes.map(nd => [nd.acct, nd]));
        this.totalStake = this.nodes.reduce((s, nd) => s + nd.stake, 0);
        const maxStake = Math.max(...this.nodes.map(nd => nd.stake));
        this.nodes.forEach(nd => (nd.size = 0.55 + 0.65 * (nd.stake / maxStake)));

        const sorted = this.nodes.map(nd => nd.stake).sort((a, b) => b - a);
        let acc = 0;
        this.minSMNodes = 0;
        for (const s of sorted) {
            acc += s;
            this.minSMNodes++;
            if (acc > (2 * this.totalStake) / 3) break;
        }
    }

    addTx(t: MirrorTransaction): Tx | undefined {
        if (this.txByKey.has(t.consensus_timestamp)) return;
        const memo = decodeMemo(t.memo_base64);
        const tx: Tx = {
            key: t.consensus_timestamp,
            ts: t.consensus_timestamp,
            ct: this.relTs(t.consensus_timestamp),
            vs: t.valid_start_timestamp,
            id: t.transaction_id,
            name: t.name,
            kind: kindOf(t.name),
            payer: t.transaction_id.split("-")[0],
            node: this.nodeByAcct.get(t.node) ?? null,
            nodeAcct: t.node,
            entity: t.entity_id,
            result: t.result,
            fee: (t.charged_tx_fee || 0) / 1e8,
            memo,
            amt: parseAmounts(t),
            ping: isPingMemo(memo),
            landed: false,
            landedReal: 0,
            block: null,
            jit: (Math.random() - 0.5) * 1.2,
            jy: 6 + Math.random() * 6,
            px: 0,
            py: 0,
            pz: 0,
            frame: -1,
        };
        if (tx.amt.tok) this.market.queueToken(tx.amt.tok.id);
        if (tx.amt.nft) this.market.queueToken(tx.amt.nft.id);
        this.txByKey.set(tx.key, tx);
        const txs = this.txs;
        const outOfOrder = txs.length > 0 && tx.ct < txs[txs.length - 1].ct;
        txs.push(tx);
        if (outOfOrder) txs.sort((a, b) => a.ct - b.ct);
        if (tx.ct > this.lastTxRel) {
            this.lastTxRel = tx.ct;
            this.lastTxTs = tx.ts;
        }
        return tx;
    }

    addBlock(b: MirrorBlock) {
        if (this.blockByNum.has(b.number)) return;
        const toTs = b.timestamp.to || b.timestamp.from;
        const blk: Block = {
            num: b.number,
            count: b.count,
            name: b.name,
            fromTs: b.timestamp.from,
            toTs,
            from: this.relTs(b.timestamp.from),
            to: this.relTs(toTs),
            sealedAt: null,
        };
        this.blockByNum.set(blk.num, blk);
        this.blocks.push(blk);
        this.blocks.sort((a, c) => a.num - c.num);
        if (blk.num > this.lastBlockNum) this.lastBlockNum = blk.num;
        if (blk.to > this.horizonRel) this.horizonRel = blk.to;
    }

    assignBlocks() {
        const find = (tx: Tx) => this.blocks.find(b => tx.ct >= b.from && tx.ct <= b.to) ?? null;
        for (let k = this.txs.length - 1; k >= 0; k--) {
            const tx = this.txs[k];
            if (!tx.block) tx.block = find(tx);
        }
        if (this.tracked && !this.tracked.block) this.tracked.block = find(this.tracked);
    }

    /**
     * The view runs behind real time by the mirror node's publishing delay plus one poll cycle, so
     * new data is always in hand before the consensus clock reaches it. The delay is measured when
     * the block list arrives, so queued requests (e.g. the history backfill) don't inflate it.
     */
    measureLag(seenAt: number) {
        this.mirrorLag = Math.max(0, seenAt - Math.max(this.horizonRel, this.lastTxRel));
        if (this.lastBlockFetch !== null)
            this.cycleEma = this.cycleEma * 0.7 + Math.min(10, seenAt - this.lastBlockFetch) * 0.3;
        this.lastBlockFetch = seenAt;
        const want = Math.min(90, this.mirrorLag + this.cycleEma + 1.5);
        this.lagTarget = want > this.lagTarget ? want : this.lagTarget * 0.75 + want * 0.25;
    }

    // ---------- clock ----------
    /** Advances the replayed consensus clock; it never runs backwards. */
    advance(dt: number) {
        this.lag += (this.lagTarget - this.lag) * Math.min(1, dt * 0.4);
        this.displayRel = Math.max(this.displayRel, this.wallRel() - this.lag);
        this.landTxs();
    }

    /** Marks everything the consensus clock has passed as landed, and logs notable events. */
    landTxs() {
        const { booted, realT, market } = this;
        for (const tx of this.txs) {
            if (tx.landed) continue;
            if (tx.ct > this.displayRel) break;
            tx.landed = true;
            tx.landedReal = booted ? realT : -99;
            const live = booted && this.shown(tx);
            if (live && tx.node) tx.node.pulse = realT;
            if (live && market.isWhale(tx)) {
                tx.whaleAt = realT;
                this.logger.log(
                    "whalelog",
                    `**Whale transfer:** ${fmtHbar(tx.amt.hbar)} (${fmtUsd(market.usdOf(tx))}) ${tx.amt.hbarFrom || tx.payer} → ${tx.amt.hbarTo} via node ${tx.nodeAcct}.`,
                );
            }
            if (tx === this.tracked) {
                this.trackedDoneAt = realT;
                this.logger.log(
                    "track",
                    `Tracked ${tx.kind.key.toLowerCase()} reached consensus at **${fmtTs(tx.ts)}** via node ${tx.nodeAcct}.`,
                );
            }
        }
        for (const b of this.blocks) {
            if (b.sealedAt !== null || b.to > this.displayRel) continue;
            b.sealedAt = booted ? realT : -99;
            if (!this.latestShownBlock || b.num > this.latestShownBlock.num)
                this.latestShownBlock = b;
            if (booted && this.displayRel - b.to < 3)
                this.logger.log(
                    "block",
                    `**Block #${fmtInt(b.num)}** sealed: ${b.count} tx in ${(b.to - b.from).toFixed(2)} s.`,
                );
        }
    }

    /** Drops data that has left the window. Returns the numbers of the dropped blocks. */
    prune(): number[] {
        const cut = this.displayRel - CFG.window - 4;
        let i = 0;
        while (i < this.txs.length && this.txs[i].ct < cut && this.txs[i].landed) {
            this.txByKey.delete(this.txs[i].key);
            i++;
        }
        if (i) this.txs.splice(0, i);
        const dropped: number[] = [];
        while (this.blocks.length > 4 && this.blocks[0].to < cut) {
            const b = this.blocks.shift()!;
            this.blockByNum.delete(b.num);
            dropped.push(b.num);
        }
        return dropped;
    }

    // ---------- tracking ----------
    setTracked(tx: Tx | null, manual = false) {
        this.tracked = tx;
        if (!tx) return;
        this.trackedDoneAt = tx.landed ? this.realT + (manual ? 8 : 0) : null;
        this.logger.log(
            "track",
            `Tracking ${tx.kind.key.toLowerCase()} **${tx.id}** via node **${tx.nodeAcct}**.`,
        );
    }

    /** Picks the next transaction that has not reached the clock yet, so its arrival is visible. */
    pickNext() {
        const t = this.txs.find(
            x =>
                !x.landed &&
                x.node &&
                this.shown(x) &&
                x.ct - this.displayRel > 0.4 &&
                x !== this.tracked,
        );
        if (t) this.setTracked(t);
        return !!t;
    }

    /** Auto-tracking: once the tracked transaction has been on show for a while, follow a new one. */
    autoAdvanceTracking() {
        if (!this.autoTrack) return;
        const done = this.trackedDoneAt !== null && this.realT - this.trackedDoneAt > 9;
        if (!this.tracked || done) this.pickNext();
    }
}
