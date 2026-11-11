// (주)무한채용 3D — 만화풍(툰) 캐릭터와 소품. 2D 시안(art.js)의 생김새를 그대로 3D로 옮긴 것.
// 규칙: 몸은 매끈한 도형 몇 개(공·캡슐·회전체·튜브)로만 만들고, 모든 조각에 같은 진한 외곽선(뒤집은 껍데기)을 두른다.
// 명암은 3단(툰). 셔츠 V·넥타이·라펠은 몸통 표면에 셰이더로 칠한다(경계가 또렷).
import * as THREE from 'three';
import { RoundedBoxGeometry } from './RoundedBoxGeometry.js';
export { THREE, RoundedBoxGeometry };
THREE.ColorManagement.legacyMode = false;

export const OL = 0x3a2f3d;
export const SUITS = { navy: 0x33467a, charcoal: 0x4a4e58, gray: 0x8a91a0, black: 0x2c2e35, beige: 0xdcc29b, pink: 0xe9a9b4 };
export const TIES = [0xe5484d, 0x3d8bd9, 0x3aa76d, 0xf0b63c];
export const SKIN = 0xffe1cf, HAIR_M = 0x3b2b27, HAIR_F = 0x5b3a2d, HAIR_G = 0x8d8a88;

/* ---------------- 재질 ---------------- */
let GRAD, GRAD_S;
function gradSkin() {   // 얼굴·손: 거의 고른 살색(아주 옅은 그늘 한 단)
  if (GRAD_S) return GRAD_S;
  const d = new Uint8Array([232, 232, 232, 255, 255, 255, 255, 255]);
  GRAD_S = new THREE.DataTexture(d, 2, 1, THREE.RGBAFormat); GRAD_S.minFilter = GRAD_S.magFilter = THREE.NearestFilter; GRAD_S.needsUpdate = true;
  return GRAD_S;
}
const SKIN_M = new THREE.MeshBasicMaterial({ color: SKIN });
const SKIN_C = new THREE.MeshStandardMaterial({ color: 0xffdcc6, roughness: .55, envMapIntensity: .35 });
export const skinMat = () => STYLE === 'clay' ? SKIN_C : SKIN_M;   // 얼굴·손은 명암 없이 한 색
function grad() {
  if (GRAD) return GRAD;
  const d = new Uint8Array([170, 170, 170, 255, 222, 222, 222, 255, 255, 255, 255, 255]);
  GRAD = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat); GRAD.minFilter = GRAD.magFilter = THREE.NearestFilter; GRAD.needsUpdate = true;
  return GRAD;
}
export let STYLE = 'clay';
export function setStyle(s) { STYLE = s; }
const cache = new Map();
export function toon(c, extra = {}) {
  const key = STYLE + c + JSON.stringify(extra);
  if (!cache.has(key)) {
    if (STYLE === 'clay') { const { gradientMap, ...rest } = extra; cache.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: .62, metalness: 0, envMapIntensity: .4, ...rest })); }
    else cache.set(key, new THREE.MeshToonMaterial({ color: c, gradientMap: grad(), ...extra }));
  }
  return cache.get(key);
}
export const flat = c => new THREE.MeshBasicMaterial({ color: c });
const OUT = new Map();
/** 외곽선 재질: 법선 방향으로 t만큼 부풀린 뒷면 */
function outlineMat(t) {
  if (!OUT.has(t)) {
    const m = new THREE.MeshBasicMaterial({ color: OL, side: THREE.BackSide });
    m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normal * ${t.toFixed(4)};`); };
    m.customProgramCacheKey = () => 'ol' + t;
    OUT.set(t, m);
  }
  return OUT.get(t);
}
/** 조각 하나: 메시 + 외곽선 */
export function part(geo, mat, parent, { x = 0, y = 0, z = 0, ol = .014, shadow = true, olGeo } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = false;
  if (ol > 0 && STYLE !== 'clay') { const o = new THREE.Mesh(olGeo || geo, outlineMat(ol)); o.castShadow = false; m.add(o); }
  if (parent) parent.add(m);
  return m;
}
/** 타원체(크기를 도형에 구워 넣어 외곽선 굵기가 고르게) */
export function ellipsoid(rx, ry, rz, ws = 48, hs = 32) { const g = new THREE.SphereGeometry(1, ws, hs); g.scale(rx, ry, rz); g.computeVertexNormals(); return g; }
/** 두 점을 잇는 캡슐(둥근 끝) */
export function capsuleBetween(a, b, r, parent, mat, ol) {
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(.0001, L), 10, 24);
  const m = part(g, mat, parent, { ol });
  m.position.copy(a).addScaledVector(d, .5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
/** 곡선을 따라 가는 굵은 관 + 양 끝 공(팔: 이음매 없이 휘어짐) */
export function limbAlong(pts, r, parent, mat, ol) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const g = new THREE.TubeGeometry(curve, 40, r, 24, false);
  part(g, mat, parent, { ol });
  part(new THREE.SphereGeometry(r, 24, 16), mat, parent, { ...xyz(pts[0]), ol });
  return curve;
}
const xyz = v => ({ x: v.x, y: v.y, z: v.z });

/* ---------------- 몸통(재킷) ---------------- */
// 둥근 사다리꼴을 돌려 만든 회전체. 앞(+z)에 셔츠 V·넥타이·라펠·단추를 셰이더로 칠한다.
function torsoMat(suit, o) {
  const base = new THREE.Color(suit), dark = base.clone().multiplyScalar(.78), tie = new THREE.Color(o.tie ?? TIES[0]);
  const m = STYLE === 'clay' ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .66, envMapIntensity: .4 }) : new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad() });
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uSuit: { value: base }, uDark: { value: dark }, uTie: { value: tie }, uFem: { value: o.sex === 'f' ? 1 : 0 }, uBack: { value: 0 }, uOL: { value: new THREE.Color(OL) } });
    sh.vertexShader = 'varying vec3 vOP;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP = position;');
    sh.fragmentShader = 'varying vec3 vOP;\nuniform vec3 uSuit,uDark,uTie,uOL;uniform float uFem;\n' + sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
      vec3 col = uSuit; float x = vOP.x, y = vOP.y, ax = abs(x);
      if (vOP.z > 0.0) {
        float top = 0.675, tip = uFem > .5 ? 0.47 : 0.44;                  // V의 꼭짓점 높이
        float vHalf = (y - tip) / (top - tip) * 0.105;                      // V 반쪽 폭
        bool inV = y > tip && ax < vHalf;
        bool lapel = y > tip - 0.03 && ax >= vHalf && ax < vHalf + 0.05 && y > 0.5;
        if (lapel) col = uDark;
        if (inV) {
          col = vec3(1.0);
          if (uFem < .5) {                                                   // 넥타이: 매듭 + 아래로 넓어졌다 뾰족
            float knot = 0.645, tw = y > knot ? 0.026 : mix(0.04, 0.018, (y - tip) / (knot - tip));
            if (y > tip + 0.012 && ax < tw && y < 0.672) col = uTie;
            if (abs(y - knot) < 0.0025 && ax < 0.03) col = uOL;
          } else {
            if (length(vec2(x, y - 0.5)) < 0.011) col = vec3(0.95, 0.77, 0.42);   // 브로치
          }
        }
        if (!inV && y < tip && y > 0.26 && ax < 0.0035) col = uOL;            // 앞여밈
        if (length(vec2(x + 0.035, y - 0.39)) < 0.009 || length(vec2(x + 0.035, y - 0.33)) < 0.009) col = uOL;   // 단추
        if (abs(y - 0.262) < 0.004) col = uDark;                               // 밑단 선
      } else {
        if (ax < 0.003 && y < 0.5) col = uDark;                                 // 등 솔기
        if (y > 0.655 && ax < 0.1) col = vec3(1.0);                             // 뒤 칼라
      }
      vec4 diffuseColor = vec4( col, opacity );`);
  };
  m.customProgramCacheKey = () => 'torso' + STYLE;
  return m;
}
function torsoGeo() {
  const prof = [[0, .25], [.2, .255], [.235, .28], [.245, .4], [.255, .54], [.245, .62], [.2, .665], [.12, .685], [0, .69]];
  const curve = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getPoints(60).map(p => new THREE.Vector2(Math.max(0, p.x), p.y));
  const g = new THREE.LatheGeometry(pts, 72); g.scale(1, 1, .72); g.computeVertexNormals();
  return g;
}

