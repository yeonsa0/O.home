'use client';
// 내가 쓴 글/댓글 전체 리스트 (마이페이지, v1.9) — 게시판형 페이지네이션, 클릭 시 해당 글로 이동
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  useLocalList, BOARD_SEED, GUEST_SEED, Post, GuestEntry, fmtDate,
  CommentRow, COMMENT_KEY, COMMENT_SEED,
} from '@/lib/postStore';
import { RoadItem, ROAD_SEED } from '@/lib/galleryStore';
import { useBoards } from '@/lib/boardStore';
import { collectMyItems } from '@/lib/myActivity';
import { Pager } from '@/components/ui/Kit';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

const PER_PAGE = 15;

export default function MyPostsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [posts] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  const [roads] = useLocalList<RoadItem>('ohome.road.v1', ROAD_SEED);
  const [guestEntries] = useLocalList<GuestEntry>('ohome.guest.v1', GUEST_SEED);
  // 댓글은 글과 따로 저장된다 (v2.0)
  const [cmtRows] = useLocalList<CommentRow>(COMMENT_KEY, COMMENT_SEED);
  const { boards } = useBoards();
  const [page, setPage] = useState(1);

  if (!user) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle href="/mypage">MY POSTS</PageTitle><p>로그인 후 이용할 수 있습니다</p></div>
      </section>
    );
  }

  const items = collectMyItems(user.id, posts, roads, guestEntries, boards, cmtRows);
  const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
  const pageList = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle href="/mypage">MY POSTS</PageTitle>
        <EditableDesc k="mypage-posts-desc" def="내가 쓴 글과 댓글" />
      </div>
      <div className="panel board-list flush" style={{ maxWidth: 760, margin: '0 auto' }}>
        {pageList.map((it, i) => (
          <div className="brow" key={i} style={{ gridTemplateColumns: '96px 1fr 60px' }}
            onClick={() => router.push(it.href)}>
            <span className="cat"><span className="pill">{it.kind}</span></span>
            <b>{it.text}</b>
            <span className="dt">{fmtDate(it.date)}</span>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ padding: 36, textAlign: 'center', fontSize: 12.5, color: 'var(--faint)' }}>작성한 글이 없습니다</div>
        )}
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
        <Pager page={page} total={totalPages} onChange={setPage} />
      </div>
    </section>
  );
}
