// Loads the network from the mirror node and keeps it up to date.
import { CFG } from "../config";
import { AbortedError, type MirrorClient } from "../api/MirrorClient";
import type {
    BlocksPage,
    ExchangeRate,
    MirrorNode,
    MirrorToken,
    NodesPage,
    TransactionsPage,
} from "../api/types";
import { fmtStake, splitTs, trunc } from "../lib/format";
import type { LiveState } from "./LiveState";
import type { Logger } from "./Logger";
import type { Market } from "./Market";

const RATE_REFRESH_MS = 5 * 60 * 1000;

export class Feed {
    /** false after a failed poll, until the next one succeeds */
    online = true;
    private fails = 0;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private stopped = false;
    private backfillUrl: string | null = null;
    private backfillFails = 0;
    private tokenTurn = false;

    constructor(
        private client: MirrorClient,
        private state: LiveState,
        private market: Market,
        private logger: Logger,
    ) {}

    /** Loads nodes, blocks and the newest page of transactions. Throws if the mirror node fails. */
    async boot() {
        const { client, state } = this;
        const raw: MirrorNode[] = [];
        let url: string | null | undefined = "/network/nodes?limit=25&order=asc";
        for (let i = 0; url && i < 8; i++) {
            const d: NodesPage = await client.get<NodesPage>(url);
            raw.push(...d.nodes);
            url = d.links?.next;
        }
        if (!raw.length) throw new Error("the mirror node returned no consensus nodes");
        await this.refreshRate().catch(rethrowAbort); // no USD values until the next refresh

        const bd = await client.get<BlocksPage>("/blocks?order=desc&limit=80");
        if (!bd.blocks.length) throw new Error("the mirror node returned no blocks");
        const blocksSeenAt = (performance.timeOrigin + performance.now()) / 1000;
        const newest = bd.blocks[0].timestamp;
        state.T0 = splitTs(newest.to || newest.from)[0] - 120;
        state.setupNodes(raw);
        bd.blocks
            .slice()
            .reverse()
            .forEach(b => state.addBlock(b));

        // Newest page of transactions first so the view can start; older history is filled in
        // afterwards. The query is bounded to the tower's window: the mirror node throttles
        // unbounded backwards paging (timestamp=lt:… alone), but answers bounded range pages.
        const fromSec = state.T0 + Math.floor(state.horizonRel - CFG.window - 8);
        const d = await client.get<TransactionsPage>(
            `/transactions?order=desc&limit=100&timestamp=gte:${fromSec}`,
        );
        d.transactions
            .slice()
            .reverse()
            .forEach(t => state.addTx(t));
        this.backfillUrl = d.links?.next ?? null;
        if (state.lastTxTs === null) state.lastTxTs = newest.to || newest.from;
        state.assignBlocks();
        state.measureLag(blocksSeenAt - state.T0);
        state.lag = state.lagTarget;
        state.displayRel = state.wallRel() - state.lag;
        state.landTxs(); // everything already in the past lands without animation

        this.logger.log(
            "conn",
            `Connected to **Hedera mainnet**: ${state.nodes.length} consensus nodes, ${fmtStake(state.totalStake)} staked. More than 2/3 of stake needs at least **${state.minSMNodes} nodes**.`,
        );
        this.logger.log(
            "conn",
            `Mirror node publishes about **${state.mirrorLag.toFixed(1)} s** after consensus, so this view runs ~${state.lag.toFixed(1)} s behind real time.`,
        );
    }

    start() {
        this.schedule(CFG.POLL_MS);
    }

    stop() {
        this.stopped = true;
        if (this.timer) clearTimeout(this.timer);
    }

    private schedule(ms: number) {
        if (!this.stopped) this.timer = setTimeout(() => void this.poll(), ms);
    }

    /** One poll cycle: new transactions, then one of history / price / token name / new blocks. */
    private async poll() {
        const { client, state, market } = this;
        try {
            let url: string | null | undefined =
                `/transactions?timestamp=gt:${state.lastTxTs}&order=asc&limit=100`;
            let seenAt: number | null = null;
            for (let i = 0; url && i < 6; i++) {
                const d: TransactionsPage = await client.get<TransactionsPage>(url);
                seenAt ??= state.wallRel();
                for (const t of d.transactions) state.addTx(t);
                url = d.transactions.length === 100 ? d.links?.next : null;
            }

            if (this.backfillUrl) await this.backfillPage();
            else if (performance.now() - market.rateFetchedAt > RATE_REFRESH_MS)
                await this.refreshRate().catch(rethrowAbort);
            else if (market.hasQueuedTokens() && (this.tokenTurn = !this.tokenTurn))
                await this.fetchToken(market.nextQueuedToken()!);
            else {
                const bd = await client.get<BlocksPage>(
                    `/blocks?block.number=gt:${state.lastBlockNum}&order=asc&limit=25`,
                );
                for (const b of bd.blocks) state.addBlock(b);
            }

            state.assignBlocks();
            if (seenAt !== null) state.measureLag(seenAt);
            if (this.fails) this.logger.log("conn", "**Reconnected** to the mirror node.");
            this.fails = 0;
            this.online = true;
        } catch (err) {
            if (err instanceof AbortedError) return;
            this.fails++;
            if (this.fails === 1 || this.fails % 5 === 0)
                this.logger.log(
                    "warn",
                    `**Mirror node request failed** (${errorMessage(err)}). Retrying…`,
                );
            this.online = false;
        }
        this.schedule(this.fails ? Math.min(15000, CFG.POLL_MS * 2 ** this.fails) : CFG.POLL_MS);
    }

    /**
     * Loads the rest of the tower's history one page per poll cycle (newest to oldest), so the
     * live feed keeps its share of the rate limit. These transactions are already in the past,
     * so they land quietly.
     */
    private async backfillPage() {
        const { state } = this;
        let d: TransactionsPage;
        try {
            d = await this.client.get<TransactionsPage>(this.backfillUrl!, 0);
        } catch (err) {
            rethrowAbort(err);
            if (++this.backfillFails >= 6) {
                this.backfillUrl = null;
                this.logger.log("warn", `**Could not load older history** (${errorMessage(err)}).`);
            }
            return;
        }
        this.backfillFails = 0;
        for (const t of d.transactions) {
            const tx = state.addTx(t);
            if (tx && tx.ct <= state.displayRel) {
                tx.landed = true;
                tx.landedReal = -99;
            }
        }
        state.assignBlocks();
        this.backfillUrl = d.links?.next ?? null;
        if (!this.backfillUrl)
            this.logger.log(
                "conn",
                `History loaded: the tower now shows the last **${Math.round(CFG.window / 60)} minutes** of mainnet transactions.`,
            );
    }

    private async refreshRate() {
        this.market.rateFetchedAt = performance.now();
        const d = await this.client.get<ExchangeRate>("/network/exchangerate", 1);
        const r = d.current_rate;
        if (r) this.market.setRate(r.cent_equivalent, r.hbar_equivalent);
    }

    private async fetchToken(id: string) {
        try {
            const d = await this.client.get<MirrorToken>(`/tokens/${id}`, 1);
            this.market.setToken(id, {
                symbol: trunc(String(d.symbol || d.name || id), 14),
                decimals: Math.min(18, Number(d.decimals) || 0),
            });
        } catch (err) {
            rethrowAbort(err);
            this.market.setToken(id, false);
        }
    }
}

function rethrowAbort(err: unknown) {
    if (err instanceof AbortedError) throw err;
}

export function errorMessage(err: unknown) {
    return err instanceof Error ? err.message : String(err);
}
