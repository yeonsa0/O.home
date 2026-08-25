'use client';
/**
 * 저장된 HTML 본문 — 안에 있는 이미지를 눌러 크게 볼 수 있다 (v2.0 사용자 요청).
 *
 * 본문은 에디터가 만든 HTML이라 이미지가 몇 장인지, 어떤 주소인지 미리 알 수 없다.
 * 그래서 렌더된 뒤 실제로 그려진 <img>를 훑어 목록을 만들고, 누른 것이 몇 번째인지로 라이트박스를 연다
 * (이미지마다 핸들러를 붙이지 않고 본문 한 곳에서 받는다 — 본문이 다시 그려져도 따라다닐 필요가 없다).
 *
 * 라이트박스는 파일 id도 주소도 받으므로, 저장소에 올린 이미지(https)든 본문에 심긴 것(data:)이든 그대로 열린다.
 */
import React, { useRef, useState } from 'react';
import { Lightbox } from '@/components/ui/Lightbox';

export function HtmlBody({ html, className, style }: {
  html: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [lb, setLb] = useState<{ srcs: string[]; i: number } | null>(null);

  const onClick = (e: React.MouseEvent) => {
    const img = (e.target as HTMLElement).closest('img');
    if (!img || !ref.current?.contains(img)) return;
    // 링크로 감싼 이미지는 그 링크가 할 일이 따로 있다 — 가로채지 않는다
    if (img.closest('a')) return;
    const all = [...ref.current.querySelectorAll('img')];
    const srcs = all.map(x => x.getAttribute('src') ?? '').filter(Boolean);
    const i = all.indexOf(img as HTMLImageElement);
    if (i < 0 || !srcs.length) return;
    setLb({ srcs, i });
  };

  return (
    <>
      <div ref={ref} className={`${className ?? ''} html-body`} style={style}
        onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
      {lb && <Lightbox srcs={lb.srcs} index={lb.i} onClose={() => setLb(null)} />}
    </>
  );
}
