import { useCallback, useState } from "react";
import { readStorage, writeStorage } from "../lib/storage";

type Flags = Record<string, boolean>;

function load(key: string): Flags {
    try {
        return JSON.parse(readStorage(key) ?? "{}") as Flags;
    } catch {
        return {};
    }
}

/** A set of named on/off flags remembered in this browser (e.g. which panels are collapsed). */
export function usePersistentFlags(key: string) {
    const [flags, setFlags] = useState<Flags>(() => load(key));
    const toggle = useCallback(
        (name: string) =>
            setFlags(prev => {
                const next = { ...prev, [name]: !prev[name] };
                writeStorage(key, JSON.stringify(next));
                return next;
            }),
        [key],
    );
    return [flags, toggle] as const;
}
