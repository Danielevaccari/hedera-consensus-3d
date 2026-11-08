import { useEngine } from "../engine/EngineContext";
import type { ViewId } from "../scene/View3D";

const VIEWS: { id: ViewId; label: string }[] = [
    { id: "tower", label: "Tower" },
    { id: "globe", label: "Globe" },
];

/** Segmented switch between the two 3D views. */
export function ViewSwitch() {
    const { engine, ui } = useEngine();
    return (
        <div className="seg" role="group" aria-label="3D view">
            {VIEWS.map(v => (
                <button
                    key={v.id}
                    type="button"
                    aria-pressed={ui.options.view === v.id}
                    className={ui.options.view === v.id ? "on" : undefined}
                    onClick={() => engine.setView(v.id)}>
                    {v.label}
                </button>
            ))}
        </div>
    );
}
