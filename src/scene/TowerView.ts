// The tower: one column per consensus node, every transaction at its consensus time.
// Reads LiveState every frame and draws it; it never changes the data.
import {
    AdditiveBlending,
    BackSide,
    Color,
    Fog,
    FrontSide,
    IcosahedronGeometry,
    Matrix4,
    Mesh,
    MeshBasicMaterial,
    NormalBlending,
    Object3D,
    OctahedronGeometry,
    PerspectiveCamera,
    Scene,
    SphereGeometry,
    TorusGeometry,
    Vector3,
    type WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { CFG, FADE } from "../config";
import type { LiveState } from "../engine/LiveState";
import type { Market } from "../engine/Market";
import type { Hover, HNode, Tx } from "../engine/types";
import { fmtInt, trunc } from "../lib/format";
import { createBackdrop } from "./backdrop";
import {
    bezier,
    disposeSprite,
    makeInstanced,
    sizeSprite,
    textSprite,
    type TextSprite,
} from "./helpers";
import { LineBuf } from "./LineBuf";
import { PALETTES, type Palette, type Theme } from "./palette";
import { createComposer } from "./renderer";
import type { MorphPoint, MorphSample, View3D } from "./View3D";

/** how far the tilt shifts the picture at most, in CSS pixels */
const PARALLAX_PX = 14;
const TX_CAP = 8000;
const DOT_CAP = 3000;
const SHOCK_CAP = 600;

interface NodeVisual {
    core: Mesh<SphereGeometry, MeshBasicMaterial>;
    glow: Mesh<SphereGeometry, MeshBasicMaterial>;
    acct: TextSprite;
    host: TextSprite;
    calm: Color;
    fx: Color;
}

export class TowerView implements View3D {
    fx = false;
    private pal: Palette = PALETTES.light;
    private scene = new Scene();
    private fog = new Fog(0xffffff, 55, 120);
    private camera = new PerspectiveCamera(42, 1, 0.1, 600);
    private controls: OrbitControls;
    private composer: EffectComposer;
    private backdrop = createBackdrop();
    private anisotropy: number;

    // ---- per-frame batches ----
    private txMesh;
    private dotMesh;
    private shockMesh;
    private threadLines;
    private ringLines;
    private trailLines;
    private baseLines;
    private lines: LineBuf[];
    private trackStar = new Mesh(new OctahedronGeometry(0.4, 0), new MeshBasicMaterial());
    private trackHalo = new Mesh(new TorusGeometry(1, 0.04, 8, 48), new MeshBasicMaterial());

    // ---- nodes and labels ----
    private nodeGeo = new SphereGeometry(0.5, 48, 32);
    private nodeGlowGeo = new SphereGeometry(1, 20, 14);
    private nodeVisuals: NodeVisual[] = [];
    private nowLabel: TextSprite | null = null;
    private blockLabels = new Map<number, TextSprite>();

    // ---- layout: cylinder <-> flat wall morph ----
    private colX = new Float32Array(1);
    private colZ = new Float32Array(1);
    private fitted = false;
    private size = { w: 1, h: 1 };
    private morph = 0;
    private morphTarget = 0;
    private camTween: { from: Vector3; to: Vector3; t: number } | null = null;

    // ---- scratch ----
    private frameNo = 0;
    private visible: Tx[] = [];
    private tmpM = new Matrix4();
    private tmpC = new Color();
    private tmpC2 = new Color();
    private dummy = new Object3D();
    private bz = [0, 0, 0];
    private v3 = new Vector3();

    constructor(
        private renderer: WebGLRenderer,
        private canvas: HTMLCanvasElement,
        private state: LiveState,
        private market: Market,
    ) {
        this.anisotropy = renderer.capabilities.getMaxAnisotropy();

        const scene = this.scene;
        scene.fog = this.fog;
        this.camera.position.set(0, 7, 64);

        const controls = (this.controls = new OrbitControls(this.camera, canvas));
        controls.target.set(0, -15, 0);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.25;
        controls.minDistance = 8;
        controls.maxDistance = 140;
        this.composer = createComposer(renderer, scene, this.camera);

        scene.add(this.backdrop.group);

        const dotGeo = new IcosahedronGeometry(1, 3);
        this.txMesh = makeInstanced(scene, dotGeo, TX_CAP);
        this.dotMesh = makeInstanced(scene, dotGeo, DOT_CAP, { fog: false });
        this.shockMesh = makeInstanced(scene, new TorusGeometry(1, 0.025, 6, 64), SHOCK_CAP, {
            transparent: true,
            additive: true,
            fog: false,
        });
        this.threadLines = new LineBuf(scene, 8000, 1.3);
        this.ringLines = new LineBuf(scene, 4000, 1.25);
        this.trailLines = new LineBuf(scene, 20000, 2);
        this.baseLines = new LineBuf(scene, 400, 1.1);
        this.lines = [this.threadLines, this.ringLines, this.trailLines, this.baseLines];

        this.trackStar.visible = false;
        this.trackHalo.visible = false;
        scene.add(this.trackStar, this.trackHalo);
        this.setTheme("light");
    }

    // =================================================================
    // Setup and options
    // =================================================================

    /** Bloom and additive glow need a dark background; light flashy uses coloured, normal blends. */
    private get glow() {
        return this.fx && this.pal.theme === "dark";
    }

    setTheme(theme: Theme) {
        const pal = (this.pal = PALETTES[theme]);
        this.fog.color.copy(pal.bg);
        const light = theme === "light";
        for (const lb of this.lines) lb.setBase(pal.base, light, light ? 1.7 : 1);
        this.trackStar.material.color.copy(pal.gold);
        this.trackHalo.material.color.copy(pal.gold);
        this.backdrop.setTheme(light);
        const shock = this.shockMesh.material as MeshBasicMaterial;
        shock.blending = light ? NormalBlending : AdditiveBlending;
        shock.needsUpdate = true;

        if (this.nowLabel) disposeSprite(this.scene, this.nowLabel);
        this.nowLabel = textSprite(
            "CONSENSUS CLOCK ▸ older below",
            pal.goldHex,
            30,
            500,
            this.anisotropy,
        );
        sizeSprite(this.nowLabel, 0.75);
        this.scene.add(this.nowLabel);
        this.removeBlockLabels([...this.blockLabels.keys()]); // recreated on demand
        if (this.nodeVisuals.length) this.buildNodes();
        else this.setFx(this.fx);
    }

    buildNodes() {
        for (const v of this.nodeVisuals) {
            this.scene.remove(v.core, v.glow);
            v.core.material.dispose();
            v.glow.material.dispose();
            disposeSprite(this.scene, v.acct);
            disposeSprite(this.scene, v.host);
        }
        const nodes = this.state.nodes;
        const pal = this.pal;
        this.nodeVisuals = nodes.map(nd => {
            const hex = pal.nodeHex(nd);
            const calm = new Color(hex);
            const core = new Mesh(this.nodeGeo, new MeshBasicMaterial({ color: calm, fog: false }));
            const glow = new Mesh(
                this.nodeGlowGeo,
                new MeshBasicMaterial({
                    color: calm,
                    transparent: true,
                    opacity: 0,
                    side: BackSide,
                    depthWrite: false,
                    fog: false,
                }),
            );
            const acct = textSprite(nd.acct, hex, 28, 600, this.anisotropy);
            sizeSprite(acct, 0.62);
            const host = textSprite(trunc(nd.host, 14), pal.hostLabel, 26, 500, this.anisotropy);
            sizeSprite(host, 0.42);
            this.scene.add(core, glow, acct, host);
            return { core, glow, acct, host, calm, fx: new Color(nd.hexFx) };
        });
        this.colX = new Float32Array(nodes.length);
        this.colZ = new Float32Array(nodes.length);
        this.setFx(this.fx);
    }

    setFx(fx: boolean) {
        this.fx = fx;
        const glow = this.glow;
        this.backdrop.group.visible = fx;
        this.scene.background = fx ? null : this.pal.bg;
        for (const lb of this.lines) lb.setFx(fx, glow);
        for (const v of this.nodeVisuals) {
            const c = fx ? v.fx : v.calm;
            v.core.material.color.copy(c);
            const g = v.glow.material;
            g.color.copy(c);
            g.blending = glow ? AdditiveBlending : NormalBlending;
            g.side = fx ? FrontSide : BackSide;
            g.needsUpdate = true;
        }
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
    }

    get unrolled() {
        return this.morphTarget === 1;
    }
    /** Unrolls the tower into a flat wall (and back); unrolling also frames the wall. */
    set unrolled(on: boolean) {
        this.morphTarget = on ? 1 : 0;
        if (on) {
            this.controls.autoRotate = false;
            this.camTween = {
                from: this.camera.position.clone(),
                to: new Vector3(0, -8, 52),
                t: 0,
            };
        }
    }

    /** Shifts the picture a few pixels with the phone's tilt (x and y in -1..1). */
    setParallax(x: number, y: number) {
        const { w, h } = this.size;
        if (x === 0 && y === 0) this.camera.clearViewOffset();
        else this.camera.setViewOffset(w, h, x * PARALLAX_PX, y * PARALLAX_PX, w, h);
    }

    resize(w: number, h: number) {
        this.size = { w, h };
        this.composer.setPixelRatio(this.renderer.getPixelRatio());
        this.composer.setSize(w, h);
        for (const lb of this.lines) lb.setResolution(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (!this.fitted) {
            // portrait screens: back off at the start so the whole tower (about 34 units across,
            // labels included) fits the width
            this.fitted = true;
            const offset = this.camera.position.clone().sub(this.controls.target);
            const visibleWidth =
                2 *
                offset.length() *
                Math.tan((this.camera.fov / 2) * (Math.PI / 180)) *
                this.camera.aspect;
            const scale = Math.min(2.2, Math.max(1, 34 / visibleWidth));
            this.camera.position.copy(this.controls.target).addScaledVector(offset, scale);
        }
    }

    removeBlockLabels(nums: number[]) {
        for (const num of nums) {
            const s = this.blockLabels.get(num);
            if (s) {
                disposeSprite(this.scene, s);
                this.blockLabels.delete(num);
            }
        }
    }

    // =================================================================
    // Frame
    // =================================================================

    frame(dt: number) {
        this.frameNo++;
        this.tweenCamera(dt);
        this.morph += (this.morphTarget - this.morph) * Math.min(1, dt * 2.2);
        const m = this.computeColumns();
        this.updateNodes(m);
        this.updateBaseLines(m);
        this.updateTransactions(m);
        this.updateBlocks(m);
        this.updateClock(m, dt);
        this.updateTrackMarker();
        this.controls.update();
        if (this.glow) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    private tweenCamera(dt: number) {
        const tw = this.camTween;
        if (!tw) return;
        tw.t = Math.min(1, tw.t + dt / 1.4);
        const k = tw.t * tw.t * (3 - 2 * tw.t);
        this.camera.position.lerpVectors(tw.from, tw.to, k);
        if (tw.t >= 1) this.camTween = null;
    }

    private nodeAngle(i: number) {
        return (i / this.state.nodes.length) * Math.PI * 2 - Math.PI / 2;
    }

    /** Column positions for the current morph; returns the eased morph amount. */
    private computeColumns() {
        const n = this.state.nodes.length;
        const m = this.morph * this.morph * (3 - 2 * this.morph);
        for (let i = 0; i < n; i++) {
            const th = this.nodeAngle(i);
            const cx = CFG.R * Math.cos(th);
            const cz = CFG.R * Math.sin(th);
            const fx = (i - (n - 1) / 2) * CFG.gap;
            this.colX[i] = cx + (fx - cx) * m;
            this.colZ[i] = cz + (0 - cz) * m;
        }
        return m;
    }

    private nodeColor(i: number) {
        const v = this.nodeVisuals[i];
        return this.fx ? v.fx : v.calm;
    }

    /** Node spheres (size follows stake) and their labels. */
    private updateNodes(m: number) {
        const { nodes, realT } = this.state;
        const fx = this.fx;
        const NY = CFG.NODE_Y;
        for (let i = 0; i < nodes.length; i++) {
            const nd = nodes[i];
            const x = this.colX[i];
            const z = this.colZ[i];
            const p = Math.exp(-(realT - nd.pulse) * 5);
            const { core, glow, acct, host } = this.nodeVisuals[i];
            core.position.set(x, NY, z);
            core.scale.setScalar(nd.size * (0.8 + p * (fx ? 0.5 : 0.12)));
            glow.position.set(x, NY, z);
            glow.scale.setScalar(nd.size * (fx ? 0.62 + p * 0.7 : 0.62));
            glow.material.opacity = fx ? 0.16 + p * 0.3 : p * 0.35;

            const out = 1 + 1.4 * (1 - m);
            const ox = m < 0.5 ? (x / CFG.R) * out : 0;
            const oz = m < 0.5 ? (z / CFG.R) * out : 0;
            sizeSprite(acct, 0.62 * (1 - 0.38 * m));
            acct.position.set(
                x + ox * (1 - m),
                NY + 1.05 + m * (i % 2 ? 0.95 : 0.4),
                z + oz * (1 - m),
            );
            host.position.set(x + ox * (1 - m), NY + 1.55, z + oz * (1 - m));
            host.material.opacity = Math.max(0, 1 - m * 2);
            host.visible = m < 0.5;
            nd.count = 0;
        }
    }

    /** Ring through the nodes and faint column guides. */
    private updateBaseLines(m: number) {
        const n = this.state.nodes.length;
        const { colX, colZ, baseLines } = this;
        const NY = CFG.NODE_Y;
        const bottom = -CFG.window * CFG.VS;
        baseLines.reset();
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const c1 = this.nodeColor(i);
            const c2 = this.nodeColor(j);
            if (!(j === 0 && m > 0.5))
                baseLines.push(colX[i], NY, colZ[i], colX[j], NY, colZ[j], c1, 0.35, c2, 0.35);
            baseLines.push(colX[i], NY - 0.5, colZ[i], colX[i], bottom, colZ[i], c1, 0.13, c1, 0);
        }
        baseLines.flush();
    }

    private txColor(tx: Tx, out: Color, fade: number, born: number) {
        const pal = this.pal;
        out.copy(
            tx === this.state.tracked
                ? pal.gold
                : tx.result !== "SUCCESS"
                  ? pal.red
                  : pal.kind(tx.kind),
        );
        if (pal.theme === "light") return out.lerp(pal.base, 1 - fade); // fade towards the paper
        if (this.fx && born < 0.6) out.lerp(pal.white, (1 - born / 0.6) * 0.6);
        return out.multiplyScalar(fade * (this.fx ? 1.1 : 1));
    }

    /**
     * A colour that fades out as `f` goes 1 -> 0: dimmer on dark (boosted, since it is additive
     * light), paler on light (blended towards the paper).
     */
    private fadedColor(out: Color, col: Color, f: number, boost: number) {
        out.copy(col);
        return this.pal.theme === "dark"
            ? out.multiplyScalar(boost * f)
            : out.lerp(this.pal.base, 1 - f);
    }

    /** Transactions flying in, then resting at their consensus time, linked in consensus order. */
    private updateTransactions(m: number) {
        const { state, market, fx, pal, colX, colZ, bz, tmpM, tmpC, tmpC2, dummy } = this;
        const { txs, tracked, displayRel, realT } = state;
        const { txMesh, dotMesh, shockMesh, threadLines, trailLines } = this;
        const GOLD = pal.gold;
        const NY = CFG.NODE_Y;
        const win = CFG.window;
        const visible = this.visible;
        visible.length = 0;
        threadLines.reset();
        trailLines.reset();
        let ti = 0;
        let di = 0;
        let si = 0;
        let prev: Tx | null = null;

        for (let k = txs.length - 1; k >= 0; k--) {
            const tx = txs[k];
            const nd = tx.node;
            if (!nd || !state.shown(tx)) continue;
            const i = nd.i;

            if (!tx.landed) {
                // ---- flying in from outside the tower along a Bézier curve, with a comet tail ----
                const u = (displayRel - (tx.ct - CFG.FLY)) / CFG.FLY;
                if (u < 0) continue;
                const uu = Math.min(1, u);
                const th = this.nodeAngle(i) + tx.jit;
                const dist = CFG.R + 9;
                const sx = Math.cos(th) * dist * (1 - m) + (colX[i] + tx.jit * 8) * m;
                const sz = Math.sin(th) * dist * (1 - m) + 12 * m;
                const sy = NY + tx.jy;
                const ex = colX[i];
                const ez = colZ[i];
                const cx = (sx + ex) / 2;
                const cy = Math.max(sy, NY) + 2;
                const cz = (sz + ez) / 2;
                const col = tx === tracked ? GOLD : pal.kind(tx.kind);
                const u0 = Math.max(0, uu - (fx ? 0.55 : 0.35));
                const tk = fx ? 1 : 0.6;
                let px = 0;
                let py = 0;
                let pz = 0;
                for (let s = 0; s <= 6; s++) {
                    bezier(bz, sx, sy, sz, cx, cy, cz, ex, NY, ez, u0 + (uu - u0) * (s / 6));
                    if (s > 0) {
                        const k1 = ((s - 1) / 6) * tk;
                        const k2 = (s / 6) * tk;
                        trailLines.push(px, py, pz, bz[0], bz[1], bz[2], col, k1, col, k2);
                    }
                    px = bz[0];
                    py = bz[1];
                    pz = bz[2];
                }
                const ds = tx === tracked ? 0.3 : 0.13;
                this.remember(tx, bz[0], bz[1], bz[2]);
                if (di < DOT_CAP - 10) {
                    tmpM.makeScale(ds, ds, ds).setPosition(bz[0], bz[1], bz[2]);
                    dotMesh.setMatrixAt(di, tmpM);
                    dotMesh.setColorAt(di, col);
                    di++;
                }
                continue;
            }

            // ---- landed: rests in its node's column at its consensus time ----
            const age = displayRel - tx.ct;
            if (age > win || ti >= TX_CAP - 10) break;
            const born = realT - tx.landedReal;
            let y = -age * CFG.VS;
            if (born < 0.35) {
                const q = born / 0.35;
                y = NY + (y - NY) * q * (2 - q);
            }
            const x = colX[i];
            const z = colZ[i];
            this.remember(tx, x, y, z);
            nd.count++;
            const fade = Math.min(1, (win - age) / FADE);
            const whale = market.isWhale(tx);
            const s =
                (tx === tracked ? 0.2 : 0.15) *
                (fx && born < 0.5 ? 1 + 1.3 * (1 - born / 0.5) : 1) *
                (whale ? 1.8 : 1);
            tmpM.makeScale(s, s, s).setPosition(x, y, z);
            txMesh.setMatrixAt(ti, tmpM);
            txMesh.setColorAt(ti, this.txColor(tx, tmpC, fade, born));
            ti++;

            // flashy: a shockwave ring and a burst of sparks at the node when a transaction lands
            if (fx && born < 0.8) {
                const q = born / 0.8;
                const col = tx === tracked ? GOLD : pal.kind(tx.kind);
                if (si < SHOCK_CAP - 10) {
                    dummy.position.set(x, NY, z);
                    dummy.rotation.set(Math.PI / 2, 0, 0);
                    dummy.scale.setScalar(0.3 + q * 1.8);
                    dummy.updateMatrix();
                    shockMesh.setMatrixAt(si, dummy.matrix);
                    shockMesh.setColorAt(si, this.fadedColor(tmpC2, col, 1 - q, 1.2));
                    si++;
                }
                for (let k2 = 0; k2 < 6 && di < DOT_CAP - 10; k2++) {
                    const a = k2 * 1.047 + tx.ct * 7.3;
                    const rr = q * 1.6;
                    const ss = 0.05 * (1 - q) + 0.01;
                    // prettier-ignore
                    tmpM.makeScale(ss, ss, ss)
                        .setPosition(x + Math.cos(a) * rr, NY + q * 1.2 - q * q * 2, z + Math.sin(a) * rr);
                    dotMesh.setMatrixAt(di, tmpM);
                    dotMesh.setColorAt(di, this.fadedColor(tmpC2, col, 1 - q, 1.4));
                    di++;
                }
            }

            // flashy: a whale transfer gets a gold light beam down its column and a big shockwave
            if (fx && tx.whaleAt !== undefined && realT - tx.whaleAt < 4) {
                const wb = realT - tx.whaleAt;
                const kf = 1.2 * (1 - wb / 4);
                trailLines.push(x, NY + 9, z, x, y, z, GOLD, kf * 0.2, GOLD, kf);
                if (si < SHOCK_CAP - 10 && wb < 1.6) {
                    const q = wb / 1.6;
                    dummy.position.set(x, NY, z);
                    dummy.rotation.set(Math.PI / 2, 0, 0);
                    dummy.scale.setScalar(0.5 + q * 5);
                    dummy.updateMatrix();
                    shockMesh.setMatrixAt(si, dummy.matrix);
                    shockMesh.setColorAt(si, this.fadedColor(tmpC2, GOLD, 1 - q, 1.5));
                    si++;
                }
            }

            visible.push(tx);
            // consensus order thread: link each transaction to the next one in the global order
            if (prev) {
                const hot = prev === tracked || tx === tracked;
                const kk = (hot ? 0.9 : fx ? 0.32 : 0.42) * fade;
                const c1 = hot ? GOLD : pal.kind(tx.kind);
                const c2 = hot ? GOLD : pal.kind(prev.kind);
                threadLines.push(x, y, z, prev.px, prev.py, prev.pz, c1, kk, c2, kk);
            }
            prev = tx;
        }

        txMesh.count = ti;
        dotMesh.count = di;
        shockMesh.count = si;
        for (const mm of [txMesh, dotMesh, shockMesh]) {
            mm.instanceMatrix.needsUpdate = true;
            mm.instanceColor!.needsUpdate = true;
        }
        threadLines.flush();
        trailLines.flush();
    }

    private remember(tx: Tx, x: number, y: number, z: number) {
        tx.px = x;
        tx.py = y;
        tx.pz = z;
        tx.frame = this.frameNo;
    }

    private blockLabel(num: number, count: number) {
        let s = this.blockLabels.get(num);
        if (!s) {
            const text = `BLOCK ${fmtInt(num)} ▾ ${count} tx`;
            const hex = this.pal.blockHex[num % this.pal.blockHex.length];
            s = textSprite(text, hex, 30, 500, this.anisotropy);
            sizeSprite(s, 0.6);
            this.scene.add(s);
            this.blockLabels.set(num, s);
        }
        return s;
    }

    private placeLabelOutside(s: TextSprite, y: number, offset: number, radius: number) {
        const cam = this.camera.position;
        const t = this.controls.target;
        const a = Math.atan2(cam.z - t.z, cam.x - t.x) + offset;
        s.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    }

    /** A ring at each record file's closing timestamp; every 5th block is labelled. */
    private updateBlocks(m: number) {
        const { state, fx, pal, colX, colZ, tmpC, ringLines } = this;
        const n = state.nodes.length;
        const win = CFG.window;
        ringLines.reset();
        const used = new Set<TextSprite>();
        for (const b of state.blocks) {
            const age = state.displayRel - b.to;
            if (age < 0 || age > win) continue;
            const y = -age * CFG.VS;
            const flash =
                b.sealedAt !== null ? Math.max(0, 1 - (state.realT - b.sealedAt) / 1.4) : 0;
            tmpC.copy(pal.block[b.num % pal.block.length]);
            if (fx && pal.theme === "dark") tmpC.lerp(pal.white, flash * 0.7);
            const major = b.num % 5 === 0;
            const kk =
                (major ? (fx ? 0.2 : 0.3) : fx ? 0.06 : 0.13) *
                (1 + flash * (fx ? 6 : 1)) *
                Math.min(1, (win - age) / FADE);

            // flashy: a sealed block sends a shock ring outward from the tower
            if (fx && flash > 0 && m < 0.5) {
                const rr = CFG.R + (1 - flash) * 7;
                const kf = flash * 0.9;
                for (let s2 = 0; s2 < 64; s2++) {
                    const a0 = (s2 / 64) * Math.PI * 2;
                    const a1 = ((s2 + 1) / 64) * Math.PI * 2;
                    // prettier-ignore
                    ringLines.push(Math.cos(a0) * rr, y, Math.sin(a0) * rr,
                        Math.cos(a1) * rr, y, Math.sin(a1) * rr, tmpC, kf, tmpC, kf);
                }
            }
            for (let i = 0; i < n; i++) {
                const j = (i + 1) % n;
                if (j === 0 && m > 0.5) break;
                ringLines.push(colX[i], y, colZ[i], colX[j], y, colZ[j], tmpC, kk, tmpC, kk);
            }
            if (!major) continue;
            const lab = this.blockLabel(b.num, b.count);
            if (m < 0.5) this.placeLabelOutside(lab, y, 0.9, CFG.R + 3.2);
            else lab.position.set(colX[0] - 3.4, y, 0.4);
            lab.material.opacity = Math.min(1, (win - age) / FADE);
            lab.visible = true;
            used.add(lab);
        }
        for (const s of this.blockLabels.values()) if (!used.has(s)) s.visible = false;
    }

    /** The top of the tower is "now" on the replayed timeline. Flushes the ring batch. */
    private updateClock(m: number, dt: number) {
        const { state, fx, colX, colZ, ringLines } = this;
        const GOLD = this.pal.gold;
        const n = state.nodes.length;
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            if (j === 0 && m > 0.5) break;
            ringLines.push(colX[i], 0, colZ[i], colX[j], 0, colZ[j], GOLD, 0.6, GOLD, 0.6);
        }
        // flashy: a gold radar sweep circles the consensus clock, over a faint glowing disc
        if (fx && m < 0.5) {
            for (let s2 = 0; s2 < 16; s2++) {
                const a = state.realT * 1.2 - s2 * 0.035;
                const kf = 0.9 * (1 - s2 / 16);
                // prettier-ignore
                ringLines.push(0, 0, 0, Math.cos(a) * CFG.R, 0, Math.sin(a) * CFG.R,
                    GOLD, kf * 0.15, GOLD, kf);
            }
        }
        const disc = this.backdrop.nowDisc;
        disc.visible = m < 0.98;
        disc.scale.setScalar(CFG.R * (1 - m) + 0.01);
        disc.material.opacity = (this.pal.theme === "dark" ? 0.05 : 0.09) * (1 - m);
        if (fx) this.backdrop.tick(state.realT, dt);
        ringLines.flush();
        const label = this.nowLabel!;
        if (m < 0.5) this.placeLabelOutside(label, 0, -0.75, CFG.R + 4.5);
        else label.position.set(colX[n - 1] + 4.6, 0, 0.4);
    }

    private updateTrackMarker() {
        const { tracked, realT } = this.state;
        const { trackStar, trackHalo } = this;
        const on = !!tracked && tracked.frame === this.frameNo;
        trackStar.visible = on;
        trackHalo.visible = on;
        if (!on) return;
        trackStar.position.set(tracked.px, tracked.py, tracked.pz);
        trackHalo.position.copy(trackStar.position);
        trackHalo.scale.setScalar(this.fx ? 0.5 + 0.15 * Math.sin(realT * 4) : 0.5);
        trackStar.rotation.y = this.fx ? realT * 2 : 0;
        trackHalo.quaternion.copy(this.camera.quaternion);
    }

    // =================================================================
    // Picking
    // =================================================================

    /** The node or transaction under a canvas-relative point (screen-space distance test). */
    pick(mx: number, my: number): Hover | null {
        const W = this.canvas.clientWidth;
        const H = this.canvas.clientHeight;
        const v3 = this.v3;
        const dist2 = (x: number, y: number, z: number) => {
            v3.set(x, y, z).project(this.camera);
            if (v3.z > 1) return Infinity;
            const dx = ((v3.x + 1) / 2) * W - mx;
            const dy = ((1 - v3.y) / 2) * H - my;
            return dx * dx + dy * dy;
        };
        let best: Hover | null = null;
        let bd = 14 * 14;
        for (const nd of this.state.nodes) {
            const d = dist2(this.colX[nd.i], CFG.NODE_Y, this.colZ[nd.i]);
            if (d < bd) {
                bd = d;
                best = { type: "node", node: nd };
            }
        }
        if (best) return best;
        bd = 9 * 9;
        for (const tx of this.visible) {
            const d = dist2(tx.px, tx.py, tx.pz);
            if (d < bd) {
                bd = d;
                best = { type: "tx", tx };
            }
        }
        return best;
    }

    /** Screen positions of the nodes and the newest transactions, for the view-switch animation. */
    sample(limit: number): MorphSample {
        const W = this.canvas.clientWidth;
        const H = this.canvas.clientHeight;
        const v = this.v3;
        const light = this.pal.theme === "light";
        const point = (x: number, y: number, z: number, color: string): MorphPoint => {
            v.set(x, y, z).project(this.camera);
            return { x: ((v.x + 1) / 2) * W, y: ((1 - v.y) / 2) * H, color, hidden: v.z > 1 };
        };
        const nodes = new Map<HNode, MorphPoint>();
        for (const nd of this.state.nodes)
            nodes.set(
                nd,
                point(
                    this.colX[nd.i],
                    CFG.NODE_Y,
                    this.colZ[nd.i],
                    this.fx ? nd.hexFx : this.pal.nodeHex(nd),
                ),
            );
        const txs: MorphSample["txs"] = [];
        for (const tx of this.visible) {
            if (txs.length >= limit) break; // newest first
            const p = point(tx.px, tx.py, tx.pz, light ? tx.kind.hexLight : tx.kind.hex);
            if (!p.hidden && p.x > -20 && p.x < W + 20 && p.y > -20 && p.y < H + 20)
                txs.push({ ...p, tx });
        }
        return { nodes, txs };
    }

    dispose() {
        this.controls.dispose();
        this.removeBlockLabels([...this.blockLabels.keys()]);
        for (const lb of this.lines) lb.dispose();
        this.composer.dispose();
    }
}
