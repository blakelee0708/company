// (주)무한채용 3D 장면 — 점토(클레이) 느낌. 캐릭터는 toon.js(매끈한 몸), 빛·그림자는 clay.js.
// 로비: 천장 12m 대기업 로비(유리 커튼월, 큰 기둥, 스피드 게이트 6개, 엘리베이터 홀).
// 사무실: 칸막이로 나뉜 개인 자리(책상·서랍·듀얼 모니터·의자), 팀마다 마주 보는 두 줄, 맨 안쪽 부장 자리.
import { THREE, RoundedBoxGeometry, worker, part, toon, flat, canvasTex, toScreen, TIES } from './toon.js';
import { renderer, lightUp } from './clay.js';
export { THREE, toScreen, worker, renderer, lightUp };

export const ME = { suit: 'navy', tie: TIES[0] };
export const BOSS = { suit: 'gray', tie: TIES[1], glasses: true, bald: true, hairC: 0x8d8a88 };
export const MGR = { sex: 'f', suit: 'black', glasses: true };
export const NPC = [
  { suit: 'charcoal', tie: TIES[1] }, { sex: 'f', suit: 'navy' }, { suit: 'gray', tie: TIES[2] }, { sex: 'f', suit: 'pink' },
  { suit: 'black', tie: TIES[3] }, { sex: 'f', suit: 'charcoal' }, { suit: 'navy', tie: TIES[0], glasses: true }, { sex: 'f', suit: 'beige' },
];
const SC = 1.22;

/* ---------- 기본 도형 ---------- */
const M = (c, rough = .7, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, metalness: 0, envMapIntensity: .4, ...extra });
const MC = new Map(); const mat = (c, r = .7, e) => { const k = c + '|' + r + JSON.stringify(e || {}); if (!MC.has(k)) MC.set(k, M(c, r, e)); return MC.get(k); };
function box(parent, w, h, d, c, x, y, z, rad = .03, o = {}) {   // 바닥 기준 y
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(rad, w / 2.01, h / 2.01, d / 2.01)), typeof c === 'number' ? mat(c, o.rough ?? .7) : c);
  m.position.set(x, y + h / 2, z); m.castShadow = o.cast ?? true; m.receiveShadow = o.recv ?? true; parent.add(m); return m;
}
function plane(parent, w, h, c, x, y, z, ry = 0, emissive) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), typeof c === 'number' ? (emissive ? new THREE.MeshBasicMaterial({ color: c }) : mat(c, .9)) : c);
  m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = !emissive; parent.add(m); return m;
}
function floorTex(draw, rep) { return canvasTex(512, 512, draw, rep); }
function floor(scene, w, d, tex, x = 0, z = 0, c = 0xffffff) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ color: c, map: tex || null, roughness: .85, envMapIntensity: .3 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0, z); m.receiveShadow = true; scene.add(m); return m;
}
function ceiling(scene, w, d, y, x = 0, z = 0, lights = []) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(0xf4f2ee, .95)); m.rotation.x = Math.PI / 2; m.position.set(x, y, z); scene.add(m);
  lights.forEach(([lx, lz, lw, ld]) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(lw, ld), new THREE.MeshBasicMaterial({ color: 0xffffff })); l.rotation.x = Math.PI / 2; l.position.set(lx, y - .01, lz); scene.add(l); });
}
function textTex(text, w, h, { bg = '#1d2b4f', fg = '#fff', size = 64, weight = 800 } = {}) {
  return canvasTex(w, h, (c) => { if (bg) { c.fillStyle = bg; c.fillRect(0, 0, w, h); } c.fillStyle = fg; c.font = `${weight} ${size}px P`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2); });
}
function sign(parent, text, w, h, x, y, z, o = {}) { const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: textTex(text, Math.round(w * 200), Math.round(h * 200), { size: Math.round(h * 120), ...o }), transparent: !o.bg && o.bg !== undefined })); p.position.set(x, y, z); if (o.ry) p.rotation.y = o.ry; parent.add(p); return p; }

