import { useLayoutEffect, useRef, useState } from "react";
import type { HNode, Tx } from "../engine/types";
import { useEngine } from "../engine/EngineContext";
import { useStore } from "../hooks/useStore";
import { fmtHbar, fmtInt, fmtStake, fmtTs, fmtTsNs, fmtUsd } from "../lib/format";

function NodeContent({ nd }: { nd: HNode }) {
    const { ui } = useEngine();
    const total = ui.stats?.totalStake || 1;
    return (
        <>
            <h4>
                <i style={{ background: nd.hex }} />
                Node {nd.acct}
            </h4>
            <dl className="kv">
                <dt>hosted by</dt>
                <dd>{nd.host}</dd>
                <dt>location</dt>
                <dd>{nd.loc || "—"}</dd>
                <dt>node id</dt>
                <dd>{nd.id}</dd>
                <dt>stake</dt>
                <dd>
                    {fmtStake(nd.stake)} · {((nd.stake / total) * 100).toFixed(2)}%
                </dd>
                <dt>tx in view</dt>
                <dd>{nd.count} submitted via this node</dd>
            </dl>
            <div className="note">
                Every node holds a full copy of the hashgraph and computes the same order. A bigger
                sphere means more stake, which means more voting weight.
            </div>
        </>
    );
}

function TxContent({ tx }: { tx: Tx }) {
    const { engine, ui } = useEngine();
    const m = engine.market;
    const usd = m.usdOf(tx);
    const ok = tx.result === "SUCCESS";
    return (
        <>
            <h4>
                <i style={{ background: tx.kind.hex }} />
                {tx.kind.key} <span className={`pill ${ok ? "ok" : "bad"}`}>{tx.result}</span>
            </h4>
            <dl className="kv">
                <dt>type</dt>
                <dd>{tx.name}</dd>
                <dt>tx id</dt>
                <dd>{tx.id}</dd>
                <dt>summary</dt>
                <dd>{m.txText(tx)}</dd>
                <dt>via node</dt>
                <dd>
                    {tx.nodeAcct}
                    {tx.node && ` · ${tx.node.host}`}
                </dd>
                <dt>consensus</dt>
                <dd>{fmtTsNs(tx.ts)}</dd>
                <dt>valid start</dt>
                <dd>{fmtTs(tx.vs)}</dd>
                <dt>block</dt>
                <dd>{tx.block ? `#${fmtInt(tx.block.num)}` : "—"}</dd>
                {usd >= 0.01 && (
                    <>
                        <dt>value</dt>
                        <dd>
                            {fmtUsd(usd)}
                            {m.isWhale(tx) && " · WHALE"}
                        </dd>
                    </>
                )}
                <dt>fee</dt>
                <dd>{fmtHbar(tx.fee)}</dd>
                {tx.memo && (
                    <>
                        <dt>memo</dt>
                        <dd>{tx.memo}</dd>
                    </>
                )}
            </dl>
            <div className="note">
                {tx === ui.tracker?.tx
                    ? "This transaction is tracked in the journey panel."
                    : "Click to follow this transaction in the journey panel."}
            </div>
        </>
    );
}

/** Hover card for nodes and transactions, kept inside the viewport. */
export function Tooltip() {
    const { engine } = useEngine();
    const hover = useStore(engine.hover);
    const ref = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ left: 0, top: 0 });

    useLayoutEffect(() => {
        const el = ref.current;
        const vp = el?.parentElement;
        if (!hover || !el || !vp) return;
        let x = hover.x + 16;
        let y = hover.y + 16;
        if (x + el.offsetWidth > vp.clientWidth - 8) x = hover.x - el.offsetWidth - 16;
        if (y + el.offsetHeight > vp.clientHeight - 8)
            y = Math.max(8, vp.clientHeight - el.offsetHeight - 8);
        setPos({ left: x, top: y });
    }, [hover]);

    return (
        <div ref={ref} className={`tip glass${hover ? " show" : ""}`} style={pos} role="tooltip">
            {hover?.target.type === "node" && <NodeContent nd={hover.target.node} />}
            {hover?.target.type === "tx" && <TxContent tx={hover.target.tx} />}
        </div>
    );
}
