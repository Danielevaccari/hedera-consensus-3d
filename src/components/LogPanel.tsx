import { useEngine } from "../engine/EngineContext";
import { RichText } from "./RichText";

/** What the app is doing: connections, sealed blocks, whale transfers, tracking. */
export function LogPanel() {
    const { ui } = useEngine();
    return (
        <ul className="log">
            {ui.log.map(e => (
                <li key={e.id} className={e.kind}>
                    <span className="t">{e.time}</span>
                    <RichText text={e.text} />
                </li>
            ))}
        </ul>
    );
}
