// 캐릭터 뷰어: 시안 09-characters.png(sheet4.html)와 같은 배치로 그리고, 모든 동작을 눌러 볼 수 있다.
import * as THREE from 'three';
import { renderer, lightUp, perspCam, toScreen } from './core/render';
import { Worker, type Look } from './character/worker';
import { ME, BOSS, MGR_F } from './character/presets';
import type { Action, BasePose } from './anim/animator';
import { buildChair } from './world/kit';

const W = 1240, H = 760;
const still = new URLSearchParams(location.search).has('still');
const R = renderer(document.getElementById('c') as HTMLCanvasElement, W, H, { preserve: true });
const sc = new THREE.Scene();
sc.background = new THREE.Color(0xf3efe8);
const fm = new THREE.MeshStandardMaterial({ color: 0xece4d8, roughness: 0.9, envMapIntensity: 0.3 });
const fl = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), fm); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; sc.add(fl);
lightUp(R, sc, { box: 8 });
const cam = perspCam(W, H, 30, [0, 3.0, 17], [0, 1.25, 0]); cam.updateMatrixWorld();
const step = new THREE.Mesh(new THREE.BoxGeometry(14, 1.75, 1.6), fm); step.position.set(0, 0.875, -1.6); step.receiveShadow = true; sc.add(step);

type Item = [Look & { mouth?: boolean }, number, string, BasePose, Action | null, 'cup' | null];
const rows: Item[][] = [
  [[{ ...ME }, 0, '남사원 앞', 'stand', null, null], [{ ...ME }, Math.PI, '남사원 뒤', 'stand', null, null], [{ ...ME }, 0, '손 흔들기', 'stand', 'wave', null], [{ ...ME }, 0.35, '걷기', 'walk', null, null], [{ ...ME }, -0.3, '카드 찍기', 'stand', 'card', null], [{ ...ME }, 0, '커피', 'stand', null, 'cup'], [{ ...BOSS }, 0, '부장(NPC) 손짓', 'stand', 'beckon', null]],
  [[{ sex: 'f', suit: 'beige' }, 0, '여사원 앞', 'stand', null, null], [{ sex: 'f', suit: 'beige' }, Math.PI, '여사원 뒤', 'stand', null, null], [{ sex: 'f', suit: 'beige' }, 0, '건배', 'stand', 'cheers', 'cup'], [{ sex: 'f', suit: 'navy' }, -0.35, '걷기', 'walk', null, null], [{ sex: 'f', suit: 'charcoal' }, 0, '박수', 'stand', 'clap', null], [{ sex: 'f', suit: 'pink' }, 0.3, '정장 분홍', 'stand', null, null], [{ ...MGR_F }, 0, '과장(NPC) 말하기', 'stand', 'point', null]],
];
const wrap = document.getElementById('w')!;
const all: Array<{ w: Worker; it: Item }> = [];
rows.forEach((row, r) => row.forEach((it, i) => {
  const [o, ry, lab, base, act, prop] = it;
  const w = new Worker(o);
  w.root.traverse((m) => { if ((m as THREE.Mesh).isMesh) { (m as THREE.Mesh).castShadow = true; (m as THREE.Mesh).receiveShadow = false; } });
  const x = -5.1 + i * 1.7, z = r ? 1.2 : -1.6, y = r ? 0 : 1.75;
  w.root.position.set(x, y, z); w.root.rotation.y = ry; sc.add(w.root);
  w.setPose(base); w.anim.speed = 1;
  if (prop) { w.setProp(prop); w.anim.carry = prop === 'cup' && act !== 'cheers'; }
  if (act) w.play(act, Infinity);
  all.push({ w, it });
  const [sx, sy] = toScreen(cam, new THREE.Vector3(x, y, z + 0.5), W, H);
  const d = document.createElement('div'); d.className = 't'; d.textContent = lab; d.style.left = sx + 'px'; d.style.top = sy + 4 + 'px'; wrap.appendChild(d);
}));

// 앉기·타자 시험용 의자
const demo = new Worker({ ...ME });
const chair = buildChair();
chair.position.set(5.6, 0, 3.6); chair.rotation.y = Math.PI;
demo.root.position.set(5.6, 0, 3.6); demo.root.rotation.y = 0;
if (!still) { sc.add(chair); sc.add(demo.root); }
demo.root.traverse((m) => { if ((m as THREE.Mesh).isMesh) (m as THREE.Mesh).castShadow = true; });

