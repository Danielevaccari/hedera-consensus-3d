// The subset of the Hedera Mirror Node REST API responses this app reads.
// https://docs.hedera.com/hedera/sdks-and-apis/rest-api

export interface Links {
    next: string | null;
}

export interface MirrorNode {
    node_id: number;
    node_account_id: string;
    description: string | null;
    stake: number | null;
}
export interface NodesPage {
    nodes: MirrorNode[];
    links?: Links;
}

export interface MirrorTransfer {
    account: string;
    amount: number;
}
export interface MirrorTokenTransfer extends MirrorTransfer {
    token_id: string;
}
export interface MirrorNftTransfer {
    token_id: string;
    serial_number: number;
    receiver_account_id: string;
}

export interface MirrorTransaction {
    consensus_timestamp: string;
    valid_start_timestamp: string;
    transaction_id: string;
    name: string;
    node: string;
    entity_id: string | null;
    result: string;
    charged_tx_fee: number;
    memo_base64: string | null;
    transfers?: MirrorTransfer[];
    token_transfers?: MirrorTokenTransfer[];
    nft_transfers?: MirrorNftTransfer[];
}
export interface TransactionsPage {
    transactions: MirrorTransaction[];
    links?: Links;
}

export interface MirrorBlock {
    number: number;
    count: number;
    name: string;
    timestamp: { from: string; to: string | null };
}
export interface BlocksPage {
    blocks: MirrorBlock[];
    links?: Links;
}

export interface ExchangeRate {
    current_rate?: { cent_equivalent: number; hbar_equivalent: number };
}

export interface MirrorToken {
    symbol?: string;
    name?: string;
    decimals?: string | number;
}
