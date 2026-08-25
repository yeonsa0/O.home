'use client';
// 글·댓글 등 목록 저장이 서버에서 거부됐을 때 알림 (v2.0)
//
// 실패하면 화면을 서버 값으로 되돌리는데, 그것만으로는 "방금 쓴 글이 스스로 사라졌다"로만 보인다.
// 실제로 포크 사용자가 겪은 「댓글이 바로 지워지는」 증상이 이 모습이었다 — 원인(권한·보안 규칙)을
// 알 수 없어 전원을 관리자로 올리는 위험한 우회를 하게 됐다. 그래서 이유를 그 자리에서 알린다.
import { useEffect } from 'react';
import { useToast } from '@/components/ui/Toast';
import { LIST_ERR_EVT } from '@/lib/postStore';

const LABEL: Record<string, string> = {
  comments: '댓글',
  posts: '글',
  guestbook: '방명록',
  roadview: '로드비',
  characters: '캐릭터',
  relations: '자관',
  trpg_logs: 'TRPG 로그',
  trpg_log_bodies: 'TRPG 로그 본문',
  applicants: '커미션 신청',
};

export function ListSync() {
  const toast = useToast();
  useEffect(() => {
    let last = 0;
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { table?: string };
      // 한 동작이 여러 건을 건드려 줄줄이 실패해도 알림은 하나만
      const now = Date.now();
      if (now - last < 3000) return;
      last = now;
      const name = d.table ? (LABEL[d.table] ?? d.table) : '내용';
      toast(`${name}을(를) 저장하지 못했습니다 — 로그인 상태와 보안 규칙(환경설정 > 회원/보안)을 확인해 주세요`);
    };
    window.addEventListener(LIST_ERR_EVT, h);
    return () => window.removeEventListener(LIST_ERR_EVT, h);
  }, [toast]);
  return null;
}
