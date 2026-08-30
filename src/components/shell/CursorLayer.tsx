'use client';
// 커스텀 마우스 커서 적용 (5.1 v1.1 · v1.9 애니메이션) — 상태별 등록 이미지를 전역 스타일로 주입.
import { useEffect } from 'react';
import { useCursorSettings, CursorState } from '@/lib/cursorStore';
import { getBlob } from '@/lib/blobStore';
import { parseAni, isCur } from '@/lib/aniCursor';

const VAR_NAME: Partial<Record<CursorState, string>> = {
  default: '--cur-default', pointer: '--cur-pointer', grab: '--cur-grab', active: '--cur-active',
  rsNwse: '--cur-rs-nwse', rsNesw: '--cur-rs-nesw', rsEw: '--cur-rs-ew', rsNs: '--cur-rs-ns',
};

const RULES: Record<CursorState, { sel: string; fallback: string }> = {
  default: { sel: 'body, .page, .panel', fallback: 'auto' },
  pointer: {
    sel: [
      'a', 'button', 'label', '.btn', '.tag', '.pill', '.k-select', '.k-toggle', '.k-check', '.k-radio',
      '.rp-room', '.thr-item', '.memo-list-item', '.fc', '.g-item', '.char-card', '.rel-card',
      '.cm-card', '.dt-card', '.tc-card', '.list-item', '.brow', '.ap-row', '.ticket', '.more', '.cur',
    ].join(', '),
    fallback: 'pointer',
  },
  text: { sel: 'input, textarea, [contenteditable="true"], .re-content', fallback: 'text' },
  active: { sel: 'body:active, *:active', fallback: 'auto' },
  grab: { sel: '.drag-h, .postit:not(.ro), [draggable="true"], body.edit-on .page-main-wrap, body.edit-on .page-main-wrap *:not(.rs):not(.rr)', fallback: 'grab' },
  rsNwse: { sel: '.wgt .rs, .cur-rs-nwse', fallback: 'nwse-resize' },
  rsNesw: { sel: '.cur-rs-nesw', fallback: 'nesw-resize' },
  rsEw: { sel: '.cur-rs-ew', fallback: 'ew-resize' },
  rsNs: { sel: '.cur-rs-ns', fallback: 'ns-resize' },
};

interface AnimState { key: CursorState; urls: string[]; delays: number[] }

export function CursorLayer() {
  const [st] = useCursorSettings();

  useEffect(() => {
    const styleId = 'ohome-cursor-style';
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    
    if (!st.enabled || !st.states || Object.keys(st.states).length === 0) {
      styleEl?.remove();
      return;
    }

    let cancelled = false;
    const urls: string[] = [];
    const timers: number[] = [];

    (async () => {
      try {
        const staticParts: string[] = [];
        const anims: AnimState[] = [];

        for (const key of Object.keys(st.states) as CursorState[]) {
          const entry = st.states[key];
          if (!entry || !entry.imgId) continue;

          const blob = await getBlob(entry.imgId);
          if (!blob || cancelled) continue;

          const buf = await blob.arrayBuffer();
          if (cancelled) return;

          let ani = null;
          try {
            ani = parseAni(buf);
          } catch (e) {
            console.error('Failed to parse .ani cursor:', e);
          }

          if (ani && ani.frames && ani.frames.length > 0) {
            const frameUrls = ani.frames.map(f => {
              const u = URL.createObjectURL(f);
              urls.push(u);
              return u;
            });
            anims.push({ key, urls: ani.steps.map(i => frameUrls[i]), delays: ani.delays });
          } else {
            const url = URL.createObjectURL(blob);
            urls.push(url);
            const rule = RULES[key];
            if (!rule) continue;

            const hs = isCur(buf) ? '' : ` ${entry.hx ?? 0} ${entry.hy ?? 0}`;
            staticParts.push(`${rule.sel}{cursor:url("${url}")${hs}, ${rule.fallback} !important}`);
            
            const vn = VAR_NAME[key];
            if (vn) {
              staticParts.push(`:root{${vn}:url("${url}")${hs}, ${rule.fallback}}`);
            }
          }
        }

        if (cancelled) return;

        if (!styleEl || !document.getElementById(styleId)) {
          styleEl = document.createElement('style');
          styleEl.id = styleId;
          document.head.appendChild(styleEl);
        }

        const stepIdx: Partial<Record<CursorState, number>> = {};
        const render = () => {
          const animParts = anims.flatMap(a => {
            const rule = RULES[a.key];
            if (!rule) return [];
            const u = a.urls[stepIdx[a.key] ?? 0];
            const vn = VAR_NAME[a.key];
            return [
              `${rule.sel}{cursor:url("${u}"), ${rule.fallback} !important}`,
              ...(vn ? [`:root{${vn}:url("${u}"), ${rule.fallback}}`] : []),
            ];
          });
          if (styleEl) {
            styleEl.textContent = [...staticParts, ...animParts].join('\n');
          }
        };

        render();

        for (const a of anims) {
          if (a.urls.length < 2) continue;
          let i = 0;
          const tick = () => {
            if (cancelled) return;
            i = (i + 1) % a.urls.length;
            stepIdx[a.key] = i;
            render();
            timers.push(window.setTimeout(tick, a.delays[i] ?? 100));
          };
          timers.push(window.setTimeout(tick, a.delays[0] ?? 100));
        }
      } catch (err) {
        console.error('Error applying custom cursor styles:', err);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(t => clearTimeout(t));
      urls.forEach(u => URL.revokeObjectURL(u));
      document.getElementById(styleId)?.remove();
    };
  }, [st]);

  return null;
}
