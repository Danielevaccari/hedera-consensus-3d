import { STORAGE_KEYS } from "../config";
import { useEngine } from "../engine/EngineContext";
import { usePersistentFlags } from "../hooks/usePersistentFlags";
import { ChartsStrip } from "./ChartsStrip";
import { ControlBar } from "./ControlBar";
import { LedgerPanel } from "./LedgerPanel";
import { LogPanel } from "./LogPanel";
import { TopBar } from "./TopBar";
import { TrackerPanel } from "./TrackerPanel";

/** The panels laid over the 3D view. Hidden entirely in presentation mode. */
export function Hud() {
    const { ui } = useEngine();
    const [collapsed, toggle] = usePersistentFlags(STORAGE_KEYS.panels);
    if (ui.options.present) return null;
    return (
        <>
            <TopBar />
            <aside className="hud hud-left">
                <TrackerPanel collapsed={!!collapsed.tracker} onToggle={() => toggle("tracker")} />
            </aside>
            <aside className="hud hud-right">
                <LedgerPanel collapsed={!!collapsed.ledger} onToggle={() => toggle("ledger")} />
                <LogPanel collapsed={!!collapsed.log} onToggle={() => toggle("log")} />
            </aside>
            <ChartsStrip />
            <ControlBar />
        </>
    );
}
