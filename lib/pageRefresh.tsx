'use client';
// 같은 메뉴 재클릭 = 그 페이지를 처음 상태로 다시 그리기 (v1.9 사용자 확정)
// 브라우저 새로고침이 아니라 페이지 subtree만 remount — BGM·상단바 등 셸은 그대로 유지된다.
import React, { useEffect, useState } from 'react';

const EVT = 'ohome-page-refresh';

/** 지금 페이지를 초기 상태로 다시 렌더 (스크롤도 위로) */
export function refreshPage() {
  window.dispatchEvent(new Event(EVT));
}

/** children에 key를 걸어 remount — layout에서 <main> 안을 감싼다 */
export function PageFrame({ children }: { children: React.ReactNode }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const bump = () => {
      setN(v => v + 1);
      // 다시 들어온 느낌 — 스크롤 위로
      requestAnimationFrame(() => {
        document.getElementById('appMain')?.scrollTo({ top: 0 });
        window.scrollTo({ top: 0 });
      });
    };
    window.addEventListener(EVT, bump);
    return () => window.removeEventListener(EVT, bump);
  }, []);
  return <React.Fragment key={n}>{children}</React.Fragment>;
}
