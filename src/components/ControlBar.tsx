import { useEngine } from "../engine/EngineContext";
import { Legend } from "./Legend";
import { OptionsMenu } from "./OptionsMenu";

/** Four buttons: play/pause, follow a transaction, present, and the two menus. */
export function ControlBar() {
    const { engine, ui } = useEngine();
    return (
        <div className="controls glass">
            <button type="button" className="btn primary" onClick={() => engine.togglePause()}>
                {ui.options.paused ? "▶ Play" : "❚❚ Pause"}
            </button>
            <button type="button" className="btn gold" onClick={() => engine.trackNext()}>
                ★ <span className="lbl">Track next</span>
            </button>
            <button
                type="button"
                className="btn"
                title="Hide all panels and go full screen (P)"
                aria-label="Present"
                onClick={() => engine.setPresent(true)}>
                ⛶ <span className="lbl">Present</span>
            </button>
            <OptionsMenu />
            <Legend />
        </div>
    );
}
