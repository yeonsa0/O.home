'use client';
// 내부 링크 정규화 (v1.9 사용자 요청) — 사용자가 풀주소(https://내사이트/rels/allow)를 붙여넣어도
// 현재 사이트 오리진을 떼고 /rels/allow 상대경로로 바꿔 저장·이동한다 (외부 주소는 그대로).
export function normalizeInternalLink(v: string): string {
  const s = v.trim();
  if (!s) return s;
  try {
    if (/^https?:\/\//i.test(s) && typeof window !== 'undefined') {
      const u = new URL(s);
      if (u.origin === window.location.origin) return u.pathname + u.search + u.hash;
    }
  } catch { /* 파싱 실패 — 입력 그대로 */ }
  return s;
}

/** 페이지 주소(slug) 유효성 — 영문 소문자·숫자·하이픈만, 1~40자 (v1.9) */
export const isValidSlug = (s: string) => /^[a-z0-9-]{1,40}$/.test(s);
export const slugify = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-');