function person(scene, o, x, z, ry = 0, extra = {}) {
  const sc = extra.sc || SC, sit = o.pose === 'sit' || o.pose === 'sitType', y = (extra.y || 0) + (sit ? .5 - .3 * sc : 0);
  const w = worker({ ...o, blob: false }); w.scale.setScalar(sc); w.position.set(x, y, z); w.rotation.y = ry; scene.add(w);
  w.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = false; } });
  w.userData.top = new THREE.Vector3(x, y + 1.45 * sc + .12, z);
  return w;
}
function ring(scene, x, z, r = .5) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - .06, r, 48), new THREE.MeshBasicMaterial({ color: 0x57b8ff })); m.rotation.x = -Math.PI / 2; m.position.set(x, .015, z); scene.add(m);
  const f = new THREE.Mesh(new THREE.CircleGeometry(r - .06, 48), new THREE.MeshBasicMaterial({ color: 0x57b8ff, transparent: true, opacity: .18, depthWrite: false })); f.rotation.x = -Math.PI / 2; f.position.set(x, .014, z); scene.add(f);
}
function plant(scene, x, z, s = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); scene.add(g);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.26, .2, .5, 28), mat(0xf2efe8, .6)); pot.position.y = .25; pot.castShadow = true; g.add(pot);
  for (const [px, py, pz, r] of [[-.16, .75, 0, .24], [.17, .78, .03, .24], [0, 1.02, 0, .28], [0, .8, .17, .22], [.05, 1.25, -.05, .2]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat(0x5fb86e, .75)); b.position.set(px, py, pz); b.castShadow = true; g.add(b); }
}
function chair(scene, x, z, ry = 0) {   // ry=0: 앉는 사람이 +z를 봄
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
  const k = 0x2c2f36;
  box(g, .54, .09, .5, k, 0, .44, 0, .04);
  box(g, .5, .62, .08, k, 0, .55, -.27, .05);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, .42, 12), mat(0x9aa0aa, .4)); c.position.y = .22; g.add(c);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, l = box(g, .05, .04, .3, k, Math.sin(a) * .14, .03, Math.cos(a) * .14, .015); l.rotation.y = a; }
  return g;
}
function monitor(parent, x, y, z, ry = 0, w = .56) {   // 화면이 +z
  const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry; parent.add(g);
  box(g, .16, .015, .12, 0x2b2e35, 0, 0, 0, .006); box(g, .04, .2, .03, 0x2b2e35, 0, 0, -.02, .01);
  box(g, w, w * .6, .035, 0x24262c, 0, .15, 0, .012);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w - .04, w * .6 - .04), new THREE.MeshBasicMaterial({ color: 0xcfe9ff })); s.position.set(0, .15 + w * .3, .019); g.add(s);
  for (const [lw, ly] of [[.5, .8], [.34, .62], [.42, .44]]) { const l = new THREE.Mesh(new THREE.PlaneGeometry((w - .1) * lw, .022), new THREE.MeshBasicMaterial({ color: 0x8fb6dd })); l.position.set(-(w - .1) * (1 - lw) / 2, .15 + w * .6 * ly, .02); g.add(l); }
  return g;
}
/** 칸막이 자리 하나(넓은 개인 자리). facing=+1 이면 사람이 -z(책상) 쪽을 보고 +z 쪽 의자에 앉는다. 칸막이는 책상 뒤(-z)와 왼쪽(-x)
 *  크기: 자리 폭 3.0, 책상 2.8 × 1.2(높이 0.72), 칸막이 높이 1.4 — 머리가 큰 캐릭터에 맞춰 실제보다 넓게 */
const PANEL = 0x8f99c6, FRAME = 0xd9dce2, WOOD = 0xdcb47c;
export const CUB = { W: 3.0, D: 1.2, SEAT: 1.05 };
function cubicle(scene, x, z, facing, o = {}) {
  const ang = o.ang ?? (facing > 0 ? 0 : Math.PI);
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ang; scene.add(g);
  const W = 2.8, D = 1.2, hw = CUB.W / 2, pz = -D / 2 - .05;
  // 책상, 다리판, 서랍장 두 개
  box(g, W, .045, D, WOOD, 0, .72, 0, .02, { rough: .55 });
  box(g, .05, .72, D - .1, FRAME, -W / 2 + .03, 0, 0, .01);
  box(g, .5, .64, D - .15, WOOD, W / 2 - .3, 0, -.02, .02, { rough: .6 });
  for (const yy of [.15, .34, .53]) box(g, .46, .008, .01, 0xa88456, W / 2 - .3, yy, (D - .15) / 2 - .02, .003);
  // 칸막이
  const ph = 1.4;
  box(g, CUB.W, ph, .07, PANEL, 0, 0, pz, .015, { rough: .95 });
  box(g, CUB.W + .04, .04, .1, FRAME, 0, ph, pz, .018); box(g, .05, ph + .04, .1, FRAME, -hw, 0, pz, .014); box(g, .05, ph + .04, .1, FRAME, hw, 0, pz, .014);
  if (o.side !== false) { box(g, .07, ph, D + .2, PANEL, -hw, 0, .05, .015, { rough: .95 }); box(g, .1, .04, D + .24, FRAME, -hw, ph, .05, .018); box(g, .1, ph + .04, .05, FRAME, -hw, 0, .05 + (D + .2) / 2, .014); }
  // 듀얼 모니터(조금 크게), 키보드·마우스, 노트, 소품
  monitor(g, -.36, .765, -.3, .14, .66); monitor(g, .36, .765, -.3, -.14, .66);
  box(g, .5, .02, .16, 0xf2f3f5, 0, .765, .2, .01); box(g, .08, .028, .11, 0xf2f3f5, .42, .765, .22, .02);
  box(g, .3, .015, .22, 0xffffff, -.85, .765, .18, .005);
  if (o.mug !== false) { const m = new THREE.Mesh(new THREE.CylinderGeometry(.05, .045, .11, 18), mat(o.mugC ?? 0xffffff, .5)); m.position.set(-1.15, .82, .1); m.castShadow = true; g.add(m); }
  if (o.memo) { const n = plane(g, .14, .14, 0xfff59a, -1.0, 1.1, pz + .04); n.rotation.z = .08; const n2 = plane(g, .14, .14, 0xffd1dc, -.8, 1.0, pz + .04); n2.rotation.z = -.1; const n3 = plane(g, .14, .14, 0xc9f2d4, 1.0, 1.15, pz + .04); n3.rotation.z = .05; }
  if (o.plant) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.06, .05, .1, 14), mat(0xffffff, .5)); p.position.set(-1.2, .815, -.35); g.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(.1, 16, 12), mat(0x5fb86e, .8)); b.position.set(-1.2, .94, -.35); g.add(b); }
  if (o.files) for (let i = 0; i < 4; i++) box(g, .06, .26, .22, [0x3d8bd9, 0x3aa76d, 0xe5484d, 0xf0b63c][i], .95 + i * .07, .765, -.38, .01);
  chair(scene, x + Math.sin(ang) * CUB.SEAT, z + Math.cos(ang) * CUB.SEAT, ang + Math.PI);
  return g;
}
function printer(scene, x, z) { box(scene, 1.0, .9, .7, 0xe9ebef, x, 0, z, .05, { rough: .4 }); box(scene, .8, .06, .5, 0xcfd3da, x, .9, z, .02); }

