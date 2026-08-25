'use client';
// 메뉴 관리 (5.2 — 메뉴 선택제) — 상위 메뉴를 자유롭게 만들고(생성·삭제·이름·순서)
// 하위 메뉴(기능 모듈)를 원하는 상위에 배치하는 자유 트리 (v1.9 개편).
// 트리에서 뺀 기능은 노출만 사라지고 데이터는 보존 (3장 원칙).
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_MENU, FEATURES, MenuItem } from './menu';
import { newId } from './postStore';
import { getRawSetting, setSetting } from './settingStore';

export type MenuPerm = 'guest' | 'member' | 'admin';

/** 메뉴 공개범위 (v1.9) — all: 전부 보임 / member: 비로그인에게 숨김 / admin: 관리자에게만 */
export type MenuVis = 'all' | 'member' | 'admin';

/** 트리의 하위 메뉴 한 항목 — label 없으면 기본 이름(FEATURES/게시판명) · pageTitle은 페이지 상단 큰 제목 덮어쓰기 */
export interface MenuLeaf { href: string; label?: string; pageTitle?: string; vis?: MenuVis }
/** 트리의 상위 한 항목 — href가 있으면 단독 메뉴(하위 없음) */
export interface MenuGroupNode { id: string; label: string; href?: string; items: MenuLeaf[]; pageTitle?: string; vis?: MenuVis }

export interface MenuSettings {
  tree?: MenuGroupNode[];            // 자유 메뉴 트리 (v1.9 — 없으면 v1 설정에서 마이그레이션)
  removedBoards: string[];           // 메뉴에서 뺀 추가 게시판 href (자동 배치 제외)
  // v1 유산 — 트리 마이그레이션 재료로만 사용
  groupOrder: string[];
  hidden: string[];
  labels: Record<string, string>;
  // 메뉴별 부속 설정 (스펙상 "메뉴 관리에서" 지정하는 것들)
  playlogPc: string[];               // 플레이기록 표시 열 — PC (4.16 v1.8)
  playlogMobile: string[];           //   〃 모바일 (기본 Date/Scenario/Role/Playtime)
  roadUpload: MenuPerm;              // 로드뷰 업로드 권한 (4.10 v1.7)
  roadComment: MenuPerm;             // 로드뷰 댓글 권한
  backupView: 'gal' | 'list';        // 갤러리(그림백업) 기본 보기 (5.2)
  calTitle: 'en' | 'num';            // 스케줄러 달 표기 (v1.9) — AUGUST 2026 / 2026.08
  imgProtect: ImgProtectArea[];      // 이미지 저장 방지 영역 (v1.9 — 우클릭·드래그 차단, 관리자 제외)
}

/** 이미지 저장 방지 영역 (v1.9) — 게시판은 갤러리·로드비 포함 */
export type ImgProtectArea = 'board' | 'comm' | 'tchar' | 'chars' | 'rels';

export const IMG_PROTECT_AREAS: { key: ImgProtectArea; label: string; paths: string[] }[] = [
  { key: 'board', label: '게시판 (갤러리·로드비 포함)', paths: ['/board', '/backup', '/roadview'] },
  { key: 'comm', label: '커미션', paths: ['/comm', '/comm-apply'] },
  { key: 'tchar', label: 'TRPG 캐릭터', paths: ['/tchars'] },
  { key: 'chars', label: '자캐 (캐릭터)', paths: ['/chars'] },
  { key: 'rels', label: '자관', paths: ['/rels'] },
];

/** 현재 경로가 속한 이미지 보호 영역 — 없으면 null */
export function imgProtectAreaFor(pathname: string): ImgProtectArea | null {
  for (const a of IMG_PROTECT_AREAS) {
    if (a.paths.some(p => pathname === p || pathname.startsWith(p + '/'))) return a.key;
  }
  return null;
}

