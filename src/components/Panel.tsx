import type { ReactNode } from "react";

interface PanelProps {
    title: string;
    className: string;
    collapsed: boolean;
    onToggle: () => void;
    /** status dot in the header: true = ok, false = error */
    status?: boolean;
    children: ReactNode;
}

/** A glass card with a clickable header that collapses its body. */
export function Panel({ title, className, collapsed, onToggle, status, children }: PanelProps) {
    return (
        <section className={`card glass ${className}${collapsed ? " collapsed" : ""}`}>
            <h2>
                <button
                    type="button"
                    className="card-toggle"
                    aria-expanded={!collapsed}
                    onClick={onToggle}>
                    {status !== undefined && <span className={`dot${status ? "" : " bad"}`} />}
                    <span className="card-title">{title}</span>
                    <span className="chev" aria-hidden="true">
                        ▾
                    </span>
                </button>
            </h2>
            {!collapsed && <div className="card-body">{children}</div>}
        </section>
    );
}