/* ================= 사무실 ================= */
// 자리 20개(1팀 7 · 2팀 7 · 3팀 6). 팀마다 칸막이를 사이에 두고 등을 맞댄 두 줄(안쪽 줄은 문 쪽을 보고 앉음).
export function office(o = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf1ede6);
  const tops = {};
  const carpet = floorTex((c, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 128 + ((i * 7 + j * 3) % 5) * 4; c.fillStyle = `rgb(${v},${v + 3},${v + 8})`; c.fillRect(i * 128, j * 128, 128, 128); } c.strokeStyle = 'rgba(0,0,0,.06)'; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 128, 0); c.lineTo(i * 128, h); c.stroke(); c.beginPath(); c.moveTo(0, i * 128); c.lineTo(w, i * 128); c.stroke(); } }, [9, 12]);
  const RW = 18, ZB = -19, ZF = 11, RD = ZF - ZB, ZC = (ZB + ZF) / 2;
  floor(scene, RW, RD, carpet, 0, ZC);
  const H3 = 3.1;
  plane(scene, RW, H3, 0xf6f4f0, 0, H3 / 2, ZB);
  plane(scene, RD, H3, 0xf3f1ec, -RW / 2, H3 / 2, ZC, Math.PI / 2); plane(scene, RD, H3, 0xf3f1ec, RW / 2, H3 / 2, ZC, -Math.PI / 2);
  ceiling(scene, RW, RD, H3, 0, ZC, [-5.5, 0, 5.5].flatMap(x => [-17, -12.5, -8, -3.5, 1, 5.5].map(z => [x, z, 1.4, .7])));
  for (const x of [-6.6, -2.2, 2.2, 6.6]) { box(scene, 3.8, 1.9, .06, 0xdfe3ea, x, .75, ZB + .03, .02, { cast: false }); plane(scene, 3.64, 1.74, 0xbfe3ff, x, 1.7, ZB + .08, 0, true); plane(scene, .04, 1.74, 0x9aa3b2, x, 1.7, ZB + .09, 0, true); }
  for (let i = 0; i < 9; i++) { box(scene, .5, 2.0, 1.1, 0xf4f5f7, RW / 2 - .26, 0, -16.5 + i * 1.12, .02, { rough: .5 }); box(scene, .02, .3, .04, 0xaab3c2, RW / 2 - .52, 1.0, -16.5 + i * 1.12 + .35, .01); }
  // 부장 자리(맨 안쪽 가운데)
  chair(scene, 0, -17.3, 0);
  const boss = person(scene, { ...BOSS, pose: 'sitType', mouth: o.bossTalk ? 'open' : undefined }, 0, -17.25, 0); tops.boss = boss.userData.top;
  box(scene, 3.2, .76, 1.3, 0x8a6142, 0, 0, -16.2, .04, { rough: .5 });
  monitor(scene, -.45, .76, -16.55, 0, .62).rotation.y = Math.PI + .15; monitor(scene, .45, .76, -16.55, 0, .62).rotation.y = Math.PI - .15;
  box(scene, .8, .18, .08, 0x2f3a5c, .9, .76, -15.6, .02); sign(scene, '부장', .7, .14, .9, .85, -15.555, { bg: '#2f3a5c' });
  box(scene, 4.0, .9, .55, 0xe8e4dc, 0, 0, -18.55, .03);
  plant(scene, -2.6, -18.2, 1.3); plant(scene, 2.6, -18.2, 1.1);
  // 팀: 3팀(부장 쪽) → 2팀 → 1팀(문 쪽)
  const teams = [[-9.0, 6, '3팀'], [-2.4, 7, '2팀'], [4.2, 7, '1팀']];
  const seats = [], X4 = [-4.5, -1.5, 1.5, 4.5];
  teams.forEach(([zc, n, name], t) => {
    const far = n === 7 ? X4 : X4.slice(0, 3), near = X4.slice(0, 3);
    far.forEach((x, i) => { cubicle(scene, x, zc - .7, -1, { side: i > 0, memo: (i + t) % 2 === 0, plant: i === 1, files: i === 2 }); seats.push({ x, z: zc - .7 - CUB.SEAT, ry: 0 }); });
    near.forEach((x, i) => { cubicle(scene, x, zc + .7, +1, { side: i > 0, memo: (i + t) % 2 === 1, mugC: 0xffe08a, files: i === 0 }); seats.push({ x, z: zc + .7 + CUB.SEAT, ry: Math.PI }); });
    if (name === '2팀') {   // 과장은 2팀 소속: 줄 오른쪽 끝 팀장 자리에서 팀을 바라봄
      cubicle(scene, 6.95, zc, 0, { ang: Math.PI / 2, files: true, memo: true, plant: true });
      const mgr = person(scene, { ...MGR, pose: 'sitType' }, 6.95 + CUB.SEAT, zc, -Math.PI / 2); tops.mgr = mgr.userData.top;
      plant(scene, 4.5, zc + 1.2, 1.1);
    } else printer(scene, 4.5, zc + .9);
    if (n === 6) plant(scene, 4.5, zc - 1.2, 1.2);
    tops['team' + name] = new THREE.Vector3(-6.6, 1.5, zc);
  });
  const occ = o.occ || {};
  seats.forEach((st, i) => {
    const who = occ[i];
    if (who === undefined) { ring(scene, st.x, st.z, .42); return; }
    const opts = who === 'me' ? { ...ME } : { ...NPC[i % NPC.length] };
    const p = person(scene, { ...opts, pose: 'sitType' }, st.x, st.z, st.ry);
    tops['seat' + i] = p.userData.top;
  });
  // 문 쪽: 사내 게시판(왼쪽 벽), 탕비실 문(오른쪽), 유리문
  box(scene, .08, 1.3, 2.4, 0xa87a52, -RW / 2 + .1, .7, 6.4, .03);
  [[0xfff59a, 5.7, 1.6], [0xffd1dc, 6.2, 1.7], [0xc9f2d4, 6.9, 1.5], [0xcfe6ff, 5.9, 1.2], [0xffe2b8, 6.7, 1.15]].forEach(([c, zz, yy]) => { const n = plane(scene, .34, .3, c, -RW / 2 + .16, yy, zz, Math.PI / 2); n.rotation.x = (zz * 13 % 1 - .5) * .2; });
  tops.board = new THREE.Vector3(-RW / 2 + .2, 2.2, 6.4);
  box(scene, .1, 2.3, 1.4, 0x8fc7ea, RW / 2 - .06, 0, 8.4, .03); sign(scene, '탕비실', .9, .22, RW / 2 - .13, 2.0, 8.4, { bg: '#1d2b4f', ry: -Math.PI / 2 });
  tops.pantry = new THREE.Vector3(RW / 2 - .3, 2.5, 8.4);
  { const gd = new THREE.Mesh(new THREE.PlaneGeometry(3.6, .25), new THREE.MeshBasicMaterial({ color: 0x9fd4f5 })); gd.rotation.x = -Math.PI / 2; gd.position.set(0, .02, ZF - .15); scene.add(gd); tops.door = new THREE.Vector3(0, 0, ZF - .4); }
  if (o.me) { const p = person(scene, { ...ME, pose: 'walk' }, o.me[0], o.me[1], Math.PI); ring(scene, o.me[0], o.me[1], .55); tops.me = p.userData.top; }
  return { scene, tops, seats, sun: { sun: [-7, 16, 10], box: 20 } };
}

