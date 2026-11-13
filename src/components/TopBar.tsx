import { useEngine } from "../engine/EngineContext";
import type { DrawerState } from "../hooks/useDrawerState";
import { fmtInt } from "../lib/format";
import { InfoPopover } from "./InfoPopover";
import { NetworkSwitch } from "./NetworkSwitch";
import { ViewSwitch } from "./ViewSwitch";

/** Slim bar over the 3D view: title, live badge, view switch, four key stats and a few tools. */
export function TopBar({ drawer }: { drawer: DrawerState }) {
    const { engine, ui } = useEngine();
    const network = ui.options.network;
    const s = ui.stats;
    const dash = "—";
    const stats = [
        { value: s ? s.tps.toFixed(1) : dash, label: ui.options.hidePings ? "real tx/s" : "tx/s" },
        { value: s?.latestBlock != null ? `#${fmtInt(s.latestBlock)}` : dash, label: "block" },
        { value: s ? `${s.lag.toFixed(1)}s` : dash, label: "behind" },
        { value: s ? s.clock : "--:--:--", label: "clock" },
    ];
    const dark = ui.options.theme === "dark";
    const themeLabel = dark ? "Switch to the light theme" : "Switch to the dark theme";
    return (
        <header className="topbar glass">
            <div className="brand">
                <h1>
                    <span>Hedera</span>
                </h1>
                <span
                    className={`live${ui.online ? "" : " bad"}`}
                    role="status"
                    aria-label={
                        ui.online ? `Live ${network.label} data` : "Mirror node unreachable"
                    }>
                    <i />
                    <b>{ui.online ? "LIVE" : "RETRYING"}</b>
                </span>
                <NetworkSwitch />
            </div>
            <ViewSwitch />
            <div className="stats">
                {stats.map(st => (
                    <div className="stat" key={st.label}>
                        <b>{st.value}</b>
                        <small>{st.label}</small>
                    </div>
                ))}
            </div>
            <div className="tools">
                <InfoPopover />
                <button
                    type="button"
                    className="btn icon"
                    title={themeLabel}
                    aria-label={themeLabel}
                    onClick={() => engine.toggleTheme()}>
                    {dark ? "☀" : "☾"}
                </button>
                <button
                    type="button"
                    className={`btn details${drawer.open && !drawer.narrow ? " on" : ""}`}
                    aria-expanded={drawer.open}
                    aria-controls="drawer"
                    onClick={() => {
                        if (drawer.narrow)
                            document
                                .getElementById("drawer")
                                ?.scrollIntoView({ behavior: "smooth" });
                        else drawer.setOpen(!drawer.open);
                    }}>
                    {drawer.narrow ? "↓" : "☰"} <span className="lbl">Details</span>
                </button>
            </div>
        </header>
    );
}
