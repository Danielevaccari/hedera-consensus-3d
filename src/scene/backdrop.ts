// Flashy-mode backdrop: a starfield, a slowly shifting nebula and a glowing disc at the clock.
import {
    AdditiveBlending,
    BackSide,
    BufferAttribute,
    BufferGeometry,
    CircleGeometry,
    Color,
    DoubleSide,
    Group,
    Mesh,
    MeshBasicMaterial,
    Points,
    PointsMaterial,
    ShaderMaterial,
    SphereGeometry,
} from "three";
import { GOLD } from "./colors";

function createStars() {
    const N = 2600;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const c = new Color();
    for (let i = 0; i < N; i++) {
        const r = 140 + Math.random() * 160;
        const th = Math.random() * Math.PI * 2;
        const ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = r * Math.cos(ph) - 20;
        pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
        c.setHSL(0.55 + Math.random() * 0.3, 0.7, 0.55 + Math.random() * 0.4);
        col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("color", new BufferAttribute(col, 3));
    const mat = new PointsMaterial({
        size: 0.9,
        vertexColors: true,
        transparent: true,
        opacity: 0.7,
        fog: false,
        depthWrite: false,
    });
    return new Points(g, mat);
}

const NEBULA_VERTEX = /* glsl */ `
varying vec3 vP;
void main() {
    vP = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const NEBULA_FRAGMENT = /* glsl */ `
uniform float t;
varying vec3 vP;
void main() {
    float a = 0.5 + 0.5 * sin(vP.x * 3.1 + t * 0.05) * sin(vP.y * 2.3 - t * 0.04);
    float b = 0.5 + 0.5 * sin(vP.z * 2.7 - t * 0.03 + vP.y * 1.7);
    vec3 col = mix(vec3(0.008, 0.01, 0.035), vec3(0.075, 0.02, 0.14), a * a);
    col = mix(col, vec3(0.01, 0.08, 0.13), b * b * 0.55);
    gl_FragColor = vec4(col, 1.0);
}`;

export function createBackdrop() {
    const group = new Group();
    const stars = createStars();
    const nebulaMat = new ShaderMaterial({
        uniforms: { t: { value: 0 } },
        vertexShader: NEBULA_VERTEX,
        fragmentShader: NEBULA_FRAGMENT,
        side: BackSide,
        depthWrite: false,
    });
    const nebula = new Mesh(new SphereGeometry(320, 48, 32), nebulaMat);
    const nowDisc = new Mesh(
        new CircleGeometry(1, 96),
        new MeshBasicMaterial({
            color: GOLD,
            transparent: true,
            opacity: 0.05,
            side: DoubleSide,
            blending: AdditiveBlending,
            depthWrite: false,
        }),
    );
    nowDisc.rotation.x = -Math.PI / 2;
    group.add(stars, nebula, nowDisc);

    return {
        group,
        nowDisc,
        tick(realT: number, dt: number) {
            stars.rotation.y += dt * 0.004;
            nebulaMat.uniforms.t.value = realT;
        },
    };
}
