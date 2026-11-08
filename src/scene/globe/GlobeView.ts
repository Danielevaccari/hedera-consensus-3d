// The globe: every consensus node at its host city, spikes for transactions received, arcs along the
// real consensus order. Shares the live model and the renderer with the tower; draws only.
import {
    AdditiveBlending,
    AmbientLight,
    BackSide,
    Color,
    CylinderGeometry,
    DirectionalLight,
    DoubleSide,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    MeshLambertMaterial,
    MeshPhongMaterial,
    NormalBlending,
    OctahedronGeometry,
    PerspectiveCamera,
    Quaternion,
    RingGeometry,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    TorusGeometry,
    Vector3,
    type WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { CFG, GLOBE } from "../../config";
import type { LiveState } from "../../engine/LiveState";
import type { Hover, HNode, Tx } from "../../engine/types";
import { trunc } from "../../lib/format";
import { createBackdrop } from "../backdrop";
import { disposeSprite, makeInstanced, sizeSprite, textSprite, type TextSprite } from "../helpers";
import { LineBuf } from "../LineBuf";
import { PALETTES, type Palette, type Theme } from "../palette";
import { createComposer } from "../renderer";
import type { View3D } from "../View3D";
import { coordsFor, latLonToUnit } from "./geo";
import { rasterizeLand } from "./land";
import { buildEarthMaps, type EarthMaps } from "./surface";

const R = 10;
const UP = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);
const DROP_CAP = 3000;
const RIPPLE_SECONDS = 1.3;

/** A node placed on the sphere. */
interface GNode {
    nd: HNode;
    vec: Vector3;
    /** orients spikes (local y) and flat rings (local z) along the surface normal */
    quat: Quaternion;
    quatZ: Quaternion;
    /** spike height, eased towards its target */
    h: number;
    calm: Color;
    fx: Color;
}

export class GlobeView implements View3D {
    fx = false;
    /** nodes whose host city isn't on the map: shown in the panels but not on the globe */
    unmapped: HNode[] = [];
    private pal: Palette = PALETTES.light;
    private scene = new Scene();
    private camera = new PerspectiveCamera(40, 1, 0.1, 400);
    private controls: OrbitControls;
    private composer: EffectComposer;
    private backdrop = createBackdrop();
    private fitted = false;

    private ambient = new AmbientLight(0xffffff, 0.55);
    private keyLight = new DirectionalLight(0xffffff, 1.1);
    // open water until the generated surface is ready, then white so the map shows true to colour
    private earthMat = new MeshPhongMaterial({
        color: 0x12507f,
        specular: 0x000000,
        shininess: 30,
    });
    private cloudMat = new MeshLambertMaterial({
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
    });
    private rimMat: ShaderMaterial;
    private maps: EarthMaps | null = null;
    private clouds: Mesh | null = null;
    private surfaceRequested = false;

    private spikeMesh;
    private markerMesh;
    private dropMesh;
    private rippleMesh;
    private arcLines;
    private trailLines;
    private lines: LineBuf[];
    private trackStar = new Mesh(new OctahedronGeometry(0.12, 0), new MeshBasicMaterial());
    private trackRing = new Mesh(new TorusGeometry(1, 0.06, 8, 48), new MeshBasicMaterial());
    private trackLabel: TextSprite | null = null;
    private trackLabelFor: HNode | null = null;

    private gnodes: GNode[] = [];
    private byNode = new Map<HNode, GNode>();
    private frameNo = 0;
    private anisotropy: number;

    // scratch
    private tmpM = new Matrix4();
    private tmpC = new Color();
    private tmpC2 = new Color();
    private tmpV = new Vector3();
    private tmpS = new Vector3();
    private v3 = new Vector3();

