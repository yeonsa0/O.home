'use client';
// 회원 정보 페이지 (v1.9 사용자 요청) — 관리자 전용.
// 회원/보안 목록에서 이름을 누르면 진입: 프로필(아바타·닉네임·이메일·태그) ·
// 연동된 캐릭터(권한 부여분) · 작성한 글/댓글 전체 (myActivity 공용 수집).
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth, mockMemberInfo, User } from '@/lib/auth';
import {
  useLocalList, BOARD_SEED, GUEST_SEED, Post, GuestEntry, fmtDate,
  CommentRow, COMMENT_KEY, COMMENT_SEED,
} from '@/lib/postStore';
import { Character, CHAR_SEED, charGrant } from '@/lib/charStore';
import { RoadItem, ROAD_SEED } from '@/lib/galleryStore';
import { useBoards } from '@/lib/boardStore';
import { collectMyItems } from '@/lib/myActivity';
import { useBlobUrl } from '@/lib/blobStore';
import { CroppedBlobImg } from '@/components/ui/CropEditor';
import { PageTitle } from '@/components/ui/PageText';
import { getSetting } from '@/lib/settingStore';
import { useMembers } from '@/lib/members';
import { isServerMode } from '@/lib/backend';
import { Pager } from '@/components/ui/Kit';

const PER = 15;

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [posts] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  const [roads] = useLocalList<RoadItem>('ohome.road.v1', ROAD_SEED);
  const [guestEntries] = useLocalList<GuestEntry>('ohome.guest.v1', GUEST_SEED);
  // 댓글은 글과 따로 저장된다 (v2.0)
  const [cmtRows] = useLocalList<CommentRow>(COMMENT_KEY, COMMENT_SEED);
  const [chars] = useLocalList<Character>('ohome.chars.v1', CHAR_SEED);
  const { boards } = useBoards();
  const members = useMembers();

  const [member, setMember] = useState<User | null | undefined>(undefined); // undefined = 로딩
  const [tags, setTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  useEffect(() => {
    // 서버 모드에서는 가입 회원이 DB(profiles)에 있다 — 로컬 계정 목록에만 물으면 못 찾는다
    if (isServerMode()) {
      if (members.length === 0) return;                       // 아직 받아오는 중
      const hit = members.find(m => m.id === id);
      setMember(hit ? { id: hit.id, nickname: hit.nickname, role: hit.role ?? 'member' } : null);
    } else {
      setMember(mockMemberInfo(id));
    }
    setTags(getSetting<Record<string, string[]>>('ohome.membertags.v1', {})[id] ?? []);
  }, [id, members]);
  const avatarSrc = useBlobUrl(member?.avatarUrl);

  if (member === undefined) return <section className="page" />;
  if (!isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>MEMBER</PageTitle><p>관리자 전용 페이지</p></div>
      </section>
    );
  }
  if (!member) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>MEMBER</PageTitle><p>회원을 찾을 수 없습니다</p></div>
      </section>
    );
  }

  // 연동된 캐릭터 — 권한(play/edit)이 부여된 캐릭터
  const linked = chars
    .map(c => ({ c, level: charGrant(c, member.id) }))
    .filter((x): x is { c: Character; level: 'play' | 'edit' } => x.level !== null);

  const items = collectMyItems(member.id, posts, roads, guestEntries, boards, cmtRows);
  const pageItems = items.slice((page - 1) * PER, page * PER);

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>MEMBER</PageTitle>
        <p>{member.nickname} 회원 정보</p>
      </div>

      <div className="panel" style={{ padding: 24, maxWidth: 860, margin: '0 auto 14px' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* 아바타 — 이미지 / 단색·그라데이션 (이니셜 없음, v1.9 규칙) */}
          <div style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
            background: avatarSrc ? undefined : (member.avatarColor ?? 'linear-gradient(135deg,#6b7280,#3c434d)'),
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {avatarSrc && <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 18 }}>{member.nickname}</b>
              <span className="pill">{member.role === 'admin' ? '관리자' : '회원'}</span>
              {tags.map(t => <span key={t} className="pill">{t}</span>)}
            </div>
            <div style={{ marginTop: 5, fontSize: 12, color: 'var(--faint)' }}>
              {member.id}{member.email ? ` · ${member.email}` : ' · 이메일 미등록'}
            </div>
          </div>
        </div>

        {/* 연동된 캐릭터 (3차 회원-캐릭터 연결) */}
        <h3 style={{ marginTop: 20 }}>연동된 캐릭터</h3>
        {linked.length ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
            {linked.map(({ c, level }) => (
              <div key={c.id} onClick={() => router.push(`/chars/${c.id}`)}
                style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid var(--line)', borderRadius: 10, padding: '6px 12px 6px 6px', cursor: 'var(--cur-pointer,pointer)' }}>
                <div className={`ph ${c.thumbClass}`} style={{ width: 34, height: 34, borderRadius: 8, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                  {(c.thumbId ?? c.arts?.[0]) && <CroppedBlobImg fileRef={c.thumbId ?? c.arts?.[0]} crop={c.thumbCrop} ph={c.thumbClass} />}
                </div>
                <b style={{ fontSize: 12.5 }}>{c.name}</b>
                <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{level === 'edit' ? '편집까지' : '역극 플레이'}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="hint" style={{ marginTop: 6 }}>권한이 연동된 캐릭터가 없습니다</p>
        )}

        {/* 작성한 글·댓글 — 마이페이지와 같은 수집 (myActivity 공용) */}
        <h3 style={{ marginTop: 20 }}>작성한 글 · 댓글 <small style={{ color: 'var(--faint)', fontWeight: 400 }}>{items.length}건</small></h3>
        {pageItems.length ? pageItems.map((it, i) => (
          <div key={i} onClick={() => router.push(it.href)}
            style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 2px', borderBottom: '1px solid var(--line)', cursor: 'var(--cur-pointer,pointer)' }}>
            <span className="pill" style={{ flexShrink: 0 }}>{it.kind}</span>
            <span style={{ fontSize: 12.5, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.text}</span>
            <small style={{ marginLeft: 'auto', color: 'var(--faint)', fontSize: 10.5, whiteSpace: 'nowrap' }}>{fmtDate(it.date)}</small>
          </div>
        )) : <p className="hint" style={{ marginTop: 6 }}>작성한 글이 없습니다</p>}
        {items.length > PER && (
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
            <Pager page={page} total={Math.ceil(items.length / PER)} onChange={setPage} />
          </div>
        )}
      </div>
    </section>
  );
}
