// Pure formatting helpers. Mirror node timestamps are "seconds.nanoseconds" strings.

export const pad = (v: number, l = 2) => String(v).padStart(l, "0");
export const fmtInt = (v: number) => Number(v).toLocaleString("en-US");
export const trunc = (s: string, l: number) => (s.length > l ? s.slice(0, l - 1) + "…" : s);

/** "1712345678.123456789" -> [1712345678, "123456789"] */
export function splitTs(s: string): [number, string] {
    const [a, b = ""] = String(s).split(".");
    return [+a, b.padEnd(9, "0").slice(0, 9)];
}

export function clockOf(sec: number) {
    const d = new Date(sec * 1000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function fmtTs(s: string) {
    const [a, ns] = splitTs(s);
    return `${clockOf(a)}.${ns.slice(0, 3)}`;
}

export function fmtTsNs(s: string) {
    const [a, ns] = splitTs(s);
    return `${clockOf(a)}.${ns}`;
}

export function fmtHbar(v: number) {
    if (v >= 1) return `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} ℏ`;
    return `${v.toFixed(8).replace(/\.?0+$/, "") || "0"} ℏ`;
}

export function fmtStake(v: number) {
    if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B ℏ`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M ℏ`;
    return `${fmtInt(Math.round(v))} ℏ`;
}

export function fmtUsd(v: number) {
    return v >= 1000 ? `$${Math.round(v).toLocaleString("en-US")}` : `$${v.toFixed(2)}`;
}

/** evenly spaced hues around the ring */
export const nodeHue = (i: number, n: number) => Math.round((i / n) * 360);
