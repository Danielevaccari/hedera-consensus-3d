import { useEngine } from "../engine/EngineContext";
import { Popover } from "./Popover";

interface OptionProps {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: () => void;
}

function Option({ label, hint, checked, onChange }: OptionProps) {
    return (
        <label className="opt">
            <input type="checkbox" checked={checked} onChange={onChange} />
            <span>
                {label}
                {hint && <small>{hint}</small>}
            </span>
        </label>
    );
}

/** The less-used toggles, kept out of the main control bar. */
export function OptionsMenu() {
    const { engine, ui } = useEngine();
    const o = ui.options;
    return (
        <Popover label="⚙ Options" title="View options">
            <div className="options">
                <Option
                    label="Auto-rotate"
                    checked={o.autoRotate}
                    onChange={() => engine.toggleAutoRotate()}
                />
                <Option
                    label="Flashy effects"
                    hint="glow, neon trails, shockwaves"
                    checked={o.fx}
                    onChange={() => engine.toggleFx()}
                />
                <Option
                    label="Hide health-check pings"
                    hint="Hedera's own monitoring traffic"
                    checked={o.hidePings}
                    onChange={() => engine.togglePings()}
                />
                <Option
                    label="Animations"
                    hint="view-switch morph and effect motion; follows your system until you change it"
                    checked={o.motion}
                    onChange={() => engine.toggleMotion()}
                />
                <Option
                    label="Show live charts"
                    checked={o.charts}
                    onChange={() => engine.toggleCharts()}
                />
                <p className="fine">
                    Drag to orbit · scroll to zoom · click a dot to follow it · Space pauses · P
                    presents
                </p>
            </div>
        </Popover>
    );
}
