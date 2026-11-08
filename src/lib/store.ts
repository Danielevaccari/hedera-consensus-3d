// A minimal observable value, read from React with useSyncExternalStore (see hooks/useStore).

export class Store<T> {
    private listeners = new Set<() => void>();

    constructor(private value: T) {}

    get = () => this.value;

    set(value: T) {
        if (Object.is(value, this.value)) return;
        this.value = value;
        for (const l of this.listeners) l();
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
}
