import type { ReactNode } from "react";
import { useEngine } from "../engine/EngineContext";
import type { Market } from "../engine/Market";
import type { TrackerView } from "../engine/snapshot";
import { fmtHbar, fmtInt, fmtTs, fmtTsNs, fmtUsd } from "../lib/format";

interface Step {
    title: string;
    body: ReactNode;
    done?: boolean;
    /** a step that happens inside the nodes and has no public data */
    opaque?: boolean;
}

function journeySteps(view: TrackerView, market: Market, hashscanTx: string): Step[] {
    const { tx, landed, arriving, block, sinceValid } = view;
    const nd = tx.node;
    const usd = market.usdOf(tx);
    return [
        {
            title: "Signed by the payer",
            body: (
                <>
                    Payer <code>{tx.payer}</code> chose valid start <code>{fmtTs(tx.vs)}</code>{" "}
                    (client clock).
                </>
            ),
            done: true,
        },
        {
            title: `Submitted to node ${tx.nodeAcct}`,
            body: (
                <>
                    <code>{nd ? nd.acct : tx.nodeAcct}</code>
                    {nd && ` · ${nd.host}${nd.loc ? ", " + nd.loc : ""}`}.{" "}
                    {landed ? "" : arriving ? "Arriving…" : "Next in the replay queue…"}
                </>
            ),
            done: landed,
        },
        {
            title: "Gossip & virtual voting",
            body: "Happens inside the nodes. Hedera does not publish the gossip graph, so this step has no public data to show.",
            opaque: true,
        },
        {
            title: "Consensus timestamp",
            body: landed ? (
                <>
                    <code>{tx.ts}</code>
                    <br />
                    {fmtTsNs(tx.ts)} local time
                    <br />
                    {sinceValid.toFixed(2)} s after valid start (includes the client&apos;s own
                    delay before sending).
                </>
            ) : (
                "Assigned once nodes holding more than 2/3 of the stake have settled the order."
            ),
            done: landed,
        },
        {
            title: "Recorded in a block",
            body: block ? (
                <>
                    Block <code>#{fmtInt(block.num)}</code> · {block.count} tx · record file{" "}
                    <code>{block.name}</code>
                </>
            ) : (
                "Waiting for the record file from the mirror node…"
            ),
            done: landed && !!block,
        },
        {
            title: "Result",
            body: (
                <>
                    <span className={`pill ${tx.result === "SUCCESS" ? "ok" : "bad"}`}>
                        {tx.result}
                    </span>
                    {market.isWhale(tx) && <span className="whale">WHALE</span>} · fee{" "}
                    {fmtHbar(tx.fee)}
                    {usd >= 0.01 && ` · value ${fmtUsd(usd)}`}
                    <br />
                    <a
                        href={hashscanTx + encodeURIComponent(tx.ts)}
                        target="_blank"
                        rel="noopener noreferrer">
                        Open on HashScan ↗
                    </a>
                </>
            ),
            done: landed,
        },
    ];
}

/** Step state: done, the first not-done step is active, opaque steps are never either. */
function stepClasses(steps: Step[]) {
    let activeSet = false;
    return steps.map(s => {
        if (s.opaque) return "opaque";
        if (s.done) return "done";
        if (activeSet) return "";
        activeSet = true;
        return "active";
    });
}

/** One transaction followed from signing to its block. */
export function TrackerPanel() {
    const { engine, ui } = useEngine();
    const view = ui.tracker;
    if (!view)
        return (
            <p className="empty">Waiting for the next {ui.options.network.label} transaction…</p>
        );
    const steps = journeySteps(view, engine.market, ui.options.network.hashscanTx);
    const classes = stepClasses(steps);
    return (
        <>
            <div className="tx-head">
                <div className="star">★</div>
                <div>
                    <b>{view.tx.id}</b>
                    <small>
                        {view.tx.kind.key} · {engine.market.txText(view.tx)}
                    </small>
                    {view.tx.memo && <small className="memo">memo: {view.tx.memo}</small>}
                </div>
            </div>
            <ol className="steps">
                {steps.map((s, i) => (
                    <li key={s.title} className={classes[i]}>
                        <span className="ic">{s.opaque ? "?" : s.done ? "✓" : i + 1}</span>
                        <h3>{s.title}</h3>
                        <p>{s.body}</p>
                    </li>
                ))}
            </ol>
        </>
    );
}
