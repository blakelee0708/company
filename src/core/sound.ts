// 작은 효과음(파일 없이 만들어 냄): 삑(카드), 띵(엘리베이터), 톡(버튼), 짝짝(박수), 짠(건배)
let ctx: AudioContext | null = null;
export const sound = { on: true };
function ac(): AudioContext | null {
  if (!sound.on) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, at = 0): void {
  const c = ac(); if (!c) return;
  const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.2, at = 0): void {
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1800; s.buffer = b; g.gain.value = vol;
  s.connect(f).connect(g).connect(c.destination); s.start(c.currentTime + at);
}
export const sfx = {
  beep: (): void => tone(1760, 0.16, 'square', 0.06),
  ding: (): void => { tone(1318, 0.9, 'sine', 0.14); tone(1046, 1.1, 'sine', 0.1, 0.18); },
  pop: (): void => tone(660, 0.07, 'triangle', 0.08),
  clap: (): void => { for (let i = 0; i < 4; i++) noise(0.08, 0.25, i * 0.16); },
  cheers: (): void => { tone(2093, 0.4, 'sine', 0.08); tone(2637, 0.35, 'sine', 0.06, 0.02); },
  stamp: (): void => { noise(0.07, 0.35); tone(140, 0.12, 'sine', 0.2); },
  pour: (): void => noise(1.6, 0.05),
  /** 잠금 풀기(첫 터치) */
  unlock: (): void => { ac(); },
};