/* ================= 로비 (천장 12m) ================= */
export function lobby(card = false) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xeae7e2);
  const tops = {};
  const stone = floorTex((c, w, h) => { c.fillStyle = '#ece9e4'; c.fillRect(0, 0, w, h); c.fillStyle = '#e2ded7'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); c.strokeStyle = 'rgba(0,0,0,.05)'; c.lineWidth = 3; c.strokeRect(0, 0, w, h); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke(); }, [8, 10]);
  floor(scene, 28, 34, stone, 0, -3);
  const HT = 12;
  // 엘리베이터 코어(뒷벽, 돌) + 위쪽 2층 난간
  plane(scene, 28, HT, 0xe3dcd0, 0, HT / 2, -14);
  for (const [i, x] of [-4.5, -1.5, 1.5, 4.5].entries()) {
    box(scene, 2.3, 2.9, .2, 0xb9c0cb, x, 0, -13.85, .05, { rough: .35 });
    box(scene, 1.02, 2.6, .06, 0xdfe3e9, x - .52, 0, -13.73, .01, { rough: .3 }); box(scene, 1.02, 2.6, .06, 0xdfe3e9, x + .52, 0, -13.73, .01, { rough: .3 });
    sign(scene, '▲ ' + [1, 3, 5, 8][i], .7, .24, x, 3.2, -13.88, { bg: '#262a35', fg: '#ffb347' });
  }
  box(scene, 28, .5, 2.2, 0xf3f1ec, 0, 5.2, -12.9, .05);   // 2층 바닥판
  const rail = new THREE.MeshStandardMaterial({ color: 0xcfe9f7, transparent: true, opacity: .45, roughness: .1 });
  box(scene, 28, .9, .05, rail, 0, 5.7, -11.82, .01, { cast: false });
  box(scene, 6.4, 1.5, .14, 0x1d2b4f, 0, 8.2, -13.9, .1); sign(scene, '∞ 무한채용', 6.0, 1.3, 0, 8.95, -13.82, { bg: '#1d2b4f' });
  // 왼쪽: 바닥부터 천장까지 유리 커튼월
  plane(scene, 34, HT, 0xbfe3ff, -12, HT / 2, -3, Math.PI / 2, true);
  for (let z = -19; z <= 14; z += 2.4) box(scene, .16, HT, .16, 0xe6e8ec, -11.9, 0, z, .02, { cast: false });
  for (const y of [3, 6, 9]) box(scene, .14, .12, 34, 0xe6e8ec, -11.9, y, -3, .02, { cast: false });
  // 오른쪽: 돌벽
  plane(scene, 34, HT, 0xe8e1d6, 12, HT / 2, -3, -Math.PI / 2);
  ceiling(scene, 28, 34, HT, 0, -3, [-7, -3.5, 0, 3.5, 7].flatMap(x => [-11, -6.5, -2, 2.5, 7].map(z => [x, z, 1.6, 1.6])));
  // 큰 기둥 4개
  for (const [x, z] of [[-6.5, -8.5], [6.5, -8.5], [-6.5, 1.5], [6.5, 1.5]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, HT, 40), mat(0xf6f4f0, .5)); c.position.set(x, HT / 2, z); c.castShadow = true; c.receiveShadow = true; scene.add(c); }
  plant(scene, -10.5, -12.5, 1.8); plant(scene, 10.5, -12.5, 1.8); plant(scene, -10.5, 4, 1.6); plant(scene, 10.6, 4.5, 1.6);
  // 엘리베이터 앞 사람들, 지나가는 사람들
  person(scene, { ...NPC[0] }, -4.4, -12.4, Math.PI); person(scene, { ...NPC[3] }, -1.2, -12.2, Math.PI + .2); person(scene, { ...NPC[6] }, 1.8, -12.6, Math.PI - .2);
  person(scene, { ...NPC[2], pose: 'walk' }, -3.2, -8.0, Math.PI); person(scene, { ...NPC[1], pose: 'cup' }, 3.8, -7.0, -.3); person(scene, { ...NPC[7], pose: 'walk' }, 1.2, -9.6, Math.PI);
  // 스피드 게이트 6줄(기둥 7개)
  const gz = -4.2, gx = [-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4];
  gx.forEach((x, i) => {
    box(scene, .3, 1.02, 1.5, 0xd4d9e0, x, 0, gz, .06, { rough: .3 });
    box(scene, .22, .02, .36, (card && i === 2) ? 0x34c77b : 0x3b4252, x, 1.02, gz + .45, .01);
    if (i < gx.length - 1) {
      const open = card && i === 1, L = gx[i + 1] - x - .3;
      const glass = new THREE.MeshStandardMaterial({ color: open ? 0x9fe8c0 : 0xbfe3ff, transparent: true, opacity: .6, roughness: .1 });
      if (!open) box(scene, L, .55, .04, glass, x + .15 + L / 2, .45, gz, .03, { cast: false });
      else { box(scene, .24, .55, .04, glass, x + .27, .45, gz, .02, { cast: false }); box(scene, .24, .55, .04, glass, x + .15 + L - .12, .45, gz, .02, { cast: false }); }
    }
  });
  // 안내 데스크(오른쪽 앞)
  person(scene, { ...NPC[5], pose: 'sitType', mouth: 'open' }, 7.4, 1.2, -.4);
  box(scene, 3.6, 1.05, .9, 0x1d2b4f, 7.0, 0, 2.2, .06, { rough: .4 }); box(scene, 3.7, .06, 1.0, 0xf6f2ea, 7.0, 1.05, 2.2, .03);
  sign(scene, '안내', 1.0, .3, 7.0, .6, 2.66, { bg: '#1d2b4f' });
  tops.desk = new THREE.Vector3(7.0, 1.6, 2.2);
  // 들어오는 사람들, 나
  person(scene, { ...NPC[4], pose: 'walk' }, 3.0, 2.4, Math.PI - .1); person(scene, { ...NPC[1], pose: 'walk' }, -3.6, 3.6, Math.PI + .1);
  const me = card ? [-.9, -3.3] : [-.9, -1.5];
  ring(scene, me[0], me[1], .6);
  const p = person(scene, { ...ME, pose: card ? 'card' : 'stand' }, me[0], me[1], Math.PI); tops.me = p.userData.top;
  return { scene, tops, sun: { sun: [-8, 16, 10], box: 18 } };
}

