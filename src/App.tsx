import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrivalCount } from "./components/ArrivalCount";
import { ChartsStrip } from "./components/ChartsStrip";
import { ControlBar } from "./components/ControlBar";
import { Drawer } from "./components/Drawer";
import { EngineProvider } from "./components/EngineProvider";
import { Explainer } from "./components/explainer/Explainer";
import { LoadingOverlay } from "./components/LoadingOverlay";
import { Tooltip } from "./components/Tooltip";
import { TopBar } from "./components/TopBar";
import { Engine } from "./engine/Engine";
import { useEngine } from "./engine/EngineContext";
import { networkFromUrl } from "./network";
import { useDrawerState, type DrawerState } from "./hooks/useDrawerState";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

function PresentNote() {
    const { ui } = useEngine();
    if (!ui.options.present) return null;
    return <div className="present-exit glass">Presentation mode · press P or Esc to exit</div>;
}

/** Everything laid over the 3D view; hidden in presentation mode. */
function Overlay({ drawer }: { drawer: DrawerState }) {
    const { ui } = useEngine();
    if (ui.options.present) return null;
    return (
        <>
            <TopBar drawer={drawer} />
            <ArrivalCount />
            <div className="foot">
                <ChartsStrip />
                <ControlBar />
            </div>
        </>
    );
}

function LiveExplainer() {
    const { ui } = useEngine();
    return <Explainer stats={ui.stats} network={ui.options.network} />;
}

export function App() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const [engine, setEngine] = useState<Engine | null>(null);
    const [network] = useState(networkFromUrl); // from the URL; changing it reloads the page
    const drawer = useDrawerState();

    // the engine drives a WebGL canvas, so it can only start once the canvas is in the DOM
    useEffect(() => {
        const e = new Engine(canvasRef.current!, viewportRef.current!, network);
        setEngine(e);
        return () => e.dispose();
    }, [network]);

    useEffect(() => {
        if (network.id !== "mainnet") document.title = `Hedera ${network.label} consensus 3D`;
    }, [network]);

    useKeyboardShortcuts(engine);

    const withEngine = (node: ReactNode) =>
        engine && <EngineProvider engine={engine}>{node}</EngineProvider>;

    return (
        <>
            <section className="stage">
                <div className="view-col">
                    <div className="viewport" ref={viewportRef}>
                        <canvas
                            ref={canvasRef}
                            aria-label={`3D view of live Hedera ${network.label} transactions`}
                        />
                        {withEngine(
                            <>
                                <Tooltip />
                                <PresentNote />
                                <LoadingOverlay />
                            </>,
                        )}
                    </div>
                    {withEngine(<Overlay drawer={drawer} />)}
                </div>
                {withEngine(<Drawer drawer={drawer} />)}
            </section>
            {withEngine(<LiveExplainer />)}
            <footer>
                Hedera {network.label} consensus visualizer · data from the Hedera public mirror
                node · built with three.js and React
            </footer>
        </>
    );
}
