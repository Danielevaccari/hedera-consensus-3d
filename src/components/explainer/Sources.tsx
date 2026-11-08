const ext = { target: "_blank", rel: "noopener noreferrer" } as const;

export function Sources() {
    return (
        <section className="sources">
            <h3>Sources &amp; what is live</h3>
            <ol>
                <li>
                    L. Baird,{" "}
                    <em>
                        The Swirlds Hashgraph Consensus Algorithm: Fair, Fast, Byzantine Fault
                        Tolerance
                    </em>
                    , Swirlds Tech Report SWIRLDS-TR-2016-01 (2016).{" "}
                    <a href="https://www.swirlds.com/downloads/SWIRLDS-TR-2016-01.pdf" {...ext}>
                        PDF
                    </a>
                    . Source for the algorithm, rounds, fame voting, coin rounds (c = 10) and the
                    median timestamp.
                </li>
                <li>
                    Hedera documentation, <em>Hashgraph Consensus Algorithm</em> and{" "}
                    <em>Gossip about Gossip / Virtual Voting</em>.{" "}
                    <a
                        href="https://docs.hedera.com/hedera/core-concepts/hashgraph-consensus-algorithms"
                        {...ext}>
                        docs.hedera.com
                    </a>
                </li>
                <li>
                    K. Crary, <em>Verifying the Hashgraph Consensus Algorithm</em>, arXiv:2102.01167
                    (2021): a machine-checked (Coq) proof of the algorithm&apos;s safety.{" "}
                    <a href="https://arxiv.org/abs/2102.01167" {...ext}>
                        arXiv
                    </a>
                </li>
                <li>
                    Hedera, <em>Mirror Node REST API</em>: the live data source for this page (
                    <code>/network/nodes</code>, <code>/transactions</code>, <code>/blocks</code>).{" "}
                    <a href="https://docs.hedera.com/hedera/sdks-and-apis/rest-api" {...ext}>
                        docs.hedera.com
                    </a>
                </li>
            </ol>
            <p>
                <b>What is live and what is not.</b> The nodes, their stake, every transaction
                (type, submitting node, consensus timestamp, result, fee) and every block in the 3D
                view come from the Hedera mainnet public mirror node, which this page polls about
                every 2.5 seconds. The view runs a few seconds behind real time because the mirror
                node publishes each record file a few seconds after consensus. Hedera does not
                publish the gossip graph itself (events, rounds, witnesses, fame votes), so the
                cards above explain those steps but the 3D view does not draw them. The exact moment
                a transaction reached its node is not public either. Its fly-in animation is timed
                to end at its consensus timestamp. Health-check pings (transactions whose memo names
                Hedera&apos;s mirror-node monitor) are hidden by default and can be shown in the
                Options menu. USD values use the mirror node&apos;s current HBAR exchange rate, and
                token names come from the mirror node&apos;s token records; token transfers have no
                USD price, so whale alerts cover HBAR transfers only.
            </p>
            <p>
                <b>About the globe.</b> Node positions are approximate: they come from the host city
                in each node&apos;s mirror-node description (a state or region centre where only
                that is given), and nodes in the same city are spread apart slightly so each stays
                visible. The arcs connect each transaction to the next one in the real consensus
                order; they are not network paths. Hedera does not publish where clients are, so the
                globe does not draw that. The map is drawn as plain lines: Natural Earth 50 m
                coastlines (world-atlas package) and a 30° grid.
            </p>
        </section>
    );
}
