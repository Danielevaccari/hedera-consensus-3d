import { useEffect, useMemo, type ReactNode } from "react";
import type { Engine } from "../engine/Engine";
import { EngineContext } from "../engine/EngineContext";
import { useStore } from "../hooks/useStore";

/** Subscribes to the engine's UI snapshot and shares it with the tree below. */
export function EngineProvider({ engine, children }: { engine: Engine; children: ReactNode }) {
    const ui = useStore(engine.ui);
    const value = useMemo(() => ({ engine, ui }), [engine, ui]);

    // page-wide style switches live on <body> so the CSS can restyle everything at once
    const { fx, present, motion } = ui.options;
    useEffect(() => {
        document.body.classList.toggle("fx", fx);
        document.body.classList.toggle("present", present);
        document.body.classList.toggle("reduce-motion", !motion);
    }, [fx, present, motion]);

    return <EngineContext.Provider value={value}>{children}</EngineContext.Provider>;
}
