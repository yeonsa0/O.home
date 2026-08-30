'use client';
// 카드 그리드/표 편집모드 드래그 정렬 (v1.9)
// 드래그 중 실시간 재배열 — 지나는 위치마다 자리가 비면서 다른 항목이 밀려나
// 어디로 들어갈지 그대로 보임 (스펙 6장 DnD UI 요구: placeholder가 열리는 느낌).
// 필터/검색으로 부분 표시 중이면 보이는 순서를 앞으로 두고 나머지를 뒤에 붙인다.
import { useRef, useState, type DragEvent, type CSSProperties } from 'react';

export function useCardSort<T>(shown: T[], save: (nextShown: T[]) => void, enabled: boolean) {
  const dragIdx = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const end = () => { dragIdx.current = null; setDraggingIdx(null); };

  const props = (i: number): Record<string, unknown> => {
    if (!enabled) return {};
    return {
      draggable: true,
      onDragStart: (e: DragEvent) => {
        dragIdx.current = i;
        setDraggingIdx(i);
        try { e.dataTransfer?.setData('text/plain', ''); } catch { /* 무시 */ }
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      },
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        const from = dragIdx.current;
        if (from == null || from === i) return;
        // 실시간 재배열 — 드래그 항목이 이 위치로 이동하며 자리가 열림
        const next = [...shown];
        const [moved] = next.splice(from, 1);
        next.splice(i, 0, moved);
        dragIdx.current = i;
        setDraggingIdx(i);
        save(next);
      },
      onDrop: (e: DragEvent) => { e.preventDefault(); end(); },
      onDragEnd: end,
      style: {
        cursor: 'var(--cur-grab,grab)',
        outline: draggingIdx === i ? '2px solid var(--accent)' : '1.5px dashed rgba(201,106,115,.55)',
        outlineOffset: 3,
        opacity: draggingIdx === i ? 0.35 : undefined,
        transition: 'opacity .12s',
      } as CSSProperties,
    };
  };

  return props;
}

/** 부분 표시(필터·검색) 중 정렬 저장 — 보이는 순서를 앞으로, 나머지는 기존 순서대로 뒤에 */
export function mergeOrder<T extends { id: string }>(all: T[], reorderedShown: T[]): T[] {
  const shownIds = new Set(reorderedShown.map(x => x.id));
  return [...reorderedShown, ...all.filter(x => !shownIds.has(x.id))];
}
