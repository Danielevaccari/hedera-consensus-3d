import type { CSSProperties } from "react";
import { KIND_LIST } from "../config";
import { useEngine } from "../engine/EngineContext";
import type { ViewId } from "../scene/View3D";
import { Popover } from "./Popover";

interface Entry {
    cls: string;
    label: string;
}

const COMMON: Entry[] = [
    { cls: "fail", label: "Failed (not SUCCESS)" },
    { cls: "trk", label: "Tracked transaction" },
];

const EXTRA: Record<ViewId, Entry[]> = {
    tower: [
        { cls: "wh", label: "Whale (≥ $10k HBAR)" },
        { cls: "thread", label: "Consensus order" },
        { cls: "blk", label: "Block sealed (record file)" },
        { cls: "now", label: "Consensus clock" },
        { cls: "stake", label: "Node size = stake" },
    ],
    globe: [
        { cls: "thread", label: "Consensus order arc (60 s)" },
        { cls: "spike", label: "Spike = tx received (2 min)" },
        { cls: "stake", label: "Dot size = stake" },
    ],
};

/** The colour key, behind a button so it doesn't take permanent space. */
export function Legend() {
    const { ui } = useEngine();
    const light = ui.options.theme === "light";
    return (
        <Popover
            label={
                <>
                    ◍ <span className="lbl">Legend</span>
                </>
            }
            title="Legend">
            <div className="legend">
                {KIND_LIST.map(k => (
                    <span className="lg" key={k.id}>
                        <i
                            className="sw k"
                            style={{ "--k": light ? k.hexLight : k.hex } as CSSProperties}
                        />
                        {k.label}
                    </span>
                ))}
                {[...COMMON, ...EXTRA[ui.options.view]].map(e => (
                    <span className="lg" key={e.cls}>
                        <i className={`sw ${e.cls}`} />
                        {e.label}
                    </span>
                ))}
            </div>
        </Popover>
    );
}
