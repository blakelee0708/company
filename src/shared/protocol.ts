// 부서 방 메시지(PRD 11장). 화면과 서버가 같이 쓴다.
export type St = 0 | 1 | 2 | 3; // 서기 · 걷기 · 앉기 · 탕비실
export interface Hi { t: 'hi'; name: string; sex: 'm' | 'f'; suit: string; tie: number }
export interface StateMsg { t: 's'; x: number; z: number; y: number; st: St; seat: number; cup: 0 | 1 }
export type EvKind = 'bow' | 'clap' | 'cheers' | 'done' | 'ask' | 'yes' | 'no' | 'apart' | 'drink';
export interface EvMsg { t: 'e'; k: EvKind; to?: string }
export interface SeatMsg { t: 'seat'; i: number }
export interface NoteMsg { t: 'note'; text: string }
export interface ReportMsg { t: 'report'; id: string }
export interface PingMsg { t: 'ping' }
export type ClientMsg = Hi | StateMsg | EvMsg | SeatMsg | NoteMsg | ReportMsg | PingMsg;

export interface PeerPub { id: string; name: string; sex: 'm' | 'f'; suit: string; tie: number; x: number; z: number; y: number; st: St; seat: number; cup: 0 | 1 }
export interface NotePub { id: string; text: string; by?: string }
/** snap 한 줄: [id, x, z, 방향, 상태, 자리, 컵] */
export type SnapRow = [string, number, number, number, St, number, 0 | 1];
export type ServerMsg =
  | { t: 'welcome'; id: string; peers: PeerPub[]; seats: Array<string | null>; notes: NotePub[] }
  | { t: 'join'; p: PeerPub }
  | { t: 'leave'; id: string }
  | { t: 'snap'; p: SnapRow[] }
  | { t: 'e'; k: EvKind; from: string; to?: string }
  | { t: 'seats'; seats: Array<string | null> }
  | { t: 'seatNo'; i: number }
  | { t: 'note'; n: NotePub }
  | { t: 'noteNo'; msg: string; crisis?: boolean }
  | { t: 'hide'; id: string }
  | { t: 'full' }
  | { t: 'pong' };

export const r2 = (v: number): number => Math.round(v * 100) / 100;
