'use client';
// BGM 저장소 (4.1) — 재생목록·설정 localStorage (→ Supabase 이전 예정)
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { newId } from './postStore';
import { getRawSetting, setSetting } from './settingStore';

export interface BgmTrack {
  id: string;
  title: string;
  desc: string;
  videoId: string;   // 유튜브 영상 ID
}

export interface BgmSettings {
  volume: number;              // 0~100 기본 볼륨
  position: 'br' | 'bl';       // 플레이어 위치 (기본: 오른쪽 아래, v1.4)
  shuffle: boolean;
  repeat: boolean;
  enabled: boolean;            // 플레이어 표시 여부
  autoplay: boolean;           // 입장 후 첫 상호작용 시 자동 재생 (4.1 — 정책상 완전 자동재생은 불가)
}

interface BgmState { tracks: BgmTrack[]; settings: BgmSettings }

const DEFAULT_STATE: BgmState = {
  // 데모 트랙 제거 (v1.9 사용자 발견 — 배포본 더미 데이터 정리에서 빠져 있었음)
  tracks: [],
  settings: { volume: 60, position: 'br', shuffle: false, repeat: true, enabled: true, autoplay: true },
};

const STORAGE_KEY = 'ohome.bgm.v1';

interface BgmCtx {
  state: BgmState;
  setTracks: (t: BgmTrack[]) => void;
  addTrack: (title: string, desc: string, urlOrId: string) => boolean;
  removeTrack: (id: string) => void;
  setSettings: (patch: Partial<BgmSettings>) => void;
}

const Ctx = createContext<BgmCtx | null>(null);

/** 유튜브 URL/ID → videoId 추출 */
export function parseVideoId(input: string): string | null {
  const s = input.trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function BgmStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<BgmState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const raw = getRawSetting(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BgmState;
        setState({ tracks: parsed.tracks ?? DEFAULT_STATE.tracks, settings: { ...DEFAULT_STATE.settings, ...parsed.settings } });
      }
    } catch { /* 기본값 */ }
  }, []);

  const persist = (s: BgmState) => {
    try { setSetting(STORAGE_KEY, s); } catch { /* 무시 */ }
  };

  const setTracks = useCallback((tracks: BgmTrack[]) => {
    setState(s => { const n = { ...s, tracks }; persist(n); return n; });
  }, []);

  const addTrack = useCallback((title: string, desc: string, urlOrId: string): boolean => {
    const vid = parseVideoId(urlOrId);
    if (!vid || !title.trim()) return false;
    setState(s => {
      const n = { ...s, tracks: [...s.tracks, { id: newId(), title: title.trim(), desc: desc.trim(), videoId: vid }] };
      persist(n); return n;
    });
    return true;
  }, []);

  const removeTrack = useCallback((id: string) => {
    setState(s => { const n = { ...s, tracks: s.tracks.filter(t => t.id !== id) }; persist(n); return n; });
  }, []);

  const setSettings = useCallback((patch: Partial<BgmSettings>) => {
    setState(s => { const n = { ...s, settings: { ...s.settings, ...patch } }; persist(n); return n; });
  }, []);

  return <Ctx.Provider value={{ state, setTracks, addTrack, removeTrack, setSettings }}>{children}</Ctx.Provider>;
}

export function useBgm(): BgmCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useBgm must be used within BgmStoreProvider');
  return ctx;
}
