// Pure parsing of mirror-node transactions.
import { FEE_ACCOUNTS, KINDS, type Kind } from "../config";
import type { MirrorTransaction } from "../api/types";
import type { Amounts } from "./types";

export function decodeMemo(b64: string | null): string {
    if (!b64) return "";
    try {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        return (
            new TextDecoder()
                .decode(bytes)
                // eslint-disable-next-line no-control-regex
                .replace(/[\u0000-\u001f\u007f]/g, " ")
                .trim()
                .slice(0, 90)
        );
    } catch {
        return "";
    }
}

export function kindOf(name: string): Kind {
    if (name === "CRYPTOTRANSFER") return KINDS.transfer;
    if (name.startsWith("CONSENSUS")) return KINDS.hcs;
    if (name === "ETHEREUMTRANSACTION" || name.startsWith("CONTRACT")) return KINDS.evm;
    if (name.startsWith("TOKEN")) return KINDS.token;
    return KINDS.other;
}

/** Receiver = biggest non-fee credit; sender = biggest debit (not always the fee payer). */
export function parseAmounts(t: MirrorTransaction): Amounts {
    const out: Amounts = { hbar: 0, hbarTo: null, hbarFrom: null, tok: null, nft: null };
    if (t.token_transfers?.length) {
        const tt = t.token_transfers.find(x => x.amount > 0) ?? t.token_transfers[0];
        out.tok = { id: tt.token_id, amt: Math.abs(tt.amount), to: tt.account };
    }
    if (t.nft_transfers?.length) {
        const nf = t.nft_transfers[0];
        out.nft = { id: nf.token_id, serial: nf.serial_number, to: nf.receiver_account_id };
    }
    let debit = 0;
    for (const x of t.transfers ?? []) {
        const hbar = x.amount / 1e8;
        if (
            x.amount > 0 &&
            !FEE_ACCOUNTS.has(x.account) &&
            x.account !== t.node &&
            hbar > out.hbar
        ) {
            out.hbar = hbar;
            out.hbarTo = x.account;
        }
        if (x.amount < debit) {
            debit = x.amount;
            out.hbarFrom = x.account;
        }
    }
    return out;
}