/* ================= 탕비실 ================= */
export function pantry() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf1ede6);
  const tops = {};
  floor(scene, 14, 16, floorTex((c, w, h) => { c.fillStyle = '#f2e8d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#e9ddc8'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); }, [7, 8]), 0, 1);
  plane(scene, 14, 3.1, 0xfdf6ea, 0, 1.55, -4.5);
  const tile = canvasTex(512, 128, (c, w, h) => { c.fillStyle = '#d3ebe4'; c.fillRect(0, 0, w, h); c.strokeStyle = '#bcdcd2'; c.lineWidth = 4; for (let x = 0; x < w; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } });
  plane(scene, 7.2, .9, new THREE.MeshStandardMaterial({ map: tile, roughness: .5 }), -1.6, 1.42, -4.48);
  box(scene, 2.2, 1.3, .06, 0xdfe3ea, 3.4, .9, -4.47, .02, { cast: false }); plane(scene, 2.06, 1.16, 0xbfe3ff, 3.4, 1.55, -4.42, 0, true);
  box(scene, 7.0, .9, .9, 0xc99a6b, -1.6, 0, -3.95, .04, { rough: .55 }); box(scene, 7.1, .06, 1.0, 0xfbf8f2, -1.6, .9, -3.95, .02, { rough: .3 });
  box(scene, .9, 1.0, .65, 0x3b3f4b, -4.2, .96, -4.0, .08, { rough: .35 }); box(scene, .5, .07, .02, 0x7fd0ff, -4.2, 1.7, -3.66, .02);
  box(scene, .55, 1.0, .55, 0xe6f3fb, -2.9, .96, -4.0, .06, { rough: .3 });
  const wb = new THREE.Mesh(new THREE.CylinderGeometry(.2, .2, .4, 24), new THREE.MeshStandardMaterial({ color: 0x9fd4f5, transparent: true, opacity: .8, roughness: .1 })); wb.position.set(-2.9, 2.16, -4); scene.add(wb);
  box(scene, 1.0, .25, .55, 0xe0a85c, -1.6, .96, -3.95, .06);
  [[0xff8f8f, -1.85], [0xffe08a, -1.6], [0xa8e6a1, -1.35]].forEach(([c, x]) => { const b = new THREE.Mesh(new THREE.SphereGeometry(.11, 16, 12), mat(c, .5)); b.position.set(x, 1.3, -3.95); scene.add(b); });
  tops.coffee = new THREE.Vector3(-4.2, 2.3, -4); tops.water = new THREE.Vector3(-2.9, 2.6, -4); tops.snack = new THREE.Vector3(-1.6, 1.6, -3.95);
  box(scene, 1.3, 2.3, 1.0, 0xf2f4f7, 2.0, 0, -3.95, .08, { rough: .3 });
  plant(scene, 5.2, -3.8, 1.4);
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1.0, 16), mat(0x4a5060, .4)); leg.position.set(0, .5, 0); leg.castShadow = true; scene.add(leg);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .07, 40), mat(0xfbf7ef, .4)); top.position.set(0, 1.03, 0); top.castShadow = true; top.receiveShadow = true; scene.add(top);
  ring(scene, -1.45, .9, .6);
  const a = person(scene, { ...ME, pose: 'cheers', mouth: 'open' }, -1.45, .9, .55); tops.me = a.userData.top;
  const b = person(scene, { ...NPC[7], pose: 'cheers', mouth: 'open' }, 1.45, .8, -.55); b.scale.x *= -1; tops.lee = b.userData.top;
  tops.cheers = new THREE.Vector3(0, 2.3, .8);
  person(scene, { ...NPC[2], pose: 'cup' }, 4.0, 3.5, -.4);
  return { scene, tops, sun: { sun: [-4, 9, 7], box: 9 } };
}