/** 기본 트리 — DEFAULT_MENU 구조 그대로 */
export function defaultTree(): MenuGroupNode[] {
  return DEFAULT_MENU.map(m => m.children
    ? { id: `g-${m.label}`, label: m.label, items: m.children.map(c => ({ href: c.href })) }
    : { id: `g-${m.label}`, label: m.label, href: m.href, items: [] });
}

/** v1 설정(groupOrder/hidden/labels) → 트리 마이그레이션 */
function migrateTree(p: Partial<MenuSettings>): MenuGroupNode[] {
  const order = [
    ...(p.groupOrder ?? []).filter(k => DEFAULT_MENU.some(m => m.label === k)),
    ...DEFAULT_MENU.map(m => m.label).filter(k => !(p.groupOrder ?? []).includes(k)),
  ];
  const hidden = p.hidden ?? [];
  const labels = p.labels ?? {};
  return order
    .map(k => DEFAULT_MENU.find(m => m.label === k)!)
    .filter(m => !hidden.includes(m.label))
    .map(m => m.children
      ? {
        id: `g-${m.label}`, label: labels[m.label] ?? m.label,
        items: m.children.filter(c => !hidden.includes(c.href))
          .map(c => ({ href: c.href, ...(labels[c.href] ? { label: labels[c.href] } : {}) })),
      }
      : { id: `g-${m.label}`, label: labels[m.label] ?? m.label, href: m.href, items: [] });
}

export const newGroupId = () => `g-${newId()}`;

export const PLAYLOG_COLS: { key: string; label: string }[] = [
  { key: 'date', label: 'Date' },
  { key: 'scenario', label: 'Scenario' },
  { key: 'writer', label: 'Writer' },
  { key: 'with', label: 'With' },
  { key: 'role', label: 'Role' },
  { key: 'playtime', label: 'Playtime' },
  { key: 'url', label: 'Url' },
];

export const DEFAULT_MENU_SETTINGS: MenuSettings = {
  removedBoards: [],
  groupOrder: DEFAULT_MENU.map(m => m.label),
  hidden: [],
  labels: {},
  playlogPc: PLAYLOG_COLS.map(c => c.key),                       // PC 기본 전체 7열
  playlogMobile: ['date', 'scenario', 'role', 'playtime'],       // 모바일 기본 4열 (v1.8)
  roadUpload: 'member', roadComment: 'guest',
  backupView: 'gal',
  calTitle: 'en',
  imgProtect: [],
};

const KEY = 'ohome.menuset.v1';

export function useMenuSettings(): [MenuSettings, (patch: Partial<MenuSettings>) => void, boolean] {
  const [st, setSt] = useState<MenuSettings>(DEFAULT_MENU_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = getRawSetting(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<MenuSettings>;
        setSt({
          ...DEFAULT_MENU_SETTINGS,
          ...p,
          // v1(노출 온오프) 설정만 있으면 자유 트리로 마이그레이션 (v1.9)
          tree: p.tree ?? migrateTree(p),
        });
      }
    } catch { /* 기본값 */ }
    setLoaded(true);
    const sync = () => {
      try {
        const raw = getRawSetting(KEY);
        if (raw) setSt(s => ({ ...s, ...JSON.parse(raw) }));
      } catch { /* 무시 */ }
    };
    window.addEventListener('ohome-menuset', sync);
    return () => window.removeEventListener('ohome-menuset', sync);
  }, []);
  const patch = useCallback((p: Partial<MenuSettings>) => {
    setSt(s => {
      const n = { ...s, ...p };
      try { setSetting(KEY, n); } catch { /* 무시 */ }
      // 상단바(TopBar)가 같은 탭에서 즉시 갱신되도록
      setTimeout(() => window.dispatchEvent(new Event('ohome-menuset')), 0);
      return n;
    });
  }, []);
  return [st, patch, loaded];
}

/** 게시판 href — 추가 게시판은 /board?b=<id> */
export const extraBoardHref = (id: string) => `/board?b=${id}`;

