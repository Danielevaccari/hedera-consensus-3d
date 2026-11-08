import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface PopoverProps {
    /** content of the button that opens it */
    label: ReactNode;
    title?: string;
    /** which way it opens relative to the button */
    placement?: "up" | "down";
    align?: "left" | "right";
    className?: string;
    children: ReactNode;
}

/** A button with a floating panel that closes on outside click or Escape. */
export function Popover({
    label,
    title,
    placement = "up",
    align = "left",
    className = "btn",
    children,
}: PopoverProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const id = useId();
    // horizontal nudge that keeps the panel on screen (narrow screens, buttons near an edge)
    const [shift, setShift] = useState(0);

    useLayoutEffect(() => {
        if (!open || !panel.current) return;
        const MARGIN = 8;
        const r = panel.current.getBoundingClientRect();
        const base = r.left - shift;
        const right = r.right - shift;
        let dx = 0;
        if (right > innerWidth - MARGIN) dx = innerWidth - MARGIN - right;
        if (base + dx < MARGIN) dx = MARGIN - base;
        setShift(dx);
        // only re-measure when it opens
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

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
        <div className="popover-wrap" ref={ref}>
            <button
                type="button"
                className={`${className}${open ? " open" : ""}`}
                title={title}
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen(o => !o)}>
                {label}
            </button>
            {open && (
                <div
                    id={id}
                    ref={panel}
                    className={`popover glass ${placement} ${align}`}
                    style={shift ? { transform: `translateX(${shift}px)` } : undefined}
                    role="dialog">
                    {children}
                </div>
            )}
        </div>
    );
}