/* ================= 엘리베이터 ================= */
export function elevator() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xe8e1d6);
  const tops = {};
  floor(scene, 12, 12, floorTex((c, w, h) => { c.fillStyle = '#eceae6'; c.fillRect(0, 0, w, h); c.fillStyle = '#e2dfd9'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); }, [6, 6]), 0, 2);
  for (const [w, x] of [[4.3, -3.85], [4.3, 3.85]]) plane(scene, w, 5, 0xe3dcd0, x, 2.5, -1.5);
  plane(scene, 3.4, 1.7, 0xe3dcd0, 0, 4.15, -1.5);
  box(scene, .4, 3.3, .2, 0xb9c0cb, -1.5, 0, -1.45, .06, { rough: .35 }); box(scene, .4, 3.3, .2, 0xb9c0cb, 1.5, 0, -1.45, .06, { rough: .35 }); box(scene, 3.4, .4, .2, 0xb9c0cb, 0, 2.95, -1.45, .06, { rough: .35 });
  const cab = new THREE.Group(); cab.position.set(0, 0, -2.9); scene.add(cab);
  plane(cab, 2.8, 2.9, 0xf1d3a1, 0, 1.45, -1.2);
  for (const s of [-1, 1]) plane(cab, 2.6, 2.9, 0xe9c58f, s * 1.4, 1.45, .1, -s * Math.PI / 2);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.6), mat(0xcda675)); fl.rotation.x = -Math.PI / 2; fl.position.set(0, .01, .1); fl.receiveShadow = true; cab.add(fl);
  const ce = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.6), new THREE.MeshBasicMaterial({ color: 0xfff6df })); ce.rotation.x = Math.PI / 2; ce.position.set(0, 2.9, .1); cab.add(ce);
  box(scene, .3, 3.0, .12, 0xdfe3e9, -1.35, 0, -1.32, .02, { rough: .3 }); box(scene, .3, 3.0, .12, 0xdfe3e9, 1.35, 0, -1.32, .02, { rough: .3 });
  sign(scene, '▲ 1F', .9, .32, 0, 3.55, -1.38, { bg: '#262a35', fg: '#ffb347' });
  box(scene, .22, .5, .08, 0xb9c0cb, 2.1, 1.2, -1.42, .04);
  person(scene, { ...NPC[1] }, -.6, -3.2, .15, { sc: 1 });
  const bk = person(scene, { ...NPC[2], pose: 'beckon', mouth: 'open' }, .55, -3.0, -.15, { sc: 1 }); tops.beckon = bk.userData.top;
  ring(scene, -.55, 2.3, .55);
  const me = person(scene, { ...ME, pose: 'walk' }, -.55, 2.3, Math.PI + .15, { sc: 1 }); tops.me = me.userData.top;
  return { scene, tops, sun: { sun: [-3, 8, 8], box: 8 } };
}

