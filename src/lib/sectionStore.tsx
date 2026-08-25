'use client';
/**
 * 목록형 섹션을 여러 개로 (v2.0 사용자 요청).
 *
 * 게시판이 이미 하던 방식을 그대로 일반화했다 — **목록은 설정에, 항목은 원래 테이블에**.
 * 갤러리를 3개 만들어도 그림은 전부 `gallery` 테이블 한 곳에 들어가고, 각 항목이 `secId`로
 * 어디 소속인지만 들고 있다. 그래서 **DB 구조를 바꿀 필요가 없다**(포크 쓰는 사람이 SQL을
 * 다시 실행하지 않아도 된다 — 스키마 캐시 문제를 겪은 뒤라 이게 중요하다).
 *
 * 개별로 두는 것은 **이름뿐**이고 말머리·무드·카테고리 같은 세부 설정은 함께 쓴다(사용자 확정).
 * 그래야 설정 화면에 「어느 것을 편집할지」 고르는 줄이 안 생겨 지금처럼 깔끔하게 남는다.
 *
 * 섹션을 지워도 **항목 데이터는 남긴다**(3장 원칙) — 메뉴에서만 사라진다.
 */
import { useCallback, useEffect, useReducer } from 'react';
import { getRawSetting, setSetting } from './settingStore';
import { newId } from './postStore';

export type SectionKind =
  | 'gallery' | 'roadview' | 'trpg' | 'dotori' | 'playlog' | 'comm' | 'diary' | 'threads';

/** 섹션 종류별 기본 정보 — 설정 탭 이름과 페이지 주소 */
export const SECTION_META: Record<SectionKind, { label: string; href: string; defName: string }> = {
  gallery:  { label: '갤러리',    href: '/backup',   defName: '갤러리' },
  roadview: { label: '로드비',    href: '/roadview', defName: '로드비' },
  trpg:     { label: '로그 백업', href: '/trpg',     defName: '로그 백업' },
  dotori:   { label: '도토리',    href: '/dotori',   defName: '도토리' },
  playlog:  { label: '플레이기록', href: '/playlog', defName: '플레이기록' },
  comm:     { label: '커미션',    href: '/comm',     defName: '커미션' },
  diary:    { label: '다이어리',  href: '/diary',    defName: '다이어리' },
  threads:  { label: '감상타래',  href: '/threads',  defName: '감상타래' },
};

export const SECTION_KINDS = Object.keys(SECTION_META) as SectionKind[];

/** 기본 섹션 id — 이 id는 만들지도 지우지도 않는다(원래 있던 그 페이지) */
export const MAIN_SEC = 'main';

export interface SectionItem { id: string; name: string }

type SectionMap = Partial<Record<SectionKind, SectionItem[]>>;

const KEY = 'ohome.sections.v1';
const EVT = 'ohome-sections';

/** 저장된 목록 + 항상 맨 앞의 기본 섹션 */
export function sectionsOf(map: SectionMap, kind: SectionKind): SectionItem[] {
  const base: SectionItem = { id: MAIN_SEC, name: SECTION_META[kind].defName };
  const extra = (map[kind] ?? []).filter(s => s.id !== MAIN_SEC);
  // 기본 섹션 이름을 바꿔 뒀으면 그 이름을 쓴다
  const named = (map[kind] ?? []).find(s => s.id === MAIN_SEC);
  return [named ? { ...base, ...named } : base, ...extra];
}

/** 이 섹션의 주소 — 기본은 원래 주소 그대로, 나머지는 ?s=id */
export const sectionHref = (kind: SectionKind, id: string) =>
  (id === MAIN_SEC ? SECTION_META[kind].href : `${SECTION_META[kind].href}?s=${id}`);

/** 항목이 이 섹션 것인가 — 예전 데이터(secId 없음)는 전부 기본 섹션 소속 */
export const inSection = (secId: string | undefined, cur: string) =>
  (cur === MAIN_SEC ? !secId || secId === MAIN_SEC : secId === cur);

/* ---------- 저장 ---------- */
let cache: SectionMap = {};
let loaded = false;

function load() {
  if (loaded) return;
  try {
    const raw = getRawSetting(KEY);
    if (raw) cache = JSON.parse(raw) as SectionMap;
  } catch { /* 기본값 */ }
  loaded = true;
}

function notify() { try { window.dispatchEvent(new Event(EVT)); } catch { /* 무시 */ } }

/** 섹션 목록 — 설정 화면·메뉴 공용 */
export function useSections(): {
  map: SectionMap;
  list: (kind: SectionKind) => SectionItem[];
  setList: (kind: SectionKind, next: SectionItem[]) => void;
  add: (kind: SectionKind) => void;
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

  const setList = useCallback((kind: SectionKind, next: SectionItem[]) => {
    cache = { ...cache, [kind]: next };
    try { setSetting(KEY, cache); } catch { /* 무시 */ }
    notify();
  }, []);

  const add = useCallback((kind: SectionKind) => {
    const cur = sectionsOf(cache, kind);
    const next = [...(cache[kind] ?? []), { id: newId(), name: `새 ${SECTION_META[kind].label} ${cur.length}` }];
    cache = { ...cache, [kind]: next };
    try { setSetting(KEY, cache); } catch { /* 무시 */ }
    notify();
  }, []);

  return {
    map: cache,
    list: (kind: SectionKind) => sectionsOf(cache, kind),
    setList,
    add,
    loaded,
  };
}

/** 메뉴에 얹을 추가 항목 — 기본 섹션은 원래 메뉴가 이미 있으므로 뺀다 */
export function sectionMenuEntries(map: SectionMap): { id: string; name: string; href: string; anchor: string }[] {
  const out: { id: string; name: string; href: string; anchor: string }[] = [];
  for (const kind of SECTION_KINDS) {
    for (const s of sectionsOf(map, kind)) {
      if (s.id === MAIN_SEC) continue;
      out.push({ id: s.id, name: s.name, href: sectionHref(kind, s.id), anchor: SECTION_META[kind].href });
    }
  }
  return out;
}
