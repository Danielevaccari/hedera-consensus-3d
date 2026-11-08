import { useEffect, useRef, useState, type CSSProperties } from "react";
import { KIND_LIST } from "../config";

const EXTRA: { cls: string; label: string }[] = [
    { cls: "fail", label: "Failed (not SUCCESS)" },
    { cls: "trk", label: "Tracked transaction" },
    { cls: "wh", label: "Whale (≥ $10k HBAR)" },
    { cls: "thread", label: "Consensus order" },
    { cls: "blk", label: "Block sealed (record file)" },
    { cls: "now", label: "Consensus clock" },
    { cls: "stake", label: "Node size = stake" },
];

/** The colour key, behind a button so it doesn't take permanent space. */
export function Legend() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className="legend-wrap" ref={ref}>
            <button
                type="button"
                className={`btn${open ? " on" : ""}`}
                aria-expanded={open}
                aria-controls="legend"
                onClick={() => setOpen(o => !o)}>
                ◍ Legend
            </button>
            {open && (
                <div className="legend glass" id="legend" role="dialog" aria-label="Legend">
                    {KIND_LIST.map(k => (
                        <span className="lg" key={k.id}>
                            <i className="sw k" style={{ "--k": k.hex } as CSSProperties} />
                            {k.label}
                        </span>
                    ))}
                    {EXTRA.map(e => (
                        <span className="lg" key={e.cls}>
                            <i className={`sw ${e.cls}`} />
                            {e.label}
                        </span>
                    ))}
                    <p className="legend-src">
                        Data: Hedera public mirror node, polled every ~2.5 s.
                    </p>
                </div>
            )}
        </div>
    );
}
