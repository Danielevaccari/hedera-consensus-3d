import { useEngine } from "../engine/EngineContext";
import { hrefForNetwork, NETWORKS, type NetworkId } from "../network";

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

/**
 * Chooses the Hedera network, next to the live badge. A different network is a different feed, so
 * picking one reloads the page with it selected (see network.ts).
 */
export function NetworkSwitch() {
    const { ui } = useEngine();
    return (
        <select
            className="net-select"
            aria-label="Network"
            title="Switch between the Hedera mainnet and testnet"
            value={ui.options.network.id}
            onChange={e => location.assign(hrefForNetwork(e.target.value as NetworkId))}>
            {(Object.keys(NETWORKS) as NetworkId[]).map(id => (
                <option key={id} value={id}>
                    {capitalize(NETWORKS[id].label)}
                </option>
            ))}
        </select>
    );
}
