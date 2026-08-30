'use client';
// 마우스 커서 관리 (5.1 v1.1) — 상태별 커서 이미지(png 32px 권장) + 핫스팟 + 전체 on/off.
// 등록하지 않은 상태는 기본 커서로 폴백.
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

// 이동·크기조절 커서 분리 (v1.9 사용자 요청) — 이동/드래그 하나로 퉁치지 않고
// 윈도우 커서 세트처럼 이동 + 크기조절 4방향을 각각 등록
export type CursorState = 'default' | 'pointer' | 'text' | 'active' | 'grab'
  | 'rsNwse' | 'rsNesw' | 'rsEw' | 'rsNs';

export interface CursorEntry { imgId: string; hx: number; hy: number } // 핫스팟 (px)

export interface CursorSettings {
  enabled: boolean;
  states: Partial<Record<CursorState, CursorEntry>>;
}

export const CURSOR_STATE_LABEL: Record<CursorState, { label: string; desc: string }> = {
  default: { label: '기본', desc: '평상시' },
  pointer: { label: '포인터(호버)', desc: '링크·버튼 위' },
  text: { label: '텍스트', desc: '입력창·텍스트 위 (I-빔 대체)' },
  active: { label: '클릭 중', desc: '누르는 동안 (선택)' },
  grab: { label: '이동', desc: '위젯·스티커 드래그 이동 시 (선택)' },
  rsNwse: { label: '크기조절 ↘', desc: '대각선 크기 조절 1 — 위젯 우하단 핸들 (선택)' },
  rsNesw: { label: '크기조절 ↙', desc: '대각선 크기 조절 2 (선택)' },
  rsEw: { label: '크기조절 ↔', desc: '가로 크기 조절 (선택)' },
  rsNs: { label: '크기조절 ↕', desc: '세로 크기 조절 (선택)' },
};

export const DEFAULT_CURSOR_SETTINGS: CursorSettings = { enabled: true, states: {} };

const KEY = 'ohome.cursor.v1';
const EVT = 'ohome-cursor';

export function useCursorSettings(): [CursorSettings, (patch: Partial<CursorSettings>) => void, boolean] {
  const [st, setSt] = useState<CursorSettings>(DEFAULT_CURSOR_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const load = () => {
      try {
        const raw = getRawSetting(KEY);
        if (raw) setSt({ ...DEFAULT_CURSOR_SETTINGS, ...JSON.parse(raw) });
      } catch { /* 기본값 */ }
    };
    load();
    setLoaded(true);
    window.addEventListener(EVT, load);
    return () => window.removeEventListener(EVT, load);
  }, []);
  const patch = useCallback((p: Partial<CursorSettings>) => {
    setSt(s => {
      const n = { ...s, ...p };
      try { setSetting(KEY, n); } catch { /* 무시 */ }
      setTimeout(() => window.dispatchEvent(new Event(EVT)), 0);
      return n;
    });
  }, []);
  return [st, patch, loaded];
}
