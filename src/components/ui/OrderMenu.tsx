'use client';
/**
 * 순서 번호로 자리 옮기기 (v2.0 사용자 요청).
 *
 * 목록이 페이지로 나뉘면 드래그로는 1페이지 것을 3페이지로 보낼 수가 없다. 그래서 우클릭해서
 * **번호를 직접 적어** 자리를 옮긴다.
 *
 * 번호는 따로 저장하지 않고 **자리에서 만들어 쓴다** — 첫째가 10, 둘째가 20 … 이렇게 10단위다.
 * 저장해 두면 드래그로 순서를 바꿀 때마다 번호를 따로 손봐 줘야 하고, 그러다 번호와 실제 순서가
 * 어긋나면 어느 쪽이 맞는지 알 수 없게 된다. 자리에서 만들면 **배치를 바꾸는 순간 번호가 저절로
 * 맞아떨어진다**(사용자 요청: 「숫자정렬은 배치 바꿀 때 알아서 고쳐주고」).
 *
 * 10단위라 사이에 끼워 넣을 자리가 늘 남는다 — 10과 20 사이에 넣고 싶으면 15라고 적으면 된다.
 */
import React, { useEffect, useRef, useState } from 'react';

/** 이 자리(0부터)의 순서 번호 — 10, 20, 30 … */
export const orderNoOf = (index: number) => (index + 1) * 10;

/**
 * `from` 번째 항목을 번호 `wanted`가 가리키는 자리로 옮긴 새 목록.
 *
 * 옮기는 항목을 뺀 나머지는 **원래 번호를 그대로 지킨 채** 견준다. 빠진 자리를 메워 번호가
 * 앞으로 당겨지면, 사용자가 화면에서 본 번호와 뜻이 달라진다 — 20번 뒤에 놓으려고 25를 적었는데
 * 20번이 10번이 되어 버리면 엉뚱한 자리로 간다.
 */
export function moveToOrder<T>(list: T[], from: number, wanted: number): T[] {
  if (from < 0 || from >= list.length) return list;
  const moved = list[from];
  const others = list
    .map((it, i) => ({ it, no: orderNoOf(i) }))
    .filter((_, i) => i !== from);
  let to = others.findIndex(o => o.no >= wanted);
  if (to < 0) to = others.length;              // 제일 큰 번호보다 크면 맨 뒤
  const next = others.map(o => o.it);
  next.splice(to, 0, moved);
  return next;
}

/** 우클릭 자리에 뜨는 번호 입력 — Enter로 적용, Esc·바깥 클릭으로 닫기 */
export function OrderMenu({ at, current, total, onApply, onClose }: {
  at: { x: number; y: number };
  current: number;                 // 지금 번호 (10단위)
  total: number;                   // 전체 개수 — 안내 문구용
  onApply: (wanted: number) => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(String(current));
  const ref = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    // 바깥을 누르면 닫는다 — 메뉴 안을 누른 건 빼고
    const down = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('mousedown', down);
    // 스크롤하면 메뉴만 남아 떠다니므로 닫는다 (다른 우클릭 메뉴와 같은 규칙)
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('mousedown', down);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [onClose]);

  const apply = () => {
    const n = parseFloat(v.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(n)) { onClose(); return; }
    onApply(n);
  };

  // 화면 밖으로 나가지 않게 (메뉴 크기만큼 물려 둔다)
  const left = Math.min(at.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 190);
  const top = Math.min(at.y, (typeof window !== 'undefined' ? window.innerHeight : 9999) - 130);

  return (
    <div ref={boxRef} className="ctx-menu on" style={{ left, top, minWidth: 176, padding: 10 }}
      onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      <div className="ctx-ttl" style={{ padding: '0 0 7px' }}>순서 번호</div>
      <input
        ref={ref}
        className="ord-input"
        value={v}
        inputMode="decimal"
        onChange={e => setV(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); apply(); }
        }} />
      <p className="ord-hint">
        1~{orderNoOf(total - 1)} · 사이에 넣으려면 15처럼
      </p>
      <button style={{ textAlign: 'center', marginTop: 2 }} onClick={apply}>이 번호로 옮기기</button>
    </div>
  );
}
