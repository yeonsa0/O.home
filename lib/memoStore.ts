'use client';
// 스티커 메모장 (4.6) — 포스트잇 보드 데이터 + 작성 권한/작성자 표시 설정
import { useCallback, useEffect, useState } from 'react';
import { getRawSetting, setSetting } from './settingStore';

export interface StickyMemo {
  id: string;
  text: string;
  author: string;            // 작성 당시 닉네임
  authorId: string;
  color: string;             // 포스트잇 배경 hex
  x: number; y: number;      // 보드 기준 % (0~100) — 배치는 저장되어 모두에게 동일
  rot: number;               // 기울기 deg
  z: number;                 // 겹침 순서
  size: 's' | 'm' | 'l';     // 크기
  date: string;              // ISO
}

export const MEMO_COLORS = ['#f4ecd7', '#dfe7dd', '#e7dfe4', '#dde4ea', '#efe3da'];
export const MEMO_SIZE_W: Record<StickyMemo['size'], number> = { s: 128, m: 158, l: 196 };

export interface MemoSettings {
  allowMember: boolean;      // 회원 작성 허용 (끄면 관리자만)
  showAuthor: boolean;       // 포스트잇에 작성자 표시
}
export const DEFAULT_MEMO_SETTINGS: MemoSettings = { allowMember: true, showAuthor: true };

const SET_KEY = 'ohome.memoset.v1';

export function useMemoSettings(): [MemoSettings, (patch: Partial<MemoSettings>) => void, boolean] {
  const [st, setSt] = useState<MemoSettings>(DEFAULT_MEMO_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = getRawSetting(SET_KEY);
      if (raw) setSt({ ...DEFAULT_MEMO_SETTINGS, ...JSON.parse(raw) });
    } catch { /* 기본값 */ }
    setLoaded(true);
  }, []);
  const patch = useCallback((p: Partial<MemoSettings>) => {
    setSt(s => {
      const n = { ...s, ...p };
      try { setSetting(SET_KEY, n); } catch { /* 무시 */ }
      return n;
    });
  }, []);
  return [st, patch, loaded];
}

/* ---------- 시드 (프로토타입 데모 계승) ---------- */
export const MEMO_SEED: StickyMemo[] = [];
