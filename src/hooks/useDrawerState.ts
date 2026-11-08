import { useCallback, useState } from "react";
import { STORAGE_KEYS } from "../config";
import { readStorage, writeStorage } from "../lib/storage";
import { useMediaQuery } from "./useMediaQuery";

export type DrawerTab = "journey" | "ledger" | "log";

/** Screens at or below this width stack the drawer under the 3D view instead of beside it. */
export const NARROW_QUERY = "(max-width: 900px)";

/**
 * Side drawer state. Beside the view on wide screens (open or closed, remembered); on narrow
 * screens it always sits below the view, so "open" is implied.
 */
export function useDrawerState() {
    const narrow = useMediaQuery(NARROW_QUERY);
    const [openPref, setOpenPref] = useState(() => readStorage(STORAGE_KEYS.drawer) !== "closed");
    const [tab, setTab] = useState<DrawerTab>("ledger");
    const setOpen = useCallback((open: boolean) => {
        setOpenPref(open);
        writeStorage(STORAGE_KEYS.drawer, open ? "open" : "closed");
    }, []);
    return { narrow, open: narrow || openPref, setOpen, tab, setTab };
}

export type DrawerState = ReturnType<typeof useDrawerState>;
