'use client';
// 콘텐츠 저장 계층 (v2.0) — 백엔드 어댑터(Supabase/Firebase)에 그대로 넘긴다.
//
// 앱 전체는 "목록 배열을 통째로 바꿔 저장"하는 방식(useLocalList)이다.
// 그 호출부 86곳을 건드리지 않으면서 DB는 항목 1개 = 행/문서 1개로 두기 위해,
// 저장 시점에 이전/새 배열을 비교해 바뀐 것만 보낸다(어댑터의 syncList).
import { backend, COLLECTION_OF } from './backend';
import type { ListItem } from './backend';

export { COLLECTION_OF as TABLE_OF };

export async function fetchList<T extends ListItem>(coll: string): Promise<T[]> {
  const be = backend();
  return be ? be.fetchList<T>(coll) : [];
}

export async function syncList<T extends ListItem>(
  coll: string, prev: T[], next: T[], uid: string | null,
): Promise<void> {
  const be = backend();
  if (be) await be.syncList(coll, prev, next, uid);
}

export function subscribeTable(coll: string, onChange: () => void): () => void {
  const be = backend();
  return be ? be.subscribe(coll, onChange) : () => { /* 로컬 모드 */ };
}

/* ---------- 사이트 설정 (테마·메뉴·폰트·메인 위젯 등 key/value) ---------- */

export async function fetchSetting<T>(key: string): Promise<T | null> {
  const be = backend();
  return be ? be.fetchSetting<T>(key) : null;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const be = backend();
  if (be) await be.saveSetting(key, value);
}

export async function fetchAllSettings(): Promise<Record<string, unknown>> {
  const be = backend();
  return be ? be.fetchAllSettings() : {};
}
