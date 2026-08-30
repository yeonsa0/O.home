'use client';
// 연결 검증 (v2.0) — 설치 화면의 [연결 확인]. 실제 점검은 각 백엔드 어댑터가 한다.
import { createBackend } from './backend';
import type { BackendConfig, BackendCheck } from './backend/types';

export type { BackendCheck as DbCheck };

export async function checkDb(cfg: BackendConfig): Promise<BackendCheck> {
  try {
    const be = await createBackend(cfg);
    return await be.check();
  } catch (e) {
    return {
      ok: false, reachable: false, schema: false, hasAdmin: false,
      message: `연결에 실패했습니다 — ${(e as { message?: string })?.message ?? '설정값을 다시 확인해 주세요.'}`,
    };
  }
}
