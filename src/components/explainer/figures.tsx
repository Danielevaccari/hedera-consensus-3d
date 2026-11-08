// Small illustrations for the "How it works" cards.

const GUIDE = "rgba(130,165,255,.3)";
const MUTED = "#8e9bbd";

/** Vertical node lines at the standard x positions. */
function Columns({ y1, y2, stroke = GUIDE }: { y1: number; y2: number; stroke?: string }) {
    return (
        <g stroke={stroke} strokeWidth="2">
            {[40, 93, 146, 199].map(x => (
                <line key={x} x1={x} y1={y1} x2={x} y2={y2} />
            ))}
        </g>
    );
}

export function GossipFigure() {
    return (
        <svg viewBox="0 0 240 130" aria-hidden="true">
            <circle cx="120" cy="65" r="48" stroke="rgba(130,165,255,.18)" fill="none" />
            <path
                className="flow"
                d="M72 65 Q120 20 168 65"
                stroke="#22d3ee"
                strokeWidth="2"
                fill="none"
            />
            <path
                className="flow"
                d="M96 107 Q120 70 144 23"
                stroke="#a78bfa"
                strokeWidth="2"
                fill="none"
            />
            <path
                className="flow"
                d="M144 107 Q100 80 96 23"
                stroke="#f472b6"
                strokeWidth="2"
                fill="none"
            />
            <g>
                <circle cx="72" cy="65" r="8" fill="#22d3ee" />
                <circle cx="168" cy="65" r="8" fill="#4ade80" />
                <circle cx="96" cy="23" r="8" fill="#f472b6" />
                <circle cx="144" cy="23" r="8" fill="#a78bfa" />
                <circle cx="96" cy="107" r="8" fill="#a78bfa" />
                <circle cx="144" cy="107" r="8" fill="#fb923c" />
            </g>
            <rect x="178" y="48" width="44" height="34" rx="6" fill="#0b1224" stroke="#4ade80" />
            <text x="200" y="62" fill="#4ade80" fontSize="8" textAnchor="middle">
                new
            </text>
            <text x="200" y="73" fill="#4ade80" fontSize="8" textAnchor="middle">
                event
            </text>
        </svg>
    );
}

export function EventAnatomy() {
    const rows = [
        ["timestamp", "14:03:22.481"],
        ["transactions", "[ 3 tx ]"],
        ["self-parent hash", "9f3a…c1e0"],
        ["other-parent hash", "04bd…77a2"],
        ["signature", "ed25519 ✓"],
    ];
    return (
        <div className="anatomy">
            <div className="h">EVENT #4182 · NODE 0.0.17</div>
            {rows.map(([k, v]) => (
                <div key={k}>
                    <span>{k}</span>
                    <span>{v}</span>
                </div>
            ))}
        </div>
    );
}

export function HashgraphFigure() {
    const links = [
        [93, 92, 40, 112],
        [146, 78, 93, 92],
        [40, 70, 146, 78],
        [199, 60, 146, 78],
        [93, 48, 199, 60],
        [146, 34, 40, 70],
        [40, 22, 93, 48],
        [199, 18, 146, 34],
    ];
    // prettier-ignore
    const events = [
        [40, 112], [93, 112], [146, 112], [199, 112], [93, 92], [146, 78],
        [40, 70], [199, 60], [93, 48], [146, 34], [40, 22], [199, 18],
    ];
    return (
        <svg viewBox="0 0 240 130" aria-hidden="true">
            <Columns y1={118} y2={12} stroke="rgba(130,165,255,.35)" />
            <g stroke="#f472b6" strokeWidth="1.6" opacity=".85">
                {links.map(([x1, y1, x2, y2]) => (
                    <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
                ))}
            </g>
            <g fill="#22d3ee">
                {events.map(([cx, cy]) => (
                    <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="5" />
                ))}
            </g>
            <text x="8" y="126" fill={MUTED} fontSize="7">
                older
            </text>
            <text x="8" y="10" fill={MUTED} fontSize="7">
                newer
            </text>
        </svg>
    );
}

