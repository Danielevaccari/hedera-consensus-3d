import { useEngine } from "../engine/EngineContext";
import { Panel } from "./Panel";
import { RichText } from "./RichText";

export function LogPanel({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
    const { ui } = useEngine();
    return (
        <Panel title="Network log" className="log" collapsed={collapsed} onToggle={onToggle}>
            <ul>
                {ui.log.map(e => (
                    <li key={e.id} className={e.kind}>
                        <span className="t">{e.time}</span>
                        <RichText text={e.text} />
                    </li>
                ))}
            </ul>
        </Panel>
    );
}
