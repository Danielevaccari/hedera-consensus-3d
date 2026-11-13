// Which Hedera network the page shows. Both public mirror nodes serve the same REST API, so a
// network is just a host plus a few labels. It is chosen by the URL alone (?network=testnet) and
// mainnet is the default, so a plain visit always opens mainnet. Switching reloads the page.

export type NetworkId = "mainnet" | "testnet";

export interface Network {
    id: NetworkId;
    /** lower-case name used in the interface text */
    label: string;
    mirrorHost: string;
    /** transaction page on HashScan; append the consensus timestamp */
    hashscanTx: string;
    /** HBAR has a market price here. Testnet HBAR is worthless, so no USD values or whale alerts. */
    priced: boolean;
}

export const NETWORKS: Record<NetworkId, Network> = {
    mainnet: {
        id: "mainnet",
        label: "mainnet",
        mirrorHost: "https://mainnet-public.mirrornode.hedera.com",
        hashscanTx: "https://hashscan.io/mainnet/transaction/",
        priced: true,
    },
    testnet: {
        id: "testnet",
        label: "testnet",
        mirrorHost: "https://testnet.mirrornode.hedera.com",
        hashscanTx: "https://hashscan.io/testnet/transaction/",
        priced: false,
    },
};

export function networkFromUrl(search = location.search): Network {
    return new URLSearchParams(search).get("network") === "testnet"
        ? NETWORKS.testnet
        : NETWORKS.mainnet;
}

/** The current page's URL with another network selected (mainnet is the absence of the parameter). */
export function hrefForNetwork(id: NetworkId): string {
    const url = new URL(location.href);
    if (id === "mainnet") url.searchParams.delete("network");
    else url.searchParams.set("network", id);
    return url.toString();
}
