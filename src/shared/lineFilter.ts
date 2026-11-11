// 한 줄 걸러내기: 욕설과 그 변형(띄어쓰기, 숫자 끼워 넣기, 영문 자판으로 친 한글), 비방, 광고, 연락처, 위기 단어.
import { BAD_KO, ALLOW_KO, BAD_EN, BAD_JAMO, ADS, CONTACT_WORDS, CRISIS } from './words';
import { LINE_MAX } from './consts';

export type FilterResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'empty' | 'long' | 'abuse' | 'contact' | 'crisis'; message: string };

export const MSG = {
  abuse: '그 말은 올릴 수 없어요',
  contact: '연락처·링크·숫자는 올릴 수 없어요',
  crisis: '많이 힘드시죠. 혼자 견디지 않아도 돼요. 자살예방상담전화 109, 정신건강위기상담 1577-0199 (24시간)',
  empty: '한 줄을 적어 주세요',
  long: `${LINE_MAX}자까지 적을 수 있어요`,
};

/* ---------- 영문 자판으로 친 한글 → 한글 ---------- */
const KEY: Record<string, string> = { q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ', a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ', z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ', Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ' };
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const VV: Record<string, string> = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
const CC: Record<string, string> = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
const isV = (j: string): boolean => JUNG.includes(j);
/** 자모 나열을 두벌식 규칙으로 글자로 묶음 */
export function composeJamo(js: string[]): string {
  let out = '';
  let i = 0;
  while (i < js.length) {
    const c = js[i];
    if (!CHO.includes(c) || i + 1 >= js.length || !isV(js[i + 1])) { // 초성+중성이 아니면 그대로
      if (isV(c) && i + 1 < js.length && VV[c + js[i + 1]]) { out += VV[c + js[i + 1]]; i += 2; } else { out += c; i++; }
      continue;
    }
    let v = js[i + 1]; let k = i + 2;
    if (k < js.length && VV[v + js[k]]) { v = VV[v + js[k]]; k++; }
    let t = '';
    if (k < js.length && JONG.includes(js[k]) && !isV(js[k]) && !(k + 1 < js.length && isV(js[k + 1]))) {
      t = js[k]; k++;
      if (k < js.length && CC[t + js[k]] && !(k + 1 < js.length && isV(js[k + 1]))) { t = CC[t + js[k]]; k++; }
    }
    const ci = CHO.indexOf(c), vi = JUNG.indexOf(v), ti = Math.max(0, JONG.indexOf(t));
    out += ci >= 0 && vi >= 0 ? String.fromCharCode(0xac00 + (ci * 21 + vi) * 28 + ti) : c + v + t;
    i = k;
  }
  return out;
}
export function engToKo(s: string): string {
  return s.replace(/[A-Za-z]+/g, (w) => composeJamo([...w].map((ch) => KEY[ch] ?? KEY[ch.toLowerCase()] ?? ch)));
}

const hangulOnly = (s: string): string => s.replace(/[^가-힣]/g, '');
const hasAny = (s: string, list: readonly string[]): boolean => list.some((w) => s.includes(w));
function stripAllowed(s: string): string { let o = s; for (const a of ALLOW_KO) o = o.split(a).join(''); return o; }

export function checkLine(raw: string, max = LINE_MAX): FilterResult {
  const text = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, reason: 'empty', message: MSG.empty };
  if ([...text].length > max) return { ok: false, reason: 'long', message: MSG.long };
  const ko = hangulOnly(text);
  const koEng = hangulOnly(engToKo(text));
  const lower = text.toLowerCase();
  // 위기 단어는 먼저(게시판에 올리지 않고 도움 안내)
  if (hasAny(ko, CRISIS)) return { ok: false, reason: 'crisis', message: MSG.crisis };
  // 연락처·링크·숫자
  const digits = (text.match(/[0-9０-９]/g) || []).length;
  if (digits >= 7 || /\d{5,}/.test(text.replace(/[\s\-.]/g, '')) && digits >= 6) return { ok: false, reason: 'contact', message: MSG.contact };
  if (/(https?:|www\.|\.(com|net|kr|org|io|me|ly|co|xyz|site|shop|link|gg|app|to)\b|@[a-z0-9_.]{3,}|open\.kakao|t\.me)/i.test(text)) return { ok: false, reason: 'contact', message: MSG.contact };
  if (hasAny(ko, CONTACT_WORDS) || /\b(dm|kakao|telegram|insta|line\s?id)\b/i.test(lower)) return { ok: false, reason: 'contact', message: MSG.contact };
  // 욕설·비방(띄어쓰기·숫자 끼워 넣기·영문 자판)
  if (hasAny(stripAllowed(ko), BAD_KO) || hasAny(stripAllowed(koEng), BAD_KO)) return { ok: false, reason: 'abuse', message: MSG.abuse };
  const latin = lower.replace(/[^a-z]/g, '');
  if (hasAny(latin, BAD_EN)) return { ok: false, reason: 'abuse', message: MSG.abuse };
  const jamo = text.replace(/[^ㄱ-ㆎ]/g, '');
  if (hasAny(jamo, BAD_JAMO)) return { ok: false, reason: 'abuse', message: MSG.abuse };
  // 광고
  if (hasAny(ko, ADS)) return { ok: false, reason: 'abuse', message: MSG.abuse };
  return { ok: true, text };
}