/* ---------------- 머리 ---------------- */
const HC = 1.0, HX = .43, HY = .39, HZ = .40;
// 머리카락: 머리보다 조금 큰 공을, 머리선 아래에서는 안쪽으로 밀어 넣는다(닫힌 면이라 외곽선이 깔끔)
function hairGeo(region, k = 1.06, flare = 0, inner = .97) {   // region(az, y) > 0 이면 머리카락
  const g = new THREE.SphereGeometry(1, 320, 240), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), az = Math.atan2(x, z);      // az=0 이 앞
    const t = THREE.MathUtils.smoothstep(region(az, y), -.015, .015);
    const kk = inner + (k - inner) * t;
    const fl = 1 + flare * Math.max(0, -y) * t;
    p.setXYZ(i, x * HX * kk * fl, y * HY * kk, z * HZ * kk * fl);
  }
  g.computeVertexNormals();
  return g;
}
const mixA = (front, side, back, az) => { const c = Math.cos(az); return c >= 0 ? side + (front - side) * c : side + (back - side) * -c; };

const hairPart = (reg, k, fl, mat, H) => part(hairGeo(reg, k, fl), mat, H, { ol: .016, olGeo: hairGeo(reg, k, fl, .8) });
function head(g, o) {
  const H = new THREE.Group(); H.position.y = HC; g.add(H);
  const skin = skinMat(), hairC = o.hairC ?? (o.sex === 'f' ? HAIR_F : HAIR_M), hairM = toon(hairC);
  part(ellipsoid(HX, HY, HZ, 64, 48), skin, H, { ol: .016 });
  if (o.sex !== 'f') for (const s of [-1, 1]) part(ellipsoid(.06, .085, .05), skin, H, { x: s * .42, y: .02, ol: .012 });
  // 얼굴: 눈(세로 타원 + 반짝이 2개), 볼, 입, 눈썹 — 얼굴 표면 바로 위
  const onFace = (x, y) => { const zz = HZ * Math.sqrt(Math.max(0, 1 - (x / HX) ** 2 - (y / HY) ** 2)); return zz; };
  const eyeM = flat(OL), white = flat(0xffffff), blush = flat(0xffa79c);
  for (const s of [-1, 1]) {
    const ex = s * .15, ey = .06, ez = onFace(ex, ey);
    if (o.closed) { const t = new THREE.Mesh(new THREE.TorusGeometry(.04, .009, 8, 20, Math.PI), eyeM); t.position.set(ex, ey - .01, ez); H.add(t); }
    else {
      const e = new THREE.Mesh(ellipsoid(.045, .058, .02, 24, 16), eyeM); e.position.set(ex, ey, ez - .004); e.lookAt(e.position.clone().multiplyScalar(2)); H.add(e);
      const w1 = new THREE.Mesh(new THREE.SphereGeometry(.017, 12, 8), white); w1.position.set(ex + .015, ey + .022, ez + .012); H.add(w1);
      const w2 = new THREE.Mesh(new THREE.SphereGeometry(.008, 10, 6), white); w2.position.set(ex - .014, ey - .02, ez + .012); H.add(w2);
    }
    const bx = s * .25, by = -.11, bz = onFace(bx, by), nrm = new THREE.Vector3(bx / HX ** 2, by / HY ** 2, bz / HZ ** 2).normalize();
    const b = new THREE.Mesh(ellipsoid(.08, .05, .05, 24, 16), blush); b.position.set(bx, by, bz).addScaledVector(nrm, -.042); b.lookAt(b.position.clone().add(nrm)); H.add(b);
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(.009, .055, 4, 10), toon(hairC === HAIR_G ? 0x6d6a68 : hairC)); brow.rotation.z = Math.PI / 2 + s * -.12; brow.position.set(s * .15, .17, onFace(s * .15, .17) + .004); H.add(brow);
  }
  if (o.mouth === 'open') { const m = new THREE.Mesh(new THREE.SphereGeometry(.05, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), flat(0xc4574f)); m.scale.set(1.15, .9, .35); m.position.set(0, -.15, onFace(0, -.15) - .006); H.add(m); }
  else { const m = new THREE.Mesh(new THREE.TorusGeometry(.04, .009, 8, 24, Math.PI * .8), flat(0xb2524b)); m.rotation.z = Math.PI + Math.PI * .1; m.position.set(0, -.13, onFace(0, -.13) + .004); H.add(m); }
  if (o.glasses) {
    const gm = flat(OL);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(.085, .011, 8, 32), gm); r.position.set(s * .15, .06, onFace(s * .15, .06) + .03); H.add(r); }
    const br = new THREE.Mesh(new THREE.CapsuleGeometry(.008, .06, 4, 8), gm); br.rotation.z = Math.PI / 2; br.position.set(0, .07, onFace(0, .07) + .03); H.add(br);
  }
  // 머리카락
  if (o.bald) {
    hairPart((az, y) => Math.min((Math.abs(az) - 1.25) * .5, (2.6 - Math.abs(az)) * .5, .42 - y, y + .2), 1.05, 0, hairM, H);
  } else if (o.sex === 'f') {
    // 단발: 정수리에서 턱선까지, 앞은 일자 앞머리(눈썹 위), 얼굴 부분만 비움
    const reg = (az, y) => Math.min(Math.max(y - .31, (Math.abs(az) - 1.1) * .55), y + .64);
    hairPart(reg, 1.09, .12, hairM, H);
  } else {
    // 옆으로 넘긴 짧은 머리: 앞 이마 위(왼쪽이 조금 더 내려옴), 옆은 귀 위, 뒤는 목덜미
    const fr = az => .34 + .13 * Math.tanh(az * 2.2) - .06 * Math.exp(-((az + .35) ** 2) / .03);   // 왼쪽으로 쓸어내린 앞머리
    const line = (az) => mixA(fr(az), .14, -.42, az);
    hairPart((az, y) => y - line(az), 1.05, 0, hairM, H);
    const tuft = new THREE.CatmullRomCurve3([new THREE.Vector3(0, .4, .02), new THREE.Vector3(.03, .5, .03), new THREE.Vector3(.1, .53, .05)]);
    part(new THREE.TubeGeometry(tuft, 16, .016, 10, false), hairM, H, { ol: .01 });
  }
  return H;
}

