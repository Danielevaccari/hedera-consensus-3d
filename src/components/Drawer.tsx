import { useEffect } from "react";
import { useEngine } from "../engine/EngineContext";
import type { DrawerState, DrawerTab } from "../hooks/useDrawerState";
import { useStore } from "../hooks/useStore";
import { LedgerPanel } from "./LedgerPanel";
import { LogPanel } from "./LogPanel";
import { TrackerPanel } from "./TrackerPanel";

const TABS: { id: DrawerTab; label: string }[] = [
    { id: "ledger", label: "Ledger" },
    { id: "journey", label: "Journey" },
    { id: "log", label: "Log" },
];

/**
 * One panel for everything that isn't the 3D view. Beside it on wide screens (closable), below it
 * on narrow ones.
 */
export function Drawer({ drawer }: { drawer: DrawerState }) {
    const { engine, ui } = useEngine();
    const { tab, setTab, setOpen } = drawer;
    const focus = useStore(engine.focus);

    // following a transaction (click in the view or the ledger) reveals its journey
    useEffect(() => {
        if (!focus) return;
        setTab("journey");
        setOpen(true);
    }, [focus, setTab, setOpen]);

    if (ui.options.present || !drawer.open) return null;
    return (
        <aside className="drawer" id="drawer" aria-label="Details">
            <div className="tabs" role="tablist">
                {TABS.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        role="tab"
                        id={`tab-${t.id}`}
                        aria-selected={tab === t.id}
                        aria-controls="tabpanel"
                        className={tab === t.id ? "on" : undefined}
                        onClick={() => setTab(t.id)}>
                        {t.label}
                        {t.id === "journey" && ui.tracker && <i className="tab-dot" />}
                    </button>
                ))}
                {!drawer.narrow && (
                    <button
                        type="button"
                        className="drawer-close"
                        aria-label="Hide details"
                        title="Hide details"
                        onClick={() => setOpen(false)}>
                        ×
                    </button>
                )}
            </div>
            <div className="tab-body" id="tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
                {tab === "ledger" && <LedgerPanel />}
                {tab === "journey" && <TrackerPanel />}
                {tab === "log" && <LogPanel />}
            </div>
        </aside>
    );
}
