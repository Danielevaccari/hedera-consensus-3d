import { useEngine } from "../engine/EngineContext";
import { fmtInt, fmtStake } from "../lib/format";

const DESCRIPTION =
    "Each column is one real consensus node. Every dot is a real transaction, placed in the column of the node it was submitted to at its consensus timestamp. Time flows downward.";

export function TopBar() {
    const { ui } = useEngine();
    const s = ui.stats;
    const dash = "—";
    const stats: { value: string; label: string; title?: string }[] = [
        { value: s ? String(s.nodes) : dash, label: "nodes" },
        { value: s ? fmtStake(s.totalStake) : dash, label: "stake" },
        {
            value: s ? String(s.minSMNodes) : dash,
            label: ">⅔ stake",
            title: "Minimum number of nodes holding more than 2/3 of the stake",
        },
        {
            value: s?.pingShare != null ? `${Math.round(s.pingShare * 100)}%` : dash,
            label: "pings",
            title: "Share of transactions in the last 2 minutes that are Hedera's own health-check pings",
        },
        {
            value: s ? s.tps.toFixed(1) : dash,
            label: ui.options.hidePings ? "real tx/s" : "tx/s",
            title: "Transactions per second over the last 30 s",
        },
        { value: s?.latestBlock != null ? `#${fmtInt(s.latestBlock)}` : dash, label: "block" },
        {
            value: s ? `${s.lag.toFixed(1)}s` : dash,
            label: "behind",
            title: "How far this view runs behind real time",
        },
        { value: s ? s.clock : "--:--:--", label: "consensus clock" },
    ];
    return (
        <header className="hud hud-top glass">
            <div className="brand" title={DESCRIPTION}>
                <h1>
                    <span>Hedera mainnet</span> consensus, live in 3D
                </h1>
                <span className={`live${ui.online ? "" : " bad"}`}>
                    <i />
                    {ui.online ? "LIVE" : "RECONNECTING"}
                </span>
            </div>
            <div className="stats">
                {stats.map(st => (
                    <div className="stat" key={st.label} title={st.title}>
                        <b>{st.value}</b>
                        <small>{st.label}</small>
                    </div>
                ))}
            </div>
        </header>
    );
}
