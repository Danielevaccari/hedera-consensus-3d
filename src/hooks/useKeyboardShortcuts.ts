import { useEffect } from "react";
import type { Engine } from "../engine/Engine";

/** Space = pause, P = presentation mode, Esc = leave presentation mode. */
export function useKeyboardShortcuts(engine: Engine | null) {
    useEffect(() => {
        if (!engine) return;
        const onKey = (e: KeyboardEvent) => {
            // don't steal keys from buttons, inputs or links
            if (e.target !== document.body) return;
            if (e.code === "Space") {
                e.preventDefault();
                engine.togglePause();
            } else if (e.code === "KeyP" && !e.ctrlKey && !e.metaKey && !e.altKey) {
                engine.setPresent(!engine.options.present);
            } else if (e.code === "Escape") {
                engine.setPresent(false);
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [engine]);
}
