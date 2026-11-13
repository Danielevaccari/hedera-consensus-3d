import { useEngine } from "../engine/EngineContext";
import type { ShapeId } from "../engine/Engine";

const SHAPES: { id: ShapeId; full: string; short: string }[] = [
    { id: "round", full: "Round", short: "Round" },
    { id: "rect", full: "Rectangular", short: "Rect" },
    { id: "wall", full: "Wall", short: "Wall" },
    { id: "globe", full: "Globe", short: "Globe" },
];

/**
 * The one control for how the network is drawn: the tower as a round ring, a rectangular ring or
 * a flat wall, or the globe. (The short names are for narrower screens, see the CSS.)
 */
export function ViewSwitch() {
    const { engine, ui } = useEngine();
    const o = ui.options;
    const current: ShapeId = o.view === "globe" ? "globe" : o.layout;
    return (
        <div className="seg" role="group" aria-label="How the network is drawn">
            {SHAPES.map(s => (
                <button
                    key={s.id}
                    type="button"
                    aria-pressed={current === s.id}
                    className={current === s.id ? "on" : undefined}
                    onClick={() => engine.choose(s.id)}>
                    <span className="full">{s.full}</span>
                    <span className="short">{s.short}</span>
                </button>
            ))}
        </div>
    );
}
