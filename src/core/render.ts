// 점토(클레이) 느낌 렌더 설정 — reference-code/clay.js를 옮김.
// 부드러운 빛 + 방 반사 + 부드러운 그림자. 캐릭터는 그림자를 받지 않게(줄무늬 방지).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

THREE.ColorManagement.legacyMode = false;

export interface RenderOpts {
  /** 그림자 해상도(폰은 낮춤) */
  shadowSize?: number;
  pixelRatio?: number;
  preserve?: boolean;
}

export function renderer(canvas: HTMLCanvasElement, W: number, H: number, o: RenderOpts = {}): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: !!o.preserve, powerPreference: 'high-performance' });
  r.setPixelRatio(o.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2));
  r.setSize(W, H, false);
  r.outputEncoding = THREE.sRGBEncoding;
  r.toneMapping = THREE.NoToneMapping;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  // 실제 사이트에서는 셰이더 오류 검사를 끈다(입장 속도)
  if (!import.meta.env.DEV) r.debug.checkShaderErrors = false;
  return r;
}

let ENV: THREE.Texture | null = null;
let ENV_R: THREE.WebGLRenderer | null = null;
export function envTexture(r: THREE.WebGLRenderer): THREE.Texture {
  if (!ENV || ENV_R !== r) {
    const pm = new THREE.PMREMGenerator(r);
    const e = new RoomEnvironment();
    e.traverse((m) => {
      const mm = (m as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if ((m as THREE.Mesh).isMesh && mm && mm.emissive) mm.emissiveIntensity *= 0.35;
    });
    ENV = pm.fromScene(e, 0.04).texture;
    ENV_R = r;
    pm.dispose();
  }
  return ENV;
}

export interface LightOpts {
  sun?: [number, number, number];
  box?: number;
  k?: number;
  target?: [number, number, number];
  env?: number;
  shadowSize?: number;
}

export interface Lights {
  group: THREE.Group;
  sun: THREE.DirectionalLight;
}

/** clay.js lightUp(): 반구광 + 그림자 내는 해 + 반대쪽 보조광 */
export function lightUp(r: THREE.WebGLRenderer, scene: THREE.Scene, o: LightOpts = {}): Lights {
  const sunP = o.sun ?? [-4, 10, 7], box = o.box ?? 12, k = o.k ?? 0.55, target = o.target ?? [0, 0, 0], env = o.env ?? 0.9;
  scene.environment = envTexture(r);
  const group = new THREE.Group();
  group.name = 'lights';
  group.add(new THREE.HemisphereLight(0xffffff, 0xe3d8c6, 0.3 * env));
  const d = new THREE.DirectionalLight(0xfff3e2, k);
  d.position.set(...sunP);
  d.target.position.set(...target);
  group.add(d, d.target);
  d.castShadow = true;
  const ss = o.shadowSize ?? 2048;
  d.shadow.mapSize.set(ss, ss);
  d.shadow.radius = 6;
  d.shadow.bias = -0.0004;
  d.shadow.normalBias = 0.02;
  Object.assign(d.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: 0.5, far: 80 });
  d.shadow.camera.updateProjectionMatrix();
  const f = new THREE.DirectionalLight(0xdfe9ff, 0.3);
  f.position.set(-sunP[0], 5, -sunP[2]);
  group.add(f);
  scene.add(group);
  return { group, sun: d };
}

export function perspCam(W: number, H: number, fov: number, pos: [number, number, number], target: [number, number, number]): THREE.PerspectiveCamera {
  const c = new THREE.PerspectiveCamera(fov, W / H, 0.1, 300);
  c.position.set(...pos);
  c.lookAt(...target);
  return c;
}

/** 화면 좌표(px) */
export function toScreen(cam: THREE.Camera, v: THREE.Vector3, W: number, H: number): [number, number, boolean] {
  const p = v.clone().project(cam);
  return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H, p.z < 1];
}
