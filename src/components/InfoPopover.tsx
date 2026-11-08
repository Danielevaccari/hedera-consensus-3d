import { useEngine } from "../engine/EngineContext";
import { fmtInt, fmtStake } from "../lib/format";
import { Popover } from "./Popover";

const DESCRIPTIONS = {
    tower: "Each column is one real consensus node. Every dot is a real transaction, placed in the column of the node it was submitted to at its consensus timestamp. Time flows downward.",
    globe: "Each dot is a real consensus node at its host city. Transactions land on the node they were submitted to at their consensus timestamp, and arcs follow the real consensus order from one transaction to the next.",
};

/** Everything the top bar leaves out: the explanation and the full stat list. */
export function InfoPopover() {
    const { ui } = useEngine();
    const s = ui.stats;
    const dash = "—";
    const rows: [string, string][] = [
        ["Consensus nodes", s ? String(s.nodes) : dash],
        ["Total stake", s ? fmtStake(s.totalStake) : dash],
        ["Min nodes for > ⅔ stake", s ? String(s.minSMNodes) : dash],
        [
            "Health-check pings (2 min)",
            s?.pingShare != null ? `${Math.round(s.pingShare * 100)}%` : dash,
        ],
        ["Transactions / s (30 s)", s ? s.tps.toFixed(1) : dash],
        ["Latest block", s?.latestBlock != null ? `#${fmtInt(s.latestBlock)}` : dash],
        ["Behind real time", s ? `${s.lag.toFixed(1)} s` : dash],
        ["Consensus clock", s ? s.clock : "--:--:--"],
    ];
    return (
        <Popover
            label="ⓘ"
            title="About this view and all stats"
            className="btn icon"
            placement="down"
            align="right">
            <div className="info">
                <p>{DESCRIPTIONS[ui.options.view]}</p>
                <dl>
                    {rows.map(([k, v]) => (
                        <div key={k}>
                            <dt>{k}</dt>
                            <dd>{v}</dd>
                        </div>
                    ))}
                </dl>
                <p className="fine">Data: Hedera public mirror node, polled every ~2.5 s.</p>
            </div>
        </Popover>
    );
}
