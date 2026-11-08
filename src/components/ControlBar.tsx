import { useEngine } from "../engine/EngineContext";
import { Legend } from "./Legend";

export function ControlBar() {
    const { engine, ui } = useEngine();
    const o = ui.options;
    return (
        <div className="hud hud-bottom glass">
            <button type="button" className="btn primary" onClick={() => engine.togglePause()}>
                {o.paused ? "▶ Play" : "❚❚ Pause"}
            </button>
            <button type="button" className="btn gold" onClick={() => engine.trackNext()}>
                ★ Track next
            </button>
            <button
                type="button"
                className={`btn${o.unrolled ? " on" : ""}`}
                onClick={() => engine.toggleUnroll()}>
                {o.unrolled ? "⭘ Roll up" : "⇆ Unroll"}
            </button>
            <button
                type="button"
                className={`btn${o.autoRotate ? " on" : ""}`}
                onClick={() => engine.toggleAutoRotate()}>
                ⟳ Rotate
            </button>
            <button
                type="button"
                className="btn"
                title={
                    o.theme === "dark" ? "Switch to the light theme" : "Switch to the dark theme"
                }
                onClick={() => engine.toggleTheme()}>
                {o.theme === "dark" ? "☀ Light" : "☾ Dark"}
            </button>
            {/* bloom and neon effects need a dark background */}
            {o.theme === "dark" && (
                <button
                    type="button"
                    className="btn fx-toggle"
                    title={
                        o.fx ? "Switch to the calm, plain design" : "Switch to the flashy design"
                    }
                    onClick={() => engine.toggleFx()}>
                    {o.fx ? "✦ Flashy" : "◐ Calm"}
                </button>
            )}
            <button
                type="button"
                className={`btn${o.hidePings ? " on" : ""}`}
                title={
                    o.hidePings
                        ? "Show Hedera's own health-check transactions too"
                        : "Hide Hedera's own health-check transactions"
                }
                onClick={() => engine.togglePings()}>
                {o.hidePings ? "⦸ Pings hidden" : "◉ Pings shown"}
            </button>
            <button
                type="button"
                className="btn"
                title="Hide all panels and go full screen (P)"
                onClick={() => engine.setPresent(true)}>
                ⛶ Present
            </button>
            <Legend />
            <span className="hint">
                drag orbit · scroll zoom · click a dot to track · Space pause · P present
            </span>
        </div>
    );
}
