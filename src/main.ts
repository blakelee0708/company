// 처음 화면(타이틀)은 HTML로 바로 보이고, 3D는 뒤에서 내려받는다.
// 타이틀 1.6초 → 캐릭터 선택. 준비가 늦으면 막대가 끝까지 찰 때까지 기다린다.
const bar = document.getElementById('bar') as HTMLElement;
const title = document.getElementById('title') as HTMLElement;
const t0 = performance.now();
let p = 4;
const fake = setInterval(() => { p = Math.min(88, p + (90 - p) * 0.12); bar.style.width = p + '%'; }, 100);

async function boot(): Promise<void> {
  const { Game } = await import('./game');
  const host = document.getElementById('app')!;
  const game = new Game(host);
  await new Promise<void>((res) => { void game.title(res); });
  clearInterval(fake);
  bar.style.width = '100%';
  const el = performance.now() - t0;
  // 준비가 끝나면 0.3초 뒤(1.6초가 안 지났으면 1.6초까지 기다림)
  await new Promise((r) => setTimeout(r, Math.max(300, 1600 - el)));
  // 건물(100명)이 가득 찼으면 타이틀에서 안내하고 30초마다 다시 시도
  const full = document.getElementById('full')!;
  for (;;) {
    let isFull = false;
    try { const r = await fetch('/api/assign', { cache: 'no-store' }); if ((r.headers.get('content-type') || '').includes('json')) isFull = !!((await r.json()) as { full?: boolean }).full; } catch { /* 혼자 출근 */ }
    if (!isFull) break;
    full.innerHTML = '<div style="margin-top:18px;font:700 14px/1.5 P,sans-serif;color:#1d2b4f;background:#fff;display:inline-block;padding:10px 16px;border-radius:14px;border:2px solid #3a2f3d">오늘은 자리가 꽉 찼어요.<br>잠시 후 다시 출근해 주세요</div>';
    await new Promise((r) => setTimeout(r, 30000));
  }
  title.style.opacity = '0';
  setTimeout(() => title.remove(), 320);
  game.select();
}
boot().catch((e) => {
  console.error(e);
  const f = document.getElementById('full');
  if (f) f.innerHTML = '<div style="margin-top:18px;font:700 14px P,sans-serif;color:#1d2b4f">불러오지 못했어요. 새로고침해 주세요</div>';
});
