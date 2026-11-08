import type { CSSProperties } from "react";
import { useEngine } from "../engine/EngineContext";
import { fmtTs } from "../lib/format";

/** Newest transactions first, in real consensus order. Click a row to follow it. */
export function LedgerPanel() {
    const { engine, ui } = useEngine();
    const tracked = ui.tracker?.tx;
    const market = engine.market;
    if (!ui.ledger.length) return <p className="empty">Waiting for mainnet transactions…</p>;
    return (
        <ol className="ledger">
            {ui.ledger.map(tx => {
                const isTracked = tx === tracked;
                return (
                    <li
                        key={tx.key}
                        className={isTracked ? "tracked" : undefined}
                        title={`${tx.id} · ${tx.name}`}
                        onClick={() => engine.track(tx)}>
                        <div className="l1">
                            <span className="kind" style={{ "--k": tx.kind.hex } as CSSProperties}>
                                {isTracked ? "★ " : ""}
                                {tx.kind.key}
                            </span>
                            {market.isWhale(tx) && <span className="whale">WHALE</span>}
                            {tx.result !== "SUCCESS" && <span className="res">{tx.result}</span>}
                            <span className="ts">{fmtTs(tx.ts)}</span>
                        </div>
                        <div className="l2">
                            {market.txText(tx)} · via{" "}
                            {tx.node ? `${tx.node.acct} ${tx.node.host}` : tx.nodeAcct}
                        </div>
                    </li>
                );
            })}
        </ol>
    );
}
