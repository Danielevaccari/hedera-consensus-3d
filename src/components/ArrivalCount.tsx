import { useEngine } from "../engine/EngineContext";
import { fmtInt } from "../lib/format";

/**
 * A big live number shown for the first few seconds: how many transactions have reached consensus
 * since the page opened. It fades itself out (see .arrival in the CSS) and stays in the info popover.
 */
export function ArrivalCount() {
    const { ui } = useEngine();
    if (ui.phase !== "live" || !ui.stats) return null;
    return (
        <div className="arrival" aria-hidden="true">
            <b>{fmtInt(ui.stats.sinceOpen)}</b>
            <span>transactions reached consensus since you opened this page</span>
        </div>
    );
}
