import { useEffect, useRef, useState, type ReactNode } from "react";
import { EngineProvider } from "./components/EngineProvider";
import { Explainer } from "./components/explainer/Explainer";
import { Hud } from "./components/Hud";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { Tooltip } from "./components/Tooltip";
import { Engine } from "./engine/Engine";
import { useEngine } from "./engine/EngineContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function PresentNote() {
    const { ui } = useEngine();
    if (!ui.options.present) return null;
    return <div className="present-exit glass">Presentation mode · press P or Esc to exit</div>;
}

function LiveExplainer() {
    const { ui } = useEngine();
    return <Explainer stats={ui.stats} />;
}

export function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [engine, setEngine] = useState<Engine | null>(null);

    // the engine drives a WebGL canvas, so it can only start once the canvas is in the DOM
    useEffect(() => {
        const e = new Engine(canvasRef.current!, viewportRef.current!);
        setEngine(e);
        return () => e.dispose();
    }, []);

    useKeyboardShortcuts(engine);

    const withEngine = (node: ReactNode) =>
        engine && <EngineProvider engine={engine}>{node}</EngineProvider>;

    return (
        <>
            <section className="stage">
                <div className="viewport" ref={viewportRef}>
                    <canvas
                        ref={canvasRef}
                        aria-label="3D view of live Hedera mainnet transactions"
                    />
                    {withEngine(
                        <>
                            <Tooltip />
                            <PresentNote />
                            <LoadingOverlay />
                        </>,
                    )}
                </div>
                {withEngine(<Hud />)}
            </section>
            {withEngine(<LiveExplainer />)}
            <footer>
                Hedera mainnet consensus visualizer · data from the Hedera public mirror node ·
                built with three.js and React
            </footer>
        </>
    );
}