const ctl = document.getElementById('ctl')!;
const btn = (t: string, f: () => void): void => { const b = document.createElement('button'); b.textContent = t; b.onclick = f; ctl.appendChild(b); };
const bases: BasePose[] = ['stand', 'walk', 'sit', 'sitType'];
for (const b of bases) btn(b, () => { for (const { w } of all) { w.setPose(b); } demo.setPose(b); });
const acts: Action[] = ['wave', 'beckon', 'card', 'clap', 'point', 'cheers', 'drink', 'bow', 'nod', 'stretch', 'phone', 'shrug'];
for (const a of acts) btn(a, () => { for (const { w } of all) { if (a === 'drink' || a === 'cheers') w.setProp('cup'); if (a === 'card') w.setProp('card'); w.play(a); } demo.play(a); });
btn('talk', () => { for (const { w } of all) w.talk(2); });

let last = performance.now();
if (still) {
  for (let i = 0; i < 40; i++) for (const { w } of all) w.update(0.02);
  for (const { w, it } of all) { if (it[0].mouth) w.setMouth(true); }
  R.render(sc, cam);
  (window as unknown as { __done: boolean }).__done = true;
} else {
  const loop = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (const { w } of all) w.update(dt);
    demo.root.position.y = demo.anim.sitW * (0.5 - 0.3);
    demo.update(dt);
    R.render(sc, cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  (window as unknown as { __done: boolean }).__done = true;
}

// ?poses=1 : 모든 동작을 앞·옆에서 칸마다 크게(손이 몸을 뚫는지 확인용)
if (new URLSearchParams(location.search).has('poses')) {
  for (const { w } of all) sc.remove(w.root);
  sc.remove(chair); sc.remove(demo.root); sc.remove(step);
  wrap.querySelectorAll('.t').forEach((e) => e.remove());
  const list: Array<[string, BasePose, Action | null]> = [['서기', 'stand', null], ['앉기', 'sit', null], ['타자', 'sitType', null], ['손짓', 'stand', 'beckon'], ['카드 찍기', 'stand', 'card'], ['인사', 'stand', 'bow'], ['마시기', 'stand', 'drink'], ['기지개', 'stand', 'stretch'], ['통화', 'stand', 'phone'], ['박수', 'stand', 'clap'], ['손 흔들기', 'stand', 'wave'], ['건배', 'stand', 'cheers']];
  const cells: Array<{ x: number; z: number; side: boolean; lab: string }> = [];
  const ws: Worker[] = [];
  list.forEach(([lab, b, a], i) => {
    const w = new Worker(i % 2 ? { sex: 'f', suit: 'beige' } : { ...ME });
    const x = i * 5, z = 30;
    w.root.position.set(x, 0, z);
    w.setPose(b); if (a) { if (a === 'drink' || a === 'cheers') w.setProp('cup'); if (a === 'card') w.setProp('card'); w.play(a, Infinity); }
    sc.add(w.root); ws.push(w);
    if (b !== 'stand') { const c = buildChair(); c.position.set(x, 0, z); c.rotation.y = 0; c.scale.setScalar(1 / 1.22); sc.add(c); }
    cells.push({ x, z, side: false, lab }, { x, z, side: true, lab: lab + ' (옆)' });
  });
  for (let k = 0; k < 40; k++) for (const w of ws) { w.update(0.02); w.root.position.y = w.anim.sitW * (0.5 / 1.22 - 0.3); }
  R.setScissorTest(true);
  const cw = W / 6, ch = (H - 100) / 4;
  cells.forEach((c, i) => {
    const col = i % 6, row = Math.floor(i / 6);
    const x0 = col * cw, y0 = 100 + row * ch;
    const cm = new THREE.PerspectiveCamera(28, cw / ch, 0.1, 50);
    if (c.side) cm.position.set(c.x + 3.4, 1.1, c.z + 0.2); else cm.position.set(c.x + 0.4, 1.3, c.z + 3.6);
    cm.lookAt(c.x, 0.7, c.z);
    R.setViewport(x0, H - y0 - ch, cw, ch); R.setScissor(x0, H - y0 - ch, cw, ch);
    R.render(sc, cm);
    const d = document.createElement('div'); d.className = 't'; d.style.fontSize = '12px'; d.textContent = c.lab; d.style.left = x0 + cw / 2 + 'px'; d.style.top = y0 + 4 + 'px'; wrap.appendChild(d);
  });
}