export function RoundsFigure() {
    const rounds = [
        {
            color: "#22d3ee",
            line: [108, 112, 104, 110],
            dots: [86, 90, 80, 88],
            label: ["R1", 206, 126],
        },
        {
            color: "#a78bfa",
            line: [58, 66, 52, 62],
            dots: [38, 42, 32, 40],
            label: ["R2", 207, 74],
        },
        { color: "#f472b6", line: [14, 20, 12, 22], dots: null, label: ["R3", 207, 32] },
    ] as const;
    const xs = [40, 93, 146, 199];
    return (
        <svg viewBox="0 0 240 130" aria-hidden="true">
            <Columns y1={122} y2={8} />
            {rounds.map(r => (
                <g key={r.color}>
                    <polyline
                        points={xs.map((x, i) => `${x},${r.line[i]}`).join(" ")}
                        fill="none"
                        stroke={r.color}
                        strokeDasharray="3 3"
                    />
                    {r.dots && (
                        <g fill={r.color} opacity=".5">
                            {xs.map((x, i) => (
                                <circle key={x} cx={x} cy={r.dots[i]} r="3.5" />
                            ))}
                        </g>
                    )}
                    {/* witnesses: the first event of each node in the round */}
                    {xs.map((x, i) => (
                        <rect
                            key={x}
                            x={x - 5}
                            y={r.line[i] - 5}
                            width="10"
                            height="10"
                            transform={`rotate(45 ${x} ${r.line[i]})`}
                            fill={r.color}
                        />
                    ))}
                    <text x={r.label[1]} y={r.label[2]} fill={r.color} fontSize="7">
                        {r.label[0]}
                    </text>
                </g>
            ))}
        </svg>
    );
}

export function StronglySeeFigure() {
    return (
        <svg viewBox="0 0 240 130" aria-hidden="true">
            <Columns y1={120} y2={10} stroke="rgba(130,165,255,.25)" />
            <g stroke="#fb923c" strokeWidth="2.2" fill="none">
                <path d="M93 108 L40 80 L40 50 L93 18" />
                <path d="M93 108 L93 18" />
                <path d="M93 108 L146 74 L146 46 L93 18" />
            </g>
            <path
                d="M93 108 L199 66 L146 46"
                stroke="rgba(130,165,255,.35)"
                strokeWidth="1.3"
                fill="none"
            />
            <circle cx="93" cy="108" r="7" fill="#fb923c" />
            <text x="104" y="112" fill="#fb923c" fontSize="9">
                B
            </text>
            <circle cx="93" cy="18" r="7" fill="#22d3ee" />
            <text x="104" y="16" fill="#22d3ee" fontSize="9">
                A
            </text>
            <g fill="#fb923c">
                <circle cx="40" cy="80" r="4" />
                <circle cx="40" cy="50" r="4" />
                <circle cx="146" cy="74" r="4" />
                <circle cx="146" cy="46" r="4" />
                <circle cx="93" cy="62" r="4" />
            </g>
            <circle cx="199" cy="66" r="4" fill="#5d6888" />
            <text x="150" y="124" fill={MUTED} fontSize="7.5">
                paths via 3 of 4 nodes
            </text>
        </svg>
    );
}