/** 메뉴에 얹는 추가 항목 (v2.0) — 게시판뿐 아니라 갤러리·다이어리 등 「여러 개로 만든 섹션」 공통.
 *  anchor = 이 항목을 어느 기본 메뉴 뒤에 끼울지 (예: /diary 뒤) */
export interface ExtraEntry { id: string; name: string; href: string; anchor: string }

/** 게시판 목록을 추가 항목 형태로 (기본 게시판은 이미 메뉴에 있으므로 뺀다) */
export const boardEntries = (boards?: { id: string; name: string }[]): ExtraEntry[] =>
  (boards ?? []).filter(b => b.id !== 'main')
    .map(b => ({ id: b.id, name: b.name, href: extraBoardHref(b.id), anchor: '/board' }));

/** 메뉴 관리에서 지정한 페이지 상단 큰 제목 (5.2 v1.9) — 정확히 일치하는 href만, 없으면 null */
export function pageTitleFor(s: MenuSettings, href: string): string | null {
  for (const g of s.tree ?? []) {
    if (g.href === href) return g.pageTitle?.trim() || null;
    for (const it of g.items) if (it.href === href) return it.pageTitle?.trim() || null;
  }
  return null;
}

/** 기능 href의 기본 이름 — FEATURES + 추가 게시판명 (없으면 null = 사라진 기능) */
export function menuLabelFor(href: string, extra?: ExtraEntry[]): string | null {
  const f = FEATURES.find(x => x.href === href);
  if (f) return f.label;
  const e = extra?.find(x => x.href === href);
  return e ? e.name : null;
}

/** 설정을 적용한 실제 메뉴 트리 — 자유 트리(v1.9) 기반.
 *  extraBoards: 추가 생성한 게시판(5.2) — 트리에 아직 없으면 /board가 든 그룹에 자동 배치.
 *  viewer: 공개범위 필터(v1.9) — all/member/admin. 없으면 전부 표시(관리 화면용) */
export function buildMenu(
  s: MenuSettings,
  extra?: ExtraEntry[],
  viewer?: { loggedIn: boolean; isAdmin: boolean },
): MenuItem[] {
  const tree = s.tree ?? defaultTree();
  const placed = new Set(tree.flatMap(g => (g.href ? [g.href] : g.items.map(it => it.href))));
  const canSee = (vis?: MenuVis) => !viewer
    || (vis ?? 'all') === 'all'
    || (vis === 'member' && viewer.loggedIn)
    || (vis === 'admin' && viewer.isAdmin);

  const menu: MenuItem[] = tree
    .filter(g => canSee(g.vis))
    .map((g): MenuItem | null => {
      if (g.href) {
        return menuLabelFor(g.href, extra) === null ? null : { label: g.label, href: g.href };
      }
      const children = g.items
        .filter(it => canSee(it.vis))
        .map(it => {
          const def = menuLabelFor(it.href, extra);
          return def === null ? null : { href: it.href, label: it.label ?? def };
        })
        .filter((c): c is { href: string; label: string } => !!c);
      return { label: g.label, children };
    })
    .filter((m): m is MenuItem => !!m);

  // 새로 만든 섹션 자동 배치 — 트리에 없고 사용자가 뺀 적도 없으면 원래 메뉴(anchor) 뒤에
  for (const b of extra ?? []) {
    const href = b.href;
    if (placed.has(href) || s.removedBoards.includes(href)) continue;
    const host = menu.find(m => m.children?.some(c => c.href === b.anchor));
    if (host?.children) {
      const at = host.children.findIndex(c => c.href === b.anchor);
      host.children.splice(at + 1, 0, { href, label: b.name });
    } else {
      menu.push({ label: b.name, href });
    }
  }

  // 하위가 하나도 없는 그룹은 통째로 숨김
  return menu.filter(m => !m.children || m.children.length > 0);
}
