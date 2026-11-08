import { useSyncExternalStore } from "react";

/** Live result of a CSS media query (e.g. "(max-width: 900px)"). */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        notify => {
            const mq = matchMedia(query);
            mq.addEventListener("change", notify);
            return () => mq.removeEventListener("change", notify);
        },
        () => matchMedia(query).matches,
    );
}
