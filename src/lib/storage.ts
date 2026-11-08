// localStorage can be blocked (private mode, disabled site data): never let that break the page.

export function readStorage(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export function writeStorage(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* not remembered, the setting still applies for this visit */
    }
}