/* ================= 부장님 가까이(내 칸막이 자리) ================= */
export function closeup() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xf1ede6);
  const tops = {};
  floor(scene, 14, 14, floorTex((c, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 128 + ((i * 7 + j * 3) % 5) * 4; c.fillStyle = `rgb(${v},${v + 3},${v + 8})`; c.fillRect(i * 128, j * 128, 128, 128); } }, [4, 4]));
  plane(scene, 14, 3.1, 0xf6f4f0, 0, 1.55, -4);
  for (const x of [-2.4, 1.2]) { plane(scene, 2.6, 1.6, 0xbfe3ff, x, 1.7, -3.97, 0, true); }
  // 건너편 자리(동료 얼굴이 칸막이 위로), 내 자리(등이 보임)
  cubicle(scene, 0, -.7, -1, { memo: true, files: true }); cubicle(scene, -3, -.7, -1, { plant: true }); cubicle(scene, 3, -.7, -1, {});
  person(scene, { ...NPC[1], pose: 'sitType' }, 0, -.7 - CUB.SEAT, 0, { sc: 1 });
  cubicle(scene, 0, .7, +1, { side: true, mugC: 0xffe08a, memo: true }); cubicle(scene, -3, .7, +1, {}); cubicle(scene, 3, .7, +1, { files: true });
  person(scene, { ...ME, pose: 'sitType' }, 0, .7 + CUB.SEAT, Math.PI, { sc: 1 });
  const b = person(scene, { ...BOSS, pose: 'point', mouth: 'open' }, 1.25, 1.9, -.85, { sc: 1 }); b.scale.x *= -1; tops.boss = b.userData.top;
  return { scene, tops, sun: { sun: [-4, 9, 7], box: 7 } };
}

