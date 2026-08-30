'use client';
// (호환 창구) 예전 코드가 쓰던 이름들 — 실제 동작은 백엔드 어댑터가 한다.
// 새 코드는 '@/lib/backend'를 직접 쓸 것.
import { initBackend, backend, isServerMode as backendIsServerMode } from './backend';
import { loadServerConfig } from './serverConfig';

/** 앱 시작 시 1회 — 런타임 설정을 읽어 백엔드를 확정 */
export async function initSupabase() {
  return initBackend(await loadServerConfig());
}

export const isServerMode = () => backendIsServerMode();
export const hasBackend = () => backend() !== null;
