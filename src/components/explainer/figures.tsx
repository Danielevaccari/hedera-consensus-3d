// Small illustrations for the "How it works" cards.

const GUIDE = "var(--line2)";
const MUTED = "var(--muted)";

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
            <circle cx="120" cy="65" r="48" stroke="var(--line2)" fill="none" />
            <path
                className="flow"
                d="M72 65 Q120 20 168 65"
                stroke="var(--cyan)"
                strokeWidth="2"
                fill="none"
            />
            <path
                className="flow"
                d="M96 107 Q120 70 144 23"
                stroke="var(--violet)"
                strokeWidth="2"
                fill="none"
            />
            <path
                className="flow"
                d="M144 107 Q100 80 96 23"
                stroke="var(--pink)"
                strokeWidth="2"
                fill="none"
            />
            <g>
                <circle cx="72" cy="65" r="8" fill="var(--cyan)" />
                <circle cx="168" cy="65" r="8" fill="var(--green)" />
                <circle cx="96" cy="23" r="8" fill="var(--pink)" />
                <circle cx="144" cy="23" r="8" fill="var(--violet)" />
                <circle cx="96" cy="107" r="8" fill="var(--violet)" />
                <circle cx="144" cy="107" r="8" fill="var(--orange)" />
            </g>
            <rect
                x="178"
                y="48"
                width="44"
                height="34"
                rx="6"
                fill="var(--panel-solid)"
                stroke="var(--green)"
            />
            <text x="200" y="62" fill="var(--green)" fontSize="8" textAnchor="middle">
                new
            </text>
            <text x="200" y="73" fill="var(--green)" fontSize="8" textAnchor="middle">
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
            <Columns y1={118} y2={12} stroke="var(--line2)" />
            <g stroke="var(--pink)" strokeWidth="1.6" opacity=".85">
                {links.map(([x1, y1, x2, y2]) => (
                    <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
                ))}
            </g>
            <g fill="var(--cyan)">
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
            color: "var(--cyan)",
            line: [108, 112, 104, 110],
            dots: [86, 90, 80, 88],
            label: ["R1", 206, 126],
        },
        {
            color: "var(--violet)",
            line: [58, 66, 52, 62],
            dots: [38, 42, 32, 40],
            label: ["R2", 207, 74],
        },
        { color: "var(--pink)", line: [14, 20, 12, 22], dots: null, label: ["R3", 207, 32] },
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
            <Columns y1={120} y2={10} stroke="var(--line2)" />
            <g stroke="var(--orange)" strokeWidth="2.2" fill="none">
                <path d="M93 108 L40 80 L40 50 L93 18" />
                <path d="M93 108 L93 18" />
                <path d="M93 108 L146 74 L146 46 L93 18" />
            </g>
            <path d="M93 108 L199 66 L146 46" stroke="var(--line2)" strokeWidth="1.3" fill="none" />
            <circle cx="93" cy="108" r="7" fill="var(--orange)" />
            <text x="104" y="112" fill="var(--orange)" fontSize="9">
                B
            </text>
            <circle cx="93" cy="18" r="7" fill="var(--cyan)" />
            <text x="104" y="16" fill="var(--cyan)" fontSize="9">
                A
            </text>
            <g fill="var(--orange)">
                <circle cx="40" cy="80" r="4" />
                <circle cx="40" cy="50" r="4" />
                <circle cx="146" cy="74" r="4" />
                <circle cx="146" cy="46" r="4" />
                <circle cx="93" cy="62" r="4" />
            </g>
            <circle cx="199" cy="66" r="4" fill="var(--dim)" />
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
            <g stroke="var(--violet)" className="flow" strokeWidth="1.2" opacity=".75">
                {xs.map(x => (
                    <line key={`a${x}`} x1={x} y1="64" x2="40" y2="108" />
                ))}
                {xs.slice(0, 3).map(x => (
                    <line key={`b${x}`} x1={x} y1="64" x2="146" y2="108" />
                ))}
            </g>
            <g stroke="var(--gold)" className="flow" strokeWidth="1.2" opacity=".75">
                {xs.map(x => (
                    <line key={x} x1="120" y1="20" x2={x} y2="64" />
                ))}
            </g>
            <g fill="var(--cyan)">
                {xs.map((x, i) => (
                    <circle key={x} cx={x} cy="108" r="7" opacity={i % 2 ? 0.9 : 1} />
                ))}
            </g>
            <circle cx="40" cy="108" r="12" fill="none" stroke="var(--gold)" strokeWidth="2" />
            <circle cx="146" cy="108" r="12" fill="none" stroke="var(--gold)" strokeWidth="2" />
            <g fill="var(--violet)">
                {xs.map(x => (
                    <circle key={x} cx={x} cy="64" r="6" />
                ))}
            </g>
            <circle cx="120" cy="20" r="7" fill="var(--pink)" />
            <text x="6" y="124" fill={MUTED} fontSize="7">
                round r
            </text>
            <text x="6" y="80" fill={MUTED} fontSize="7">
                r+1 votes
            </text>
            <text x="134" y="18" fill="var(--gold)" fontSize="7">
                r+2 tallies ≥ 2/3
            </text>
        </svg>
    );
}

export function TimestampFigure() {
    return (
        <svg viewBox="0 0 240 130" aria-hidden="true">
            <line x1="16" y1="76" x2="226" y2="76" stroke="var(--line2)" strokeWidth="2" />
            <g fill="var(--blue)">
                {[46, 78, 141, 160].map(x => (
                    <circle key={x} cx={x} cy="76" r="6" />
                ))}
            </g>
            <circle cx="112" cy="76" r="8" fill="var(--gold)" />
            <circle cx="112" cy="76" r="14" fill="none" stroke="var(--gold)" opacity=".5" />
            <circle cx="216" cy="76" r="6" fill="var(--red)" />
            <text x="112" y="50" fill="var(--gold)" fontSize="8.5" textAnchor="middle">
                median = consensus time
            </text>
            <line x1="112" y1="54" x2="112" y2="64" stroke="var(--gold)" />
            <text x="216" y="100" fill="var(--red)" fontSize="7.5" textAnchor="end">
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
        ["1 · round received", "var(--cyan)", "rgba(34,211,238,.14)"],
        ["2 · consensus timestamp", "var(--gold)", "rgba(253,224,71,.12)"],
        ["3 · whitened signature", "var(--violet)", "rgba(167,139,250,.14)"],
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
                stroke="var(--green)"
                strokeWidth="1.6"
            />
            <text
                x="200"
                y="56"
                fill="var(--green)"
                fontSize="9"
                textAnchor="middle"
                fontWeight="700">
                aBFT
            </text>
            <text x="200" y="69" fill="var(--green)" fontSize="7" textAnchor="middle">
                &lt; 1/3 faulty
            </text>
        </svg>
    );
}