/* ---------------- 사람 ---------------- */
/**
 * o: { sex:'m'|'f', suit:'navy'.., tie, hairC, glasses, bald, pose, mouth, closed, card }
 * pose: stand | walk | wave | beckon | cup | cheers | card | clap | point | sit | sitType
 * 앞은 +z. 발바닥이 y=0. 키 약 1.5.
 */
export function worker(o = {}) {
  o = { sex: 'm', suit: 'navy', pose: 'stand', ...o };
  const suitC = typeof o.suit === 'number' ? o.suit : SUITS[o.suit];
  const g = new THREE.Group(), sit = o.pose === 'sit' || o.pose === 'sitType';
  const suitM = toon(suitC), pantsM = toon(new THREE.Color(suitC).multiplyScalar(.82).getHex()), skin = skinMat(), shoeM = toon(0x3d3130);
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // 다리
  const walk = o.pose === 'walk' ? .09 : 0;
  for (const s of [-1, 1]) {
    if (sit) {
      capsuleBetween(V(s * .09, .3, 0), V(s * .09, .3, .3), .078, g, pantsM, .014);
      capsuleBetween(V(s * .09, .3, .3), V(s * .09, .08, .32), .07, g, pantsM, .014);
      part(ellipsoid(.085, .055, .12), shoeM, g, { x: s * .09, y: .07, z: .37 });
    } else {
      const fz = s * walk;
      capsuleBetween(V(s * .09, .3, 0), V(s * .09, .13, fz), .078, g, pantsM, .014);
      part(ellipsoid(.088, .058, .125), shoeM, g, { x: s * .09, y: .078, z: fz + .04 });
    }
  }
  // 몸통
  part(torsoGeo(), torsoMat(suitC, o), g, { ol: .016 });
  // 사원증과 목줄
  if (o.card !== false) {
    const card = new THREE.Group(); card.position.set(-.13, .4, .17); card.rotation.set(-.08, -.25, .05); g.add(card);
    part(new RoundedBoxGeometry(.085, .11, .012, 2, .012), toon(0xffffff), card, { ol: .008 });
    const band = new THREE.Mesh(new THREE.PlaneGeometry(.085, .025), flat(0x1d2b4f)); band.position.set(0, .04, .0075); card.add(band);
    const ph = new THREE.Mesh(new THREE.CircleGeometry(.016, 16), flat(0xf5c9b3)); ph.position.set(0, .002, .0075); card.add(ph);
    const lan = new THREE.CatmullRomCurve3([V(-.1, .66, .1), V(-.13, .56, .155), V(-.135, .46, .175)]);
    part(new THREE.TubeGeometry(lan, 16, .008, 8, false), toon(0x4c8fe0), g, { ol: 0 });
  }
  // 팔: 어깨 → 팔꿈치 → 손목, 이음매 없는 관 + 손(공)
  const P = o.pose;
  let arms = { L: [V(-.3, .45, .02), V(-.33, .3, .03)], R: [V(.3, .45, .02), V(.33, .3, .03)] };
  if (P === 'walk') arms = { L: [V(-.3, .45, -.05), V(-.31, .31, -.1)], R: [V(.3, .45, .07), V(.3, .32, .13)] };
  if (P === 'wave') arms.R = [V(.38, .66, .03), V(.44, .88, .05)];
  if (P === 'beckon') arms.R = [V(.36, .5, .14), V(.36, .72, .2)];
  if (P === 'cup') arms.R = [V(.27, .42, .16), V(.14, .47, .27)];
  if (P === 'cheers') arms.R = [V(.36, .58, .1), V(.4, .78, .16)];
  if (P === 'card') arms.R = [V(.32, .5, .16), V(.36, .53, .36)];
  if (P === 'clap') arms = { L: [V(-.24, .42, .17), V(-.04, .5, .26)], R: [V(.24, .42, .17), V(.04, .5, .26)] };
  if (P === 'point') arms.R = [V(.36, .53, .12), V(.52, .58, .22)];
  if (sit) arms = { L: [V(-.27, .42, .16), V(-.17, .42, .32)], R: [V(.27, .42, .16), V(.17, .42, .32)] };
  const hands = {};
  for (const [k, s] of [['L', -1], ['R', 1]]) {
    const sh = V(s * .1, .56, 0), [el, wr] = arms[k];
    const dir = wr.clone().sub(el).normalize(), cuffEnd = wr.clone().addScaledVector(dir, -.045);
    limbAlong([sh, V(s * .23, .57, 0).lerp(el, .25), el, cuffEnd], .066, g, suitM, .014);
    hands[k] = part(new THREE.SphereGeometry(.068, 28, 20), skin, g, { ...xyz(wr), ol: .013 });
  }
  // 손에 든 것
  const cup = (h, lift = 0) => {
    const c = new THREE.Group(); c.position.copy(h.position).add(V(0, .055 + lift, .05)); g.add(c);
    part(new THREE.CylinderGeometry(.05, .04, .12, 28), toon(0xffffff), c, { ol: .01 });
    const cof = new THREE.Mesh(new THREE.CylinderGeometry(.046, .046, .005, 24), flat(0x8a5a35)); cof.position.y = .058; c.add(cof);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(.051, .046, .045, 28), toon(0xc98b55)); sl.position.y = -.005; c.add(sl);
    return c;
  };
  if (P === 'cup') cup(hands.R);
  if (P === 'cheers') cup(hands.R, .02);
  if (P === 'card') { const c = part(new RoundedBoxGeometry(.11, .075, .012, 2, .012), toon(0xffffff), g, { ...xyz(hands.R.position), ol: .008 }); c.position.add(V(.02, .04, .03)); c.rotation.set(-.3, .2, .3); }
  // 머리
  const H = head(g, o);
  if (P === 'wave' || P === 'cheers') H.rotation.z = -.06;
  if (o.blob !== false && !sit) { const b = blob(.36, .2); b.position.y = .003; g.add(b); }
  g.userData = { head: H, hands };
  return g;
}

