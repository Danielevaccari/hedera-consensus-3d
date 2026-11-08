import { useEffect, useRef } from "react";
import { drawMix, drawNodes, drawRate } from "../charts/draw";
import { useEngine } from "../engine/EngineContext";
import type { ChartData } from "../engine/snapshot";
import { trunc } from "../lib/format";

function summaries(d: ChartData) {
    if (!d.total) return { rate: "—", mix: "no transactions", node: "—" };
    const top = d.mix.reduce((a, b) => (b.count > a.count ? b : a));
    const best = d.perNode.reduce((a, b) => (b.count > a.count ? b : a));
    const peak = Math.max(0.5, ...d.rate);
    const share = Math.round((top.count / d.total) * 100);
    return {
        rate: `${d.avgRate.toFixed(2)} avg · peak ${peak.toFixed(1)}`,
        mix: `${top.kind.key.toLowerCase()} ${share}%`,
        node: `top ${best.node.acct} ${trunc(best.node.host, 12)} · ${best.count}`,
    };
}

/** Three small live charts over the 2-minute window; only shown when switched on. */
export function ChartsStrip() {
    const { ui } = useEngine();
    const rate = useRef<HTMLCanvasElement>(null);
    const mix = useRef<HTMLCanvasElement>(null);
    const nodes = useRef<HTMLCanvasElement>(null);
    const data = ui.charts;
    const fx = ui.options.fx;
    const light = ui.options.theme === "light";

    useEffect(() => {
        if (!data) return;
        if (rate.current) drawRate(rate.current, data, fx, light);
        if (mix.current) drawMix(mix.current, data, fx, light);
        if (nodes.current) drawNodes(nodes.current, data, fx, light);
    }, [data, fx, light]);

    if (!data) return null;
    const s = summaries(data);
    return (
        <div className="charts glass">
            <div className="chart">
                <small>
                    tx / s · 2 min <b>{s.rate}</b>
                </small>
                <canvas ref={rate} />
            </div>
            <div className="chart">
                <small>
                    type mix <b>{s.mix}</b>
                </small>
                <canvas ref={mix} />
            </div>
            <div className="chart">
                <small>
                    tx per node <b>{s.node}</b>
                </small>
                <canvas ref={nodes} />
            </div>
        </div>
    );
}
