import type { CSSProperties, ReactNode } from "react";
import type { Stats } from "../../engine/snapshot";
import { fmtStake } from "../../lib/format";
import {
    EventAnatomy,
    GossipFigure,
    HashgraphFigure,
    OrderFigure,
    RoundsFigure,
    StronglySeeFigure,
    TimestampFigure,
    VotingFigure,
} from "./figures";
import { Sources } from "./Sources";

interface Piece {
    no: string;
    accent: string;
    title: string;
    figure: ReactNode;
    body: ReactNode;
}

const PIECES: Piece[] = [
    {
        no: "01 · GOSSIP ABOUT GOSSIP",
        accent: "var(--cyan)",
        title: "Gossip about gossip",
        figure: <GossipFigure />,
        body: (
            <>
                Each node keeps syncing with randomly chosen peers and sends whatever the peer has
                not seen yet. After every sync the receiver records a new <b>event</b>, so the
                network spreads transactions <b>and</b> the history of who talked to whom. News
                reaches everyone exponentially fast.
            </>
        ),
    },
    {
        no: "02 · THE EVENT",
        accent: "var(--violet)",
        title: "Events are the building blocks",
        figure: <EventAnatomy />,
        body: (
            <>
                An event is a signed container holding new transactions, the creator&apos;s claimed
                time, and two hashes: the creator&apos;s own previous event (<b>self-parent</b>) and
                the peer&apos;s latest event (<b>other-parent</b>). Because of the hashes, nobody
                can rewrite history without being detected.
            </>
        ),
    },
    {
        no: "03 · THE HASHGRAPH",
        accent: "var(--pink)",
        title: "A shared graph of history",
        figure: <HashgraphFigure />,
        body: (
            <>
                The parent links form a directed acyclic graph: one line per node, with a cross-link
                for every sync. Every node holds a copy, and the copies differ only at the newest
                edges. On mainnet this graph exists only inside the nodes. The view above shows what
                comes out of it: every transaction with the timestamp and order the graph produced.
            </>
        ),
    },
    {
        no: "04 · ROUNDS & WITNESSES",
        accent: "var(--green)",
        title: "Rounds and witnesses",
        figure: <RoundsFigure />,
        body: (
            <>
                An event&apos;s round equals the highest round of its parents, plus one if it{" "}
                <b>strongly sees</b> a supermajority of that round&apos;s witnesses. The first event
                each node creates in a new round is a <b>witness</b>.
            </>
        ),
    },
    {
        no: "05 · STRONGLY SEEING",
        accent: "var(--orange)",
        title: "Seeing and strongly seeing",
        figure: <StronglySeeFigure />,
        body: (
            <>
                A <b>sees</b> B if B is one of A&apos;s ancestors. A <b>strongly sees</b> B if the
                paths from A down to B pass through events made by a supermajority: more than 2/3 of
                the nodes in the paper, more than 2/3 of the <b>stake</b> on Hedera. Any two
                supermajorities overlap in at least one honest node, and the security proofs build
                on that overlap.
            </>
        ),
    },
    {
        no: "06 · VIRTUAL VOTING",
        accent: "var(--gold)",
        title: "Virtual voting finds famous witnesses",
        figure: <VotingFigure />,
        body: (
            <>
                A round-r witness is <b>famous</b> if enough later witnesses saw it. Each round r+1
                witness &quot;votes yes&quot; if it sees it. Round r+2 witnesses count the votes of
                the witnesses they strongly see, and a &gt;2/3 tally decides. On Hedera each vote
                counts in proportion to the node&apos;s stake. No ballot is ever sent: every node
                computes these votes from the graph it already holds.
            </>
        ),
    },
    {
        no: "07 · CONSENSUS TIMESTAMP",
        accent: "var(--blue)",
        title: "Round received & consensus time",
        figure: <TimestampFigure />,
        body: (
            <>
                When fame is settled for every witness of round r, any event that all famous
                witnesses can see gets <b>round received = r</b>. Its consensus timestamp is the{" "}
                <b>median</b> of the times those nodes first received it, so a dishonest minority
                cannot drag it earlier or later. These are the timestamps that position every dot in
                the view above.
            </>
        ),
    },
    {
        no: "08 · ORDER & FINALITY",
        accent: "var(--red)",
        title: "Total order and instant finality",
        figure: <OrderFigure />,
        body: (
            <>
                Events are sorted by round received, then by consensus timestamp, then by a whitened
                signature to break ties. Every honest node gets the same list on its own. There are
                no forks to wait out, so once ordered a transaction is final, not just
                &quot;probably final&quot;. The protocol is{" "}
                <b>asynchronous Byzantine fault tolerant</b>: it stays safe while less than 1/3 of
                the stake is faulty, even if messages are delayed.
            </>
        ),
    },
];

/** Live network numbers next to the algorithm's constants. */
function Numbers({ stats }: { stats: Stats | null }) {
    const dash = "—";
    return (
        <div className="numbers">
            <div className="num">
                <b>{stats ? stats.nodes : dash}</b>
                <span>
                    consensus nodes on Hedera mainnet right now, loaded live from the mirror node
                </span>
            </div>
            <div className="num">
                <b>&gt; 2/3</b>
                <span>
                    of all <b>stake</b> must agree. Right now that is more than{" "}
                    <em>{stats ? fmtStake((2 * stats.totalStake) / 3) : dash}</em>, held by at least{" "}
                    <em>{stats ? stats.minSMNodes : dash}</em> nodes
                </span>
            </div>
            <div className="num">
                <b>&lt; 1/3</b>
                <span>
                    of stake can be faulty or malicious and the network stays safe: right now that
                    is under <em>{stats ? fmtStake(stats.totalStake / 3) : dash}</em>
                </span>
            </div>
            <div className="num">
                <b>0</b>
                <span>vote messages sent: voting is virtual and computed locally</span>
            </div>
            <div className="num">
                <b>c = 10</b>
                <span>a coin round every 10th voting round guarantees the vote ends</span>
            </div>
        </div>
    );
}

export function Explainer({ stats }: { stats: Stats | null }) {
    return (
        <main className="explain">
            <div className="eyebrow">How it works</div>
            <h2>The main pieces of the hashgraph algorithm</h2>
            <p className="lede">
                Hashgraph reaches agreement without a leader, without blocks and without sending a
                single vote over the network. Nodes only gossip. Each node can then work out from
                its own copy of the graph how every other node <em>would</em> vote, so every honest
                node arrives at the same order of transactions. The 3D view above shows the result
                of that process on Hedera mainnet, live.
            </p>
            <Numbers stats={stats} />
            <div className="grid">
                {PIECES.map(p => (
                    <article
                        key={p.no}
                        className="piece"
                        style={{ "--acc": p.accent } as CSSProperties}>
                        <div className="no">{p.no}</div>
                        {p.figure}
                        <h3>{p.title}</h3>
                        <p>{p.body}</p>
                    </article>
                ))}
            </div>
            <Sources />
        </main>
    );
}