/* ---------------- 장면 도우미 ---------------- */
let BLOBT;
/** 바닥의 둥근 그림자(그림자 계산 대신 써서 깔끔하다) */
export function blob(rx, rz, a = .16) {
  if (!BLOBT) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 10, 64, 64, 64); gr.addColorStop(0, 'rgba(58,47,61,1)'); gr.addColorStop(.6, 'rgba(58,47,61,.75)'); gr.addColorStop(1, 'rgba(58,47,61,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); BLOBT = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), new THREE.MeshBasicMaterial({ map: BLOBT, transparent: true, opacity: a, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = -1; return m;
}
export function setup(canvas, W, H, bg = 0xf6efe3) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(window.devicePixelRatio || 1); r.setSize(W, H);
  r.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(bg);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xe6dccb, .42));
  const sun = new THREE.DirectionalLight(0xffffff, .62); sun.position.set(-2, 6, 8); scene.add(sun, sun.target);
  const cam = new THREE.PerspectiveCamera(30, W / H, .1, 200);
  return { r, scene, cam, sun };
}
/** 둥근 상자(바닥 기준 y) + 외곽선 */
export function rbox(parent, w, h, d, c, x, y, z, rad = .05, ol = .012) {
  const m = part(new RoundedBoxGeometry(w, h, d, 3, Math.min(rad, w / 2, h / 2, d / 2)), typeof c === 'number' ? toon(c) : c, parent, { x, y: y + h / 2, z, ol });
  m.receiveShadow = true; return m;
}
export function floorPlane(parent, w, d, c, x = 0, z = 0, tex) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), tex ? new THREE.MeshToonMaterial({ map: tex, gradientMap: grad() }) : toon(c));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.receiveShadow = true; parent.add(m); return m;
}
export function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); }
  return t;
}
/** 화면 좌표(px) */
export function toScreen(cam, v, W, H) { const p = v.clone().project(cam); return [(p.x + 1) / 2 * W, (1 - p.y) / 2 * H]; }
