'use client';
// 알림 (4.13) — 사이트 내 뱃지(헤더 종 + 메뉴 점). 디스코드 봇 DM은 Supabase/봇 서버 연동 시.
// 같은 탭 안에서 발생 지점(각 페이지)과 표시 지점(TopBar)이 다르므로 커스텀 이벤트로 동기화.
import { newId } from './postStore';

export type NotifType = 'rp' | 'comment' | 'guest';
export interface Notif {
  id: string;
  type: NotifType;
  toUserId: string;          // 수신 회원
  title: string;
  body?: string;
  href: string;              // 클릭 시 이동
  date: string;
  read: boolean;
  readAt?: string;           // 읽은 시각 — 하루 지나면 목록에서 정리 (v2.0 사용자 요청)
}

/** 읽고 하루가 지난 알림은 목록에서 치운다 (v2.0 사용자 요청).
 *  안 읽은 알림은 아무리 오래돼도 남는다 — 놓친 것을 임의로 지우면 안 되니까. */
const KEEP_READ_MS = 24 * 60 * 60 * 1000;
export function pruneNotifs(list: Notif[], now = Date.now()): Notif[] {
  return list.filter(n => {
    if (!n.read) return true;
    const t = Date.parse(n.readAt ?? '');
    return !Number.isFinite(t) || now - t < KEEP_READ_MS;
  });
}

const KEY = 'ohome.notif.v1';
const SET_KEY = 'ohome.notifset.v1'; // 회원별 알림 항목 on/off — { [userId]: { rp, comment, guest } }
export const NOTIF_EVENT = 'ohome-notif';

export const NOTIF_TYPE_LABEL: Record<NotifType, string> = {
  rp: '역극 새 메시지', comment: '내 글 댓글', guest: '방명록 (관리자)',
};

export function readNotifs(): Notif[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Notif[];
    const kept = pruneNotifs(all);
    // 정리된 게 있으면 저장까지 (다음 번에 또 훑지 않게) — 여기서 이벤트를 쏘면 렌더 중 갱신이 되어 안 쏜다
    if (kept.length !== all.length) {
      try { localStorage.setItem(KEY, JSON.stringify(kept)); } catch { /* 무시 */ }
    }
    return kept;
  } catch { return []; }
}

function write(list: Notif[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100))); } catch { /* 무시 */ }
  window.dispatchEvent(new Event(NOTIF_EVENT));
}

export interface NotifSettings { rp: boolean; comment: boolean; guest: boolean }
const DEFAULT_SET: NotifSettings = { rp: true, comment: true, guest: true };

export function notifSettings(userId: string): NotifSettings {
  try {
    const all = JSON.parse(localStorage.getItem(SET_KEY) ?? '{}');
    return { ...DEFAULT_SET, ...(all[userId] ?? {}) };
  } catch { return DEFAULT_SET; }
}

export function setNotifSetting(userId: string, key: NotifType, value: boolean) {
  try {
    const all = JSON.parse(localStorage.getItem(SET_KEY) ?? '{}');
    all[userId] = { ...DEFAULT_SET, ...(all[userId] ?? {}), [key]: value };
    localStorage.setItem(SET_KEY, JSON.stringify(all));
  } catch { /* 무시 */ }
  window.dispatchEvent(new Event(NOTIF_EVENT));
}

/** 알림 생성 — 수신자가 해당 항목을 꺼뒀으면 만들지 않음.
 *  dedupeKey: 같은 키의 안 읽은 알림이 있으면 새로 쌓지 않고 갱신 (역극 방 단위 묶음 등) */
export function pushNotif(n: {
  type: NotifType; toUserId: string; title: string; body?: string; href: string; dedupeKey?: string;
}) {
  if (!notifSettings(n.toUserId)[n.type]) return;
  const list = readNotifs();
  if (n.dedupeKey) {
    const i = list.findIndex(x => !x.read && x.toUserId === n.toUserId
      && x.type === n.type && x.href === n.href && x.title === n.title);
    if (i >= 0) {
      const [ex] = list.splice(i, 1);
      write([{ ...ex, body: n.body, date: new Date().toISOString() }, ...list]);
      return;
    }
  }
  write([{
    id: newId(), type: n.type, toUserId: n.toUserId, title: n.title, body: n.body,
    href: n.href, date: new Date().toISOString(), read: false,
  }, ...list]);
}

export function markRead(id: string) {
  const at = new Date().toISOString();
  write(readNotifs().map(n => (n.id === id ? { ...n, read: true, readAt: n.readAt ?? at } : n)));
}

export function markAllRead(userId: string) {
  const at = new Date().toISOString();
  write(readNotifs().map(n => (n.toUserId === userId ? { ...n, read: true, readAt: n.readAt ?? at } : n)));
}

/** 읽은 알림 지금 바로 정리 (v2.0 사용자 요청 — 하루를 기다리지 않고 손으로) */
export function clearReadNotifs(userId: string) {
  write(readNotifs().filter(n => !(n.toUserId === userId && n.read)));
}

export function removeNotif(id: string) {
  write(readNotifs().filter(n => n.id !== id));
}
