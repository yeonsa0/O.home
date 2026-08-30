'use client';
/**
 * 커스텀 링크 메뉴 (v2.0 사용자 요청).
 *
 * 「자관 목록에 들어가서 골라야 갈 수 있던 페이지(`/rels/latte`)를 메뉴에서 바로」 —
 * 이름과 주소만 적어 두면 메뉴에 올릴 수 있는 항목이 된다. **사이트 안에서의 이동**이라
 * 새 창이 아니라 다른 메뉴와 똑같이 화면만 갈아 끼운다.
 *
 * 게시판·섹션과 같은 「메뉴에 얹는 추가 항목」이라, 만들면 **메뉴 관리의 미배치**에 놓이고
 * 원하는 상위 메뉴에 직접 넣는다(자동 배치 없음 — 사용자 확정).
 */
import { useCallback, useEffect, useReducer } from 'react';
import { getRawSetting, setSetting } from './settingStore';
import { newId } from './postStore';
import type { ExtraEntry } from './menuStore';

const KEY = 'ohome.links.v1';
const EVT = 'ohome-links';

export interface CustomLink {
  id: string;
  name: string;
  /** 사이트 안의 경로 — 저장할 때 `/`로 시작하는 형태로 맞춘다 */
  href: string;
}

/**
 * 입력을 사이트 안 경로로 (v2.0).
 *
 * 풀주소를 붙여 넣어도 **경로만** 남긴다 — 오리진이 같을 때만 자르면(normalizeInternalLink)
 * 도메인을 바꾸거나 다른 기기에서 붙여 넣었을 때 외부 링크가 되어 새 창이 뜬다.
 * 이 기능은 「내부 이동」이 목적이므로 언제나 경로를 취한다.
 */
export function toInternalPath(v: string): string {
  const s = v.trim();
  if (!s) return '';
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      return u.pathname + u.search + u.hash;
    }
  } catch { /* 파싱 실패 — 아래에서 경로로 다룬다 */ }
  return s.startsWith('/') ? s : `/${s}`;
}

let cache: CustomLink[] = [];
let loaded = false;

function load() {
  if (loaded) return;
  try {
    const raw = getRawSetting(KEY);
    if (raw) cache = JSON.parse(raw) as CustomLink[];
  } catch { /* 기본값 */ }
  loaded = true;
}

function notify() { try { window.dispatchEvent(new Event(EVT)); } catch { /* 무시 */ } }

export function useCustomLinks(): {
  links: CustomLink[];
  setLinks: (next: CustomLink[]) => void;
  add: () => void;
  loaded: boolean;
} {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const h = () => force();
    window.addEventListener(EVT, h);
    window.addEventListener('ohome-setting', h);
    return () => { window.removeEventListener(EVT, h); window.removeEventListener('ohome-setting', h); };
  }, []);
  load();

  const setLinks = useCallback((next: CustomLink[]) => {
    cache = next;
    try { setSetting(KEY, cache); } catch { /* 무시 */ }
    notify();
  }, []);

  const add = useCallback(() => {
    cache = [...cache, { id: newId(), name: '새 링크', href: '/' }];
    try { setSetting(KEY, cache); } catch { /* 무시 */ }
    notify();
  }, []);

  return { links: cache, setLinks, add, loaded };
}

/** 메뉴에 얹을 형태로 — 주소가 비어 있는 것은 뺀다(메뉴에 눌러도 아무 데도 안 가는 항목이 생긴다).
 *  anchor는 자동 배치에만 쓰이던 값이라 지금은 의미가 없지만, 형태를 맞춰 둔다 */
export const linkEntries = (links: CustomLink[]): ExtraEntry[] =>
  links.filter(l => l.href.trim() && l.href !== '/')
    .map(l => ({ id: l.id, name: l.name.trim() || l.href, href: l.href, anchor: '/' }));
