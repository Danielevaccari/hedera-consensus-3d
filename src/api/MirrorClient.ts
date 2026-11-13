import { MIN_GAP_MS } from "../config";

export class AbortedError extends Error {
    constructor() {
        super("aborted");
    }
}

/**
 * Rate-limited client for the public mirror node.
 *
 * The mirror node rate-limits per IP (HTTP 429 after a few requests within a second), so every
 * request takes the next free slot at least MIN_GAP_MS after the previous one, and a throttled
 * request waits and retries before giving up.
 */
export class MirrorClient {
    private nextSlot = 0;
    private controller = new AbortController();

    constructor(private host: string) {}

    /** Cancels in-flight requests and waits; they reject with AbortedError. */
    abort() {
        this.controller.abort();
    }

    async get<T>(path: string, retries = 4): Promise<T> {
        // `links.next` from the API already starts with /api/v1
        const url = this.host + (path.startsWith("/api/v1") ? path : `/api/v1${path}`);
        const signal = this.controller.signal;
        for (let attempt = 0; ; attempt++) {
            const now = performance.now();
            const wait = this.nextSlot - now;
            this.nextSlot = Math.max(now, this.nextSlot) + MIN_GAP_MS;
            if (wait > 0) await this.sleep(wait);

            let r: Response;
            try {
                r = await fetch(url, { headers: { Accept: "application/json" }, signal });
            } catch (err) {
                if (signal.aborted) throw new AbortedError();
                throw err;
            }
            if (r.ok) return (await r.json()) as T;

            const route = path.split("?")[0];
            if ((r.status === 429 || r.status >= 500) && attempt < retries) {
                const after = Number(r.headers.get("retry-after"));
                const backoff = after > 0 ? after * 1000 : 1500 * 2 ** attempt;
                console.warn(`mirror node HTTP ${r.status}, retrying in ${backoff} ms:`, route);
                this.nextSlot = Math.max(this.nextSlot, performance.now() + backoff);
                continue;
            }
            throw new Error(`mirror node answered HTTP ${r.status} for ${route}`);
        }
    }

    private sleep(ms: number) {
        const signal = this.controller.signal;
        return new Promise<void>((resolve, reject) => {
            if (signal.aborted) return reject(new AbortedError());
            const t = setTimeout(resolve, ms);
            signal.addEventListener(
                "abort",
                () => {
                    clearTimeout(t);
                    reject(new AbortedError());
                },
                { once: true },
            );
        });
    }
}
