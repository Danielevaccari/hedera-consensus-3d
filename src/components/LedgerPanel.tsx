import { memo, useCallback, type CSSProperties } from "react";
import { useEngine } from "../engine/EngineContext";
import type { Tx } from "../engine/types";
import { fmtTs } from "../lib/format";

interface RowProps {
    tx: Tx;
    tracked: boolean;
    whale: boolean;
    /** the one-line summary (it changes once a token's name has loaded) */
    text: string;
    onTrack: (tx: Tx) => void;
}

/**
 * One ledger row. Memoised: the ledger holds every transaction in the tower's window (over a
 * thousand on a busy network) and is refreshed several times a second, but a row only changes
 * when it is followed, or when its summary or whale flag does.
 */
const LedgerRow = memo(function LedgerRow({ tx, tracked, whale, text, onTrack }: RowProps) {
    return (
        <li
            className={tracked ? "tracked" : undefined}
            title={`${tx.id} · ${tx.name}`}
            onClick={() => onTrack(tx)}>
            <div className="l1">
                <span className="kind" style={{ "--k": tx.kind.hex } as CSSProperties}>
                    {tracked ? "★ " : ""}
                    {tx.kind.key}
                </span>
                {whale && <span className="whale">WHALE</span>}
                {tx.result !== "SUCCESS" && <span className="res">{tx.result}</span>}
                <span className="ts">{fmtTs(tx.ts)}</span>
            </div>
            <div className="l2">
                {text} · via {tx.node ? `${tx.node.acct} ${tx.node.host}` : tx.nodeAcct}
            </div>
        </li>
    );
});

/** Every transaction in the window, newest first, in real consensus order. Click a row to follow it. */
export function LedgerPanel() {
    const { engine, ui } = useEngine();
    const onTrack = useCallback((tx: Tx) => engine.track(tx), [engine]);
    const tracked = ui.tracker?.tx;
    const market = engine.market;
    if (!ui.ledger.length)
        return <p className="empty">Waiting for {ui.options.network.label} transactions…</p>;
    return (
        <ol className="ledger">
            {ui.ledger.map(tx => (
                <LedgerRow
                    key={tx.key}
                    tx={tx}
                    tracked={tx === tracked}
                    whale={market.isWhale(tx)}
                    text={market.txText(tx)}
                    onTrack={onTrack}
                />
            ))}
        </ol>
    );
}