export function VotingFigure() {
    const xs = [40, 93, 146, 199];
    return (
        <svg viewBox="0 0 240 130" aria-hidden="true">
            <g stroke="#a78bfa" className="flow" strokeWidth="1.2" opacity=".75">
                {xs.map(x => (
                    <line key={`a${x}`} x1={x} y1="64" x2="40" y2="108" />
                ))}
                {xs.slice(0, 3).map(x => (
                    <line key={`b${x}`} x1={x} y1="64" x2="146" y2="108" />
                ))}
            </g>
            <g stroke="#fde047" className="flow" strokeWidth="1.2" opacity=".75">
                {xs.map(x => (
                    <line key={x} x1="120" y1="20" x2={x} y2="64" />
                ))}
            </g>
            <g fill="#22d3ee">
                {xs.map((x, i) => (
                    <circle key={x} cx={x} cy="108" r="7" opacity={i % 2 ? 0.9 : 1} />
                ))}
            </g>
            <circle cx="40" cy="108" r="12" fill="none" stroke="#fde047" strokeWidth="2" />
            <circle cx="146" cy="108" r="12" fill="none" stroke="#fde047" strokeWidth="2" />
            <g fill="#a78bfa">
                {xs.map(x => (
                    <circle key={x} cx={x} cy="64" r="6" />
                ))}
            </g>
            <circle cx="120" cy="20" r="7" fill="#f472b6" />
            <text x="6" y="124" fill={MUTED} fontSize="7">
                round r
            </text>
            <text x="6" y="80" fill={MUTED} fontSize="7">
                r+1 votes
            </text>
            <text x="134" y="18" fill="#fde047" fontSize="7">
                r+2 tallies ≥ 2/3
            </text>
        </svg>
    );
}

export function TimestampFigure() {
    return (
        <svg viewBox="0 0 240 130" aria-hidden="true">
            <line x1="16" y1="76" x2="226" y2="76" stroke="rgba(130,165,255,.35)" strokeWidth="2" />
            <g fill="#60a5fa">
                {[46, 78, 141, 160].map(x => (
                    <circle key={x} cx={x} cy="76" r="6" />
                ))}
            </g>
            <circle cx="112" cy="76" r="8" fill="#fde047" />
            <circle cx="112" cy="76" r="14" fill="none" stroke="#fde047" opacity=".5" />
            <circle cx="216" cy="76" r="6" fill="#f87171" />
            <text x="112" y="50" fill="#fde047" fontSize="8.5" textAnchor="middle">
                median = consensus time
            </text>
            <line x1="112" y1="54" x2="112" y2="64" stroke="#fde047" />
            <text x="216" y="100" fill="#f87171" fontSize="7.5" textAnchor="end">
                lying clock can&apos;t move it
            </text>
            <text x="16" y="112" fill={MUTED} fontSize="7.5">
                when each famous witness&apos;s node first received the event
            </text>
        </svg>
    );
}

export function OrderFigure() {
    const steps = [
        ["1 · round received", "#22d3ee", "rgba(34,211,238,.14)"],
        ["2 · consensus timestamp", "#fde047", "rgba(253,224,71,.12)"],
        ["3 · whitened signature", "#a78bfa", "rgba(167,139,250,.14)"],
    ];
    return (
        <svg viewBox="0 0 240 130" aria-hidden="true">
            <g fontSize="8">
                {steps.map(([label, stroke, fill], i) => (
                    <g key={label}>
                        <rect
                            x="16"
                            y={14 + i * 28}
                            width="150"
                            height="20"
                            rx="5"
                            fill={fill}
                            stroke={stroke}
                        />
                        <text x="24" y={27 + i * 28} fill={stroke}>
                            {label}
                        </text>
                    </g>
                ))}
                <text x="16" y="114" fill={MUTED}>
                    = one identical order on every node
                </text>
            </g>
            <path
                d="M200 18 L224 28 L224 58 Q224 86 200 100 Q176 86 176 58 L176 28 Z"
                fill="rgba(74,222,128,.12)"
                stroke="#4ade80"
                strokeWidth="1.6"
            />
            <text x="200" y="56" fill="#4ade80" fontSize="9" textAnchor="middle" fontWeight="700">
                aBFT
            </text>
            <text x="200" y="69" fill="#4ade80" fontSize="7" textAnchor="middle">
                &lt; 1/3 faulty
            </text>
        </svg>
    );
}