    constructor(
        private renderer: WebGLRenderer,
        private canvas: HTMLCanvasElement,
        private state: LiveState,
    ) {
        this.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const scene = this.scene;
        scene.add(this.camera);
        this.camera.position.copy(latLonToUnit(38, 12).multiplyScalar(R * 4.6)); // Europe: most nodes

        const controls = (this.controls = new OrbitControls(this.camera, canvas));
        controls.target.set(0, 0, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.enablePan = false;
        controls.rotateSpeed = 0.5;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.25;
        controls.minDistance = R * 1.3;
        controls.maxDistance = R * 8;
        this.composer = createComposer(renderer, scene, this.camera);

        scene.add(this.backdrop.group);
        this.backdrop.nowDisc.visible = false; // the tower's "now" disc has no meaning here

        scene.add(this.ambient);
        const key = this.keyLight;
        key.position.set(-6, 8, 10); // follows the camera, so the lit side always faces the viewer
        this.camera.add(key);

        // the earth (textured once the map data has loaded), clouds, and a soft atmosphere that fades out
        scene.add(new Mesh(new SphereGeometry(R, 96, 64), this.earthMat));
        this.rimMat = new ShaderMaterial({
            uniforms: { c: { value: new Color("#60a5fa") }, strength: { value: 0.3 } },
            vertexShader:
                "varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }",
            fragmentShader:
                // d = how head-on this point of the shell is seen: it is largest next to the globe and falls to 0 at the
                // shell's outer edge, so the glow fades out smoothly instead of ending in a hard ring
                "uniform vec3 c; uniform float strength; varying vec3 vN; varying vec3 vV; void main(){ float d = abs(dot(vN, vV)); float f = pow(clamp(d / 0.39, 0.0, 1.0), 2.4); gl_FragColor = vec4(c, f * strength); }",
            transparent: true,
            side: BackSide,
            depthWrite: false,
        });
        scene.add(new Mesh(new SphereGeometry(R * 1.08, 96, 64), this.rimMat));

        const spike = new CylinderGeometry(1, 1, 1, 10);
        spike.translate(0, 0.5, 0);
        this.spikeMesh = makeInstanced(scene, spike, 128);
        this.markerMesh = makeInstanced(scene, new SphereGeometry(1, 24, 16), 128);
        this.dropMesh = makeInstanced(scene, new SphereGeometry(1, 16, 12), DROP_CAP);
        this.rippleMesh = makeInstanced(scene, new RingGeometry(0.86, 1, 48), 600, {
            transparent: true,
            additive: true,
            side: DoubleSide,
        });
        this.arcLines = new LineBuf(scene, 16000, 1.4);
        this.trailLines = new LineBuf(scene, 4000, 1.6);
        this.lines = [this.arcLines, this.trailLines];

        this.trackStar.visible = false;
        this.trackRing.visible = false;
        scene.add(this.trackStar, this.trackRing);
        this.setTheme("light");
    }

    // =================================================================
    // Setup and options
    // =================================================================

    /** Builds the earth maps from the land outlines (once, the first time the globe is shown). */
    private async loadSurface() {
        try {
            const maps = buildEarthMaps(await rasterizeLand());
            this.maps = maps;
            const m = this.earthMat;
            m.map = maps.color;
            m.specularMap = maps.specular;
            m.color.set(0xffffff);
            m.specular.set(0x2e3a49);
            m.needsUpdate = true;
            this.cloudMat.map = maps.clouds;
            this.cloudMat.needsUpdate = true;
            this.clouds = new Mesh(new SphereGeometry(R * 1.012, 96, 64), this.cloudMat);
            this.scene.add(this.clouds);
        } catch (err) {
            console.warn("globe: could not build the earth surface", err);
        }
    }

    /** Same natural earth in both themes; only the sky behind it, the glow and the lines change. */
    setTheme(theme: Theme) {
        const pal = (this.pal = PALETTES[theme]);
        const light = theme === "light";
        // (three.js divides diffuse light by pi, so these are larger than they look: the side facing
        // the viewer lands near the map's own colours and the limb falls off to about a third)
        this.ambient.intensity = 1.3;
        this.keyLight.intensity = 2.0;
        this.rimMat.uniforms.c.value.set(light ? "#3b82f6" : "#60a5fa");
        this.rimMat.uniforms.strength.value = light ? 0.14 : 0.16;
        this.trackStar.material.color.copy(pal.gold);
        this.trackRing.material.color.copy(pal.gold);
        for (const lb of this.lines) lb.setBase(pal.base, light, light ? 2.4 : 1);
        this.backdrop.setTheme(light);
        const ripple = this.rippleMesh.material as MeshBasicMaterial;
        ripple.blending = light ? NormalBlending : AdditiveBlending;
        ripple.needsUpdate = true;
        if (this.trackLabel) {
            disposeSprite(this.scene, this.trackLabel);
            this.trackLabel = null;
            this.trackLabelFor = null;
        }
        if (this.gnodes.length) this.buildNodes();
        else this.setFx(this.fx);
    }

    /** Places every node on the globe; nodes in the same city are spread on a small circle. */
    buildNodes() {
        const pal = this.pal;
        const groups = new Map<string, { nd: HNode; lat: number; lon: number }[]>();
        this.unmapped = [];
        for (const nd of this.state.nodes) {
            const c = coordsFor(nd.loc);
            if (!c) {
                this.unmapped.push(nd);
                continue;
            }
            const key = c.join(",");
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push({ nd, lat: c[0], lon: c[1] });
        }
        const old = new Map(this.byNode);
        this.gnodes = [];
        this.byNode.clear();
        for (const g of groups.values()) {
            g.forEach(({ nd, lat, lon }, k) => {
                let la = lat;
                let lo = lon;
                if (g.length > 1) {
                    const a = (k / g.length) * Math.PI * 2;
                    const d = 0.75 + 0.12 * g.length;
                    la += d * Math.sin(a);
                    lo += (d * Math.cos(a)) / Math.max(0.3, Math.cos((lat * Math.PI) / 180));
                }
                const vec = latLonToUnit(la, lo);
                const gn: GNode = {
                    nd,
                    vec,
                    quat: new Quaternion().setFromUnitVectors(UP, vec),
                    quatZ: new Quaternion().setFromUnitVectors(Z, vec),
                    h: old.get(nd)?.h ?? 0.2,
                    calm: new Color(pal.nodeHex(nd)),
                    fx: new Color(nd.hexFx),
                };
                this.gnodes.push(gn);
                this.byNode.set(nd, gn);
            });
        }
        this.setFx(this.fx);
    }

    setFx(fx: boolean) {
        this.fx = fx;
        const glow = fx && this.pal.theme === "dark";
        this.backdrop.group.visible = fx;
        this.scene.background = fx ? null : this.pal.bg;
        for (const lb of this.lines) lb.setFx(fx, glow);
        this.controls.autoRotateSpeed = fx ? 0.45 : 0.25;
    }

    get autoRotate() {
        return this.controls.autoRotate;
    }
    set autoRotate(on: boolean) {
        this.controls.autoRotate = on;
    }

    setActive(on: boolean) {
        this.controls.enabled = on;
        // the map data and its raster are only fetched and computed once the globe is first shown
        if (on && !this.surfaceRequested) {
            this.surfaceRequested = true;
            void this.loadSurface();
        }
    }

    resize(w: number, h: number) {
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this.composer.setSize(w, h);
        for (const lb of this.lines) lb.setResolution(w, h);
        const aspect = w / h;
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        if (!this.fitted) {
            // portrait screens: back off at the start so the whole globe fits the width
            this.fitted = true;
            const dist = Math.max(R * 4.6, (R * 3.3) / aspect);
            this.camera.position.setLength(Math.min(R * 8, dist));
        }
    }

    // =================================================================
    // Frame
    // =================================================================

    private get glow() {
        return this.fx && this.pal.theme === "dark";
    }

    /** A colour that fades out as `f` goes 1 -> 0 (see TowerView.fadedColor). */
    private fadedColor(out: Color, col: Color, f: number, boost: number) {
        out.copy(col);
        return this.pal.theme === "dark"
            ? out.multiplyScalar(boost * f)
            : out.lerp(this.pal.base, 1 - f);
    }

    private surf(g: GNode, alt: number, out = this.tmpV) {
        return out.copy(g.vec).multiplyScalar(R + alt);
    }

    frame(dt: number) {
        this.frameNo++;
        if (this.clouds) this.clouds.rotation.y += dt * 0.006; // drifts slightly faster than the ground
        const { state, pal, fx, tmpM, tmpC, tmpC2, tmpS } = this;
        const { txs, tracked, displayRel, realT } = state;

        // ---- per-node counts over a short recent window drive the spike heights ----
        for (const g of this.gnodes) g.nd.count = 0;
        for (let k = txs.length - 1; k >= 0; k--) {
            const tx = txs[k];
            if (!tx.landed) continue;
            if (displayRel - tx.ct > GLOBE.SPIKE_WINDOW) break;
            if (tx.node && state.shown(tx)) tx.node.count++;
        }
        // a floor keeps a couple of stray transactions from towering over a quiet globe
        let maxCount = 6;
        for (const g of this.gnodes) if (g.nd.count > maxCount) maxCount = g.nd.count;

        // ---- node markers (size = stake) and spikes (height = tx received) ----
        const maxStake = Math.max(...state.nodes.map(n => n.stake), 1);
        let si = 0;
        for (const g of this.gnodes) {
            const nd = g.nd;
            const target = 0.15 + 2.6 * (nd.count / maxCount);
            g.h += (target - g.h) * Math.min(1, dt * 3);
            const p = Math.exp(-(realT - nd.pulse) * 6);
            const r = 0.045 + 0.065 * (nd.stake / maxStake);
            const col = fx ? g.fx : g.calm;
            tmpS.setScalar(r * (1 + (fx ? 0.35 : 0.15) * p));
            tmpM.compose(this.surf(g, 0.02), g.quat, tmpS);
            this.markerMesh.setMatrixAt(si, tmpM);
            this.markerMesh.setColorAt(si, col);
            tmpS.set(0.022, g.h, 0.022);
            tmpM.compose(this.surf(g, 0.02), g.quat, tmpS);
            tmpC.copy(col);
            if (pal.theme === "dark") tmpC.multiplyScalar(0.75);
            this.spikeMesh.setMatrixAt(si, tmpM);
            this.spikeMesh.setColorAt(si, tmpC);
            si++;
        }
        this.markerMesh.count = si;
        this.spikeMesh.count = si;

        // ---- transactions dropping onto their node just before their consensus time ----
        this.trailLines.reset();
        let di = 0;
        for (let k = txs.length - 1; k >= 0; k--) {
            const tx = txs[k];
            if (tx.landed) break;
            const g = tx.node && this.byNode.get(tx.node);
            if (!g || !state.shown(tx)) continue;
            const u = (displayRel - (tx.ct - CFG.FLY)) / CFG.FLY;
            if (u < 0) continue;
            const q = Math.min(1, u);
            const alt = 1.6 * (1 - q * q) + 0.03;
            const col = this.txColor(tx);
            const pos = this.surf(g, alt);
            const s = tx === tracked ? 0.1 : 0.06;
            tmpM.makeScale(s, s, s).setPosition(pos);
            tx.px = pos.x;
            tx.py = pos.y;
            tx.pz = pos.z;
            tx.frame = this.frameNo;
            if (di < DROP_CAP - 10) {
                this.dropMesh.setMatrixAt(di, tmpM);
                this.dropMesh.setColorAt(di, col);
                di++;
            }
            const tail = this.surf(g, alt + 0.45, tmpS);
            this.trailLines.push(pos.x, pos.y, pos.z, tail.x, tail.y, tail.z, col, 0.7, col, 0);
        }
        this.trailLines.flush();

        // ---- arrival ripples on the surface (recently landed transactions) ----
        const ripSecs = fx ? RIPPLE_SECONDS * 1.4 : RIPPLE_SECONDS;
        let ri = 0;
        for (let k = txs.length - 1; k >= 0 && ri < 590; k--) {
            const tx = txs[k];
            if (!tx.landed) continue;
            const age = realT - tx.landedReal;
            if (age > ripSecs) {
                if (displayRel - tx.ct > 3) break; // everything older landed earlier too
                continue;
            }
            const g = tx.node && this.byNode.get(tx.node);
            if (!g || !state.shown(tx)) continue;
            const f = 1 - age / ripSecs;
            tmpS.setScalar((fx ? 0.14 : 0.1) + (fx ? 0.95 : 0.55) * (age / ripSecs));
            tmpM.compose(this.surf(g, 0.015), g.quatZ, tmpS);
            this.rippleMesh.setMatrixAt(ri, tmpM);
            this.rippleMesh.setColorAt(ri, this.fadedColor(tmpC2, this.txColor(tx), f, 0.8));
            ri++;
        }
        this.rippleMesh.count = ri;

        // ---- consensus order arcs: each transaction linked to the next one in the global order ----
        this.arcLines.reset();
        let newer: Tx | null = null;
        for (let k = txs.length - 1; k >= 0; k--) {
            const tx = txs[k];
            if (!tx.landed || !tx.node || !state.shown(tx) || !this.byNode.has(tx.node)) continue;
            if (newer && displayRel - newer.ct > GLOBE.ARC_LIFE) break;
            if (newer && newer.node !== tx.node) {
                const born = realT - newer.landedReal;
                const u = Math.min(1, born / 0.7);
                const fade = Math.max(0, 1 - (displayRel - newer.ct) / GLOBE.ARC_LIFE);
                const hot = newer === tracked || tx === tracked;
                const kk = (hot ? 1 : 0.85) * fade; // fades all the way out
                const c1 = hot ? pal.gold : pal.kind(tx.kind);
                const c2 = hot ? pal.gold : pal.kind(newer.kind);
                const end = this.pushArc(
                    this.byNode.get(tx.node)!,
                    this.byNode.get(newer.node!)!,
                    u,
                    c1,
                    c2,
                    kk,
                );
                if (u < 1 && end && di < DROP_CAP - 10) {
                    // a small head travels along the arc while it is being drawn
                    tmpM.makeScale(0.05, 0.05, 0.05).setPosition(end);
                    this.dropMesh.setMatrixAt(di, tmpM);
                    this.dropMesh.setColorAt(di, c2);
                    di++;
                }
            }
            newer = tx;
        }
        this.dropMesh.count = di;
        this.arcLines.flush();
        for (const mm of [this.dropMesh, this.markerMesh, this.spikeMesh, this.rippleMesh]) {
            mm.instanceMatrix.needsUpdate = true;
            if (mm.instanceColor) mm.instanceColor.needsUpdate = true;
        }

        this.updateTrackMarker();
        if (fx) this.backdrop.tick(realT, dt);
        this.controls.update();
        if (this.glow) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    private txColor(tx: Tx) {
        const pal = this.pal;
        return tx === this.state.tracked
            ? pal.gold
            : tx.result !== "SUCCESS"
              ? pal.red
              : pal.kind(tx.kind);
    }

    private arcEnd = new Vector3();

    /**
     * Great-circle arc between two nodes, lifted in proportion to distance; `u` is how much of it
     * is drawn. Returns the head position, or null when nothing was drawn.
     */
    private pushArc(a: GNode, b: GNode, u: number, c1: Color, c2: Color, k: number) {
        const va = a.vec;
        const vb = b.vec;
        const ang = Math.acos(Math.min(1, Math.max(-1, va.dot(vb))));
        const sinA = Math.sin(ang);
        if (sinA < 1e-4) return null;
        const lift = R * (0.025 + 0.3 * (ang / Math.PI));
        const SEG = Math.max(8, Math.round(10 + ang * 18));
        const last = Math.max(1, Math.round(SEG * u));
        const { tmpC, tmpC2 } = this;
        let px = 0;
        let py = 0;
        let pz = 0;
        for (let s = 0; s <= last; s++) {
            const t = s / SEG;
            const wa = Math.sin((1 - t) * ang) / sinA;
            const wb = Math.sin(t * ang) / sinA;
            const rr = R + 0.02 + lift * Math.sin(Math.PI * t);
            const x = (va.x * wa + vb.x * wb) * rr;
            const y = (va.y * wa + vb.y * wb) * rr;
            const z = (va.z * wa + vb.z * wb) * rr;
            if (s > 0) {
                tmpC.copy(c1).lerp(c2, (s - 1) / SEG);
                tmpC2.copy(c1).lerp(c2, t);
                this.arcLines.push(px, py, pz, x, y, z, tmpC, k, tmpC2, k);
            }
            px = x;
            py = y;
            pz = z;
        }
        return this.arcEnd.set(px, py, pz);
    }

    private updateTrackMarker() {
        const { state, trackStar, trackRing, tmpS } = this;
        const tracked = state.tracked;
        const g = tracked?.node ? this.byNode.get(tracked.node) : undefined;
        const flying = !!tracked && tracked.frame === this.frameNo;
        trackStar.visible = flying;
        if (flying) trackStar.position.set(tracked.px, tracked.py, tracked.pz);

        trackRing.visible = !!g && !!tracked && tracked.landed;
        if (g && trackRing.visible) {
            trackRing.position.copy(this.surf(g, 0.03));
            trackRing.quaternion.copy(g.quatZ);
            trackRing.scale.copy(tmpS.setScalar(0.22));
        }

        if (!g) {
            if (this.trackLabel) this.trackLabel.visible = false;
            return;
        }
        if (this.trackLabelFor !== g.nd) {
            if (this.trackLabel) disposeSprite(this.scene, this.trackLabel);
            this.trackLabel = textSprite(
                `★ ${g.nd.acct} · ${trunc(g.nd.host, 22)}`,
                this.pal.goldHex,
                26,
                500,
                this.anisotropy,
            );
            this.scene.add(this.trackLabel);
            this.trackLabelFor = g.nd;
        }
        const label = this.trackLabel!;
        sizeSprite(label, 0.011 * this.camera.position.length());
        label.position.copy(this.surf(g, g.h + 0.35));
        label.visible = true;
    }

    // =================================================================
    // Picking
    // =================================================================

    /** The node under a canvas-relative point; nodes on the far side of the globe are skipped. */
    pick(mx: number, my: number): Hover | null {
        const W = this.canvas.clientWidth;
        const H = this.canvas.clientHeight;
        const v3 = this.v3;
        let best: HNode | null = null;
        let bd = 16 * 16;
        for (const g of this.gnodes) {
            this.surf(g, 0.05, v3);
            if (this.tmpS.copy(this.camera.position).sub(v3).dot(g.vec) <= 0) continue;
            v3.project(this.camera);
            const dx = ((v3.x + 1) / 2) * W - mx;
            const dy = ((1 - v3.y) / 2) * H - my;
            const d = dx * dx + dy * dy;
            if (d < bd) {
                bd = d;
                best = g.nd;
            }
        }
        return best ? { type: "node", node: best } : null;
    }

    dispose() {
        this.controls.dispose();
        for (const lb of this.lines) lb.dispose();
        if (this.trackLabel) disposeSprite(this.scene, this.trackLabel);
        this.maps?.color.dispose();
        this.maps?.specular.dispose();
        this.maps?.clouds.dispose();
        this.composer.dispose();
    }
}
