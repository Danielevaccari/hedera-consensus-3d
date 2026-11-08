// 2D canvas charts for the live strip. Each function clears and redraws its canvas.
import type { ChartData } from "../engine/snapshot";

const FONT = '600 10px "JetBrains Mono", Consolas, monospace';
const cyan = (light: boolean) => (light ? "#0891b2" : "#22d3ee");

/** Matches the canvas buffer to its CSS size and device pixel ratio. */
function prepare(cv: HTMLCanvasElement): [CanvasRenderingContext2D, number, number] {
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
    }
    const ctx = cv.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    return [ctx, r.width, r.height];
}

/** Area chart of tx/s, oldest on the left. Returns the peak. */
export function drawRate(cv: HTMLCanvasElement, data: ChartData, fx: boolean, light: boolean) {
    const CYAN = cyan(light);
    const [ctx, w, h] = prepare(cv);
    const vals = data.rate;
    const mx = Math.max(0.5, ...vals);
    const pts = vals.map(
        (v, i) => [(i / Math.max(1, vals.length - 1)) * w, h - 2 - (v / mx) * (h - 8)] as const,
    );
    const path = () => {
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    };
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const rgb = light ? "8,145,178" : "34,211,238";
    g.addColorStop(0, `rgba(${rgb},${fx ? 0.45 : 0.28})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    path();
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    path();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    if (fx) {
        ctx.shadowColor = CYAN;
        ctx.shadowBlur = 8;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    return mx;
}

/** Transaction type mix as one stacked bar. */
export function drawMix(cv: HTMLCanvasElement, data: ChartData, fx: boolean, light: boolean) {
    const [ctx, w, h] = prepare(cv);
    ctx.font = FONT;
    ctx.textBaseline = "middle";
    let x = 0;
    for (const { kind, count } of data.mix) {
        if (!count) continue;
        const bw = (count / data.total) * w;
        ctx.fillStyle = light ? kind.hexLight : kind.hex;
        if (fx) {
            ctx.shadowColor = kind.hex;
            ctx.shadowBlur = 8;
        }
        ctx.fillRect(x, h * 0.22, Math.max(1, bw - 2), h * 0.56);
        ctx.shadowBlur = 0;
        if (bw > 36) {
            ctx.fillStyle = light ? "#ffffff" : "#071019";
            ctx.fillText(`${Math.round((count / data.total) * 100)}%`, x + 5, h * 0.5);
        }
        x += bw;
    }
}

/** Transactions per node, in ring order and node colours. */
export function drawNodes(cv: HTMLCanvasElement, data: ChartData, fx: boolean, light: boolean) {
    const [ctx, w, h] = prepare(cv);
    const n = data.perNode.length;
    const bw = w / Math.max(1, n);
    const mx = Math.max(1, ...data.perNode.map(p => p.count));
    data.perNode.forEach(({ node, count }, i) => {
        const bh = (count / mx) * (h - 3);
        ctx.fillStyle = fx ? node.hexFx : light ? node.hexLight : node.hex;
        if (fx) {
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 6;
        }
        ctx.fillRect(i * bw + 1, h - Math.max(1, bh), Math.max(1, bw - 2), Math.max(1, bh));
    });
    ctx.shadowBlur = 0;
}
