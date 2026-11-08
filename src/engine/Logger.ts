import { LOG_ROWS } from "../config";
import type { LogEntry, LogKind } from "./types";

/** The "network log" panel: newest first, capped. Text may contain **bold** segments. */
export class Logger {
    entries: LogEntry[] = [];
    private seq = 0;

    constructor(private clock: () => string) {}

    log(kind: LogKind, text: string) {
        const entry = { id: ++this.seq, kind, time: this.clock(), text };
        this.entries = [entry, ...this.entries].slice(0, LOG_ROWS);
    }
}
