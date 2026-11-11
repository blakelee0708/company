// 점토(클레이) 느낌 렌더 설정: 부드러운 빛 + 방 반사 + 부드러운 그림자. 캐릭터는 그림자를 받지 않게(줄무늬 방지).
import { THREE } from './toon.js';
import { RoomEnvironment } from './RoomEnvironment.js';
export function renderer(canvas, W, H) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(window.devicePixelRatio || 1); r.setSize(W, H);
  r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.NoToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}
let ENV;
export function lightUp(r, scene, { sun = [-4, 10, 7], box = 12, k = .55, target = [0, 0, 0], env = .9 } = {}) {
  if (!ENV) { const pm = new THREE.PMREMGenerator(r); const e = new RoomEnvironment(); e.traverse(m => { if (m.isMesh && m.material.emissive) m.material.emissiveIntensity *= .35; }); ENV = pm.fromScene(e, .04).texture; }
  scene.environment = ENV;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe3d8c6, .3 * env));
  const d = new THREE.DirectionalLight(0xfff3e2, k); d.position.set(...sun); d.target.position.set(...target); scene.add(d, d.target);
  d.castShadow = true; d.shadow.mapSize.set(2048, 2048); d.shadow.radius = 6; d.shadow.bias = -.0004; d.shadow.normalBias = .02;
  Object.assign(d.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: .5, far: 80 }); d.shadow.camera.updateProjectionMatrix();
  const f = new THREE.DirectionalLight(0xdfe9ff, .3); f.position.set(-sun[0], 5, -sun[2]); scene.add(f);
}
export function studio(canvas, W, H, bg = 0xf3efe8) {
  const r = renderer(canvas, W, H), scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0xece4d8, roughness: .9 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; fl.material.envMapIntensity = .3; scene.add(fl);
  lightUp(r, scene, { box: 6 });
  const cam = new THREE.PerspectiveCamera(34, W / H, .1, 200);
  return { r, scene, cam };
}
