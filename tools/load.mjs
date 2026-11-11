// 가상 사용자 부하 시험: node tools/load.mjs <baseUrl> [사람 수=120] [초=25]
// 사람마다 /api/assign → 부서 방 WebSocket → hi → 1초에 3번 위치 보내기. 꽉 차면 안내(full)를 받는지 센다.
const [base = 'http://localhost:8787', N = '120', SEC = '25'] = process.argv.slice(2);
const n = Number(N), sec = Number(SEC);
const wsBase = base.replace(/^http/, 'ws');
const stat = { assigned: 0, assignFull: 0, welcome: 0, roomFull: 0, snaps: 0, joins: 0, errors: 0, perDept: [0, 0, 0, 0, 0] };
const socks = [];
async function user(i) {
  await new Promise((r) => setTimeout(r, i * 40));
  let a;
  try { a = await (await fetch(base + '/api/assign')).json(); } catch { stat.errors++; return; }
  if (a.full) { stat.assignFull++; return; }
  stat.assigned++;
  const ws = new WebSocket(`${wsBase}/ws/dept?b=${a.building}&d=${a.dept}`);
  socks.push(ws);
  let timer = 0, x = Math.random() * 10 - 5, z = Math.random() * 10 - 5;
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hi', name: '김사원#' + String(i).padStart(4, '0'), sex: i % 2 ? 'f' : 'm', suit: 'navy', tie: 0 }));
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'welcome') { stat.welcome++; stat.perDept[a.dept]++; timer = setInterval(() => { x += Math.random() - 0.5; z += Math.random() - 0.5; ws.send(JSON.stringify({ t: 's', x, z, y: 0, st: 1, seat: -1, cup: 0 })); }, 333); }
    else if (m.t === 'full') stat.roomFull++;
    else if (m.t === 'snap') stat.snaps++;
    else if (m.t === 'join') stat.joins++;
  };
  ws.onerror = () => { stat.errors++; };
  ws.onclose = () => clearInterval(timer);
}
const t0 = Date.now();
await Promise.all(Array.from({ length: n }, (_, i) => user(i)));
await new Promise((r) => setTimeout(r, sec * 1000));
for (const w of socks) try { w.close(); } catch { /* */ }
console.log(JSON.stringify({ users: n, seconds: (Date.now() - t0) / 1000, ...stat }, null, 1));
process.exit(0);
