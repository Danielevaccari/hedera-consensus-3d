import { createContext, useContext } from "react";
import type { Engine } from "./Engine";
import type { UiSnapshot } from "./snapshot";

export interface EngineContextValue {
    engine: Engine;
    ui: UiSnapshot;
}

export const EngineContext = createContext<EngineContextValue | null>(null);

/** The running engine and its latest UI snapshot; only valid below <EngineProvider>. */
export function useEngine() {
    const ctx = useContext(EngineContext);
    if (!ctx) throw new Error("useEngine must be used inside the engine provider");
    return ctx;
}