/* ================= 타이틀 ================= */
export function title() {
  const scene = new THREE.Scene();
  scene.background = canvasTex(64, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#8fd0ff'); g.addColorStop(.62, '#e3f4ff'); g.addColorStop(1, '#fff4e2'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  floor(scene, 60, 60, null, 0, 0, 0xe9e3d8);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(60, 4), mat(0xbfe3a8, .9)); grass.rotation.x = -Math.PI / 2; grass.position.set(0, .005, -3.6); grass.receiveShadow = true; scene.add(grass);
  // 유리 고층 건물
  const glass = canvasTex(256, 512, (c, w, h) => { c.fillStyle = '#9fcbea'; c.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 24) { c.fillStyle = y % 48 ? '#b7dcf4' : '#a6d1ee'; c.fillRect(0, y, w, 20); } c.fillStyle = 'rgba(255,255,255,.9)'; for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 3, h); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(0, h * .1); c.lineTo(w * .5, 0); c.lineTo(w * .8, 0); c.lineTo(0, h * .35); c.fill(); });
  const tower = new THREE.Mesh(new RoundedBoxGeometry(4.6, 9, 3.4, 3, .25), [mat(0x9fcbea, .2), mat(0x9fcbea, .2), mat(0xe8eef4, .4), mat(0xe8eef4, .4), new THREE.MeshStandardMaterial({ map: glass, roughness: .2, envMapIntensity: .6 }), mat(0x9fcbea, .2)]);
  tower.position.set(0, 4.5, -5.5); tower.castShadow = true; scene.add(tower);
  box(scene, 4.7, 1.0, 3.5, 0x1d2b4f, 0, 9, -5.5, .2); sign(scene, '∞ 무한채용', 4.2, .8, 0, 9.5, -3.74, { bg: '#1d2b4f' });
  box(scene, 6.4, 1.5, 4.2, 0xf4f1ea, 0, 0, -5.5, .2); box(scene, 1.6, 1.2, .1, 0x9fd4f5, 0, 0, -3.36, .04, { rough: .1 });
  for (const [x, s] of [[-4.2, 1.2], [4.3, 1.4]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.13, .16, 1.2, 14), mat(0xb7814f)); t.position.set(x, .6, -2.8); scene.add(t); const b = new THREE.Mesh(new THREE.SphereGeometry(.85 * s, 28, 20), mat(0x6cc27a, .8)); b.position.set(x, 1.7 * s, -2.8); b.castShadow = true; scene.add(b); }
  for (const [x, y, z, s] of [[-3.4, 10.8, -8, 1], [3.6, 11.6, -9, .9], [-1.6, 12.4, -10, .7]]) { const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(s); scene.add(g); for (const [px, py, r] of [[-.5, 0, .5], [.12, .22, .66], [.75, 0, .5]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff })); c.position.set(px, py, 0); g.add(c); } }
  person(scene, { ...NPC[1], pose: 'walk' }, -1.4, -.8, Math.PI, { sc: .9 }); person(scene, { ...NPC[0], pose: 'walk' }, 1.6, -.5, Math.PI, { sc: .9 });
  person(scene, { ...ME, pose: 'wave', mouth: 'open' }, 0, 1.4, 0, { sc: 1 });
  return { scene, tops: {}, sun: { sun: [-6, 14, 10], box: 12 } };
}

/* ================= 캐릭터 선택 ================= */
export function select() {
  const scene = new THREE.Scene();
  scene.background = canvasTex(64, 512, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#dff1ff'); g.addColorStop(1, '#fff5e6'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  floor(scene, 40, 40, null, 0, 0, 0xf4ece0);
  const tops = {};
  for (const [x, on] of [[-.85, true], [.85, false]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.62, .66, .16, 48), mat(on ? 0x8fd3ff : 0xffffff, .4)); p.position.set(x, .08, 0); p.castShadow = p.receiveShadow = true; scene.add(p); }
  const m = person(scene, { ...ME, pose: 'wave', mouth: 'open' }, -.85, 0, .12, { sc: 1, y: .16 });
  const f = person(scene, { sex: 'f', suit: 'beige' }, .85, 0, -.12, { sc: 1, y: .16 });
  tops.m = m.userData.top; tops.f = f.userData.top;
  return { scene, tops, sun: { sun: [-3, 7, 6], box: 4 } };
}
export function perspCam(W, H, fov, pos, target) { const c = new THREE.PerspectiveCamera(fov, W / H, .1, 300); c.position.set(...pos); c.lookAt(...target); return c; }
