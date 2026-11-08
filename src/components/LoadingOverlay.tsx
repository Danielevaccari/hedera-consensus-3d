import { useEngine } from "../engine/EngineContext";

export function LoadingOverlay() {
    const { engine, ui } = useEngine();
    return (
        <div className={`loading${ui.phase === "live" ? " gone" : ""}`}>
            {ui.phase === "error" ? (
                <div className="err">
                    <b>Could not load data from the Hedera mirror node.</b>
                    <br />
                    {ui.error}
                    <br />
                    This page only shows real mainnet data, so there is nothing to display until the
                    mirror node answers.
                    <br />
                    <button
                        type="button"
                        className="btn primary"
                        onClick={() => void engine.start()}>
                        Retry
                    </button>
                </div>
            ) : (
                <div>
                    <div className="spin" />
                    Connecting to Hedera mainnet…
                </div>
            )}
        </div>
    );
}
