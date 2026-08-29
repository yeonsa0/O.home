'use client';
// 게시판 글쓰기/수정 (4.2 / 5.2 다중 게시판) — MD/HTML 모드 선택 + 실시간 미리보기 + 접기/비밀글/공지 설정
// ?edit=<글 id> 로 진입하면 수정 모드 (작성자·관리자만)
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList, BOARD_SEED, Post, newId, FoldType } from '@/lib/postStore';
import { useBoards, boardHref, MAIN_BOARD_ID } from '@/lib/boardStore';
import { renderBody } from '@/lib/sanitize';
import { KInput, KTextarea, KSelect, KCheck } from '@/components/ui/Kit';
import { CropEditor, CropImg, CropValue } from '@/components/ui/CropEditor';
import { RichEditor } from '@/components/ui/RichEditor';
import { PaintCanvas, PaintCanvasHandle } from '@/components/paint/PaintCanvas';
import { putBlob } from '@/lib/blobStore';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

/** 본문에서 첫 이미지 추출 (그림판 이어그리기/수정 시 기존 그림 불러오기용) */
function firstImage(body: string): string | undefined {
  const html = /<img[^>]*src=["']([^"']+)["']/i.exec(body);
  return html ? html[1] : undefined;
}

function WriteInner() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const editPid = params.get('edit');
  const originId = params.get('origin'); // 그림판 이어그리기 — 원본 글 id
  const [posts, setPosts, postsLoaded] = useLocalList<Post>('ohome.board.v1', BOARD_SEED);
  const editing = editPid ? posts.find(p => p.id === editPid) : undefined;
  const bid = editing?.boardId ?? params.get('b') ?? MAIN_BOARD_ID;
  const { boards } = useBoards();
  const board = boards.find(b => b.id === bid) ?? boards[0];
  const isPaint = board.skin === 'paint';
  const originPost = originId ? posts.find(p => p.id === originId) : undefined;
  const canvasRef = useRef<PaintCanvasHandle | null>(null);
  // 그림판 캔버스에 처음 얹을 이미지 — 수정 중이면 기존 그림, 이어그리기면 원본 글 그림
  const paintBaseImage = editing ? firstImage(editing.body) : (originPost ? firstImage(originPost.body) : undefined);
  const [title, setTitle] = useState('');
  const [writeMode, setWriteMode] = useState<'editor' | 'md' | 'html'>('editor'); // 에디터가 기본
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('');
  // 말머리 기본값 — 게시판별 목록(5.2) 로드 후 첫 항목
  React.useEffect(() => { if (!category && board.cats[0]) setCategory(board.cats[0].label); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.cats.length]);
  const [secret, setSecret] = useState(false);
  const [notice, setNotice] = useState(false);
  const [foldType, setFoldType] = useState<FoldType | 'none'>('none');
  const [foldLabel, setFoldLabel] = useState('');
  // 티켓 스킨 대표 이미지 (v1.9) — 본문에 삽입한 이미지 중 선택 + 16:9 썸네일 크롭
  const [thumbSrc, setThumbSrc] = useState<string | undefined>(undefined);
  const [thumbCrop, setThumbCrop] = useState<CropValue | undefined>(undefined);
  const [cropOpen, setCropOpen] = useState(false);
  // 본문 이미지 목록 — HTML <img> + Markdown 이미지
  const bodyImages = useMemo(() => {
    const out: string[] = [];
    for (const m of body.matchAll(/<img[^>]*src=["']([^"']+)["']/gi)) out.push(m[1]);
    for (const m of body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) out.push(m[1]);
    return [...new Set(out)];
  }, [body]);
  // 대표로 지정한 이미지가 본문에서 삭제되면 해제
  useEffect(() => {
    if (thumbSrc && !bodyImages.includes(thumbSrc)) { setThumbSrc(undefined); setThumbCrop(undefined); }
  }, [bodyImages, thumbSrc]);

  // 수정 모드 — 저장본 로드가 끝나면 폼을 한 번 채움 (본문은 저장 모드 그대로: md→Markdown, html→HTML)
  const hydrated = useRef(false);
  useEffect(() => {
    if (!editPid || !postsLoaded || hydrated.current) return;
    const p = posts.find(x => x.id === editPid);
    if (!p) return;
    hydrated.current = true;
    setTitle(p.title); setBody(p.body);
    // 에디터로 쓴 글은 에디터로 다시 연다 — 예전에는 무조건 HTML 소스가 떠서
    // 에디터로 쓴 글을 수정하면 갑자기 태그가 보였다 (authored 없는 옛 글은 지금까지대로 HTML)
    setWriteMode(p.mode === 'md' ? 'md' : (p.authored === 'editor' ? 'editor' : 'html'));
    setCategory(p.category);
    setSecret(p.secret); setNotice(p.notice);
    setFoldType(p.fold?.type ?? 'none'); setFoldLabel(p.fold?.label ?? '');
    setThumbSrc(p.thumbSrc); setThumbCrop(p.thumbCrop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editPid, postsLoaded, posts]);

  const preview = useMemo(() => renderBody(writeMode === 'md' ? 'md' : 'html', body), [writeMode, body]);

  if (!user) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>WRITE</PageTitle><p>글쓰기는 로그인 후 이용할 수 있습니다</p></div>
      </section>
    );
  }

  const post = async () => {
    if (!title.trim()) { toast('제목을 입력해 주세요'); return; }
    let finalBody = body;
    if (isPaint) {
      const hasDrawing = canvasRef.current?.hasDrawing();
      if (!editing && !paintBaseImage && !hasDrawing) { toast('그림을 그려 주세요'); return; }
      const blob = await canvasRef.current?.exportBlob();
      if (!blob) { toast('그림을 저장하지 못했습니다 — 브라우저를 새로고침한 뒤 다시 시도해 주세요'); return; }
      const ref = await putBlob(blob);
      finalBody = `<img src="${ref}" alt="${title.trim()}">`;
    } else if (!body.trim()) {
      toast('제목과 내용을 입력해 주세요'); return;
    }
    if (editing) {
      // 수정 — 작성자 본인만 (관리자도 타인 글은 삭제만, v1.9). 작성자/날짜/댓글/소속 게시판은 유지
      if (editing.authorId !== user.id) { toast('수정은 작성자 본인만 할 수 있습니다'); return; }
      setPosts(posts.map(p => (p.id === editing.id ? {
        ...p,
        title: title.trim(), body: finalBody,
        mode: isPaint ? 'html' : (writeMode === 'md' ? 'md' : 'html'),
        authored: isPaint ? undefined : (writeMode === 'editor' ? 'editor' : undefined),
        category,
        secret, notice: isAdmin ? notice : p.notice,
        fold: foldType === 'none' ? null : { type: foldType, label: foldType === 'custom' ? foldLabel : undefined },
        thumbSrc, thumbCrop,
      } : p)));
      toast('수정되었습니다');
      router.push(`/board/${editing.id}`);
      return;
    }
    const p: Post = {
      id: newId(), title: title.trim(), body: finalBody,
      mode: isPaint ? 'html' : (writeMode === 'md' ? 'md' : 'html'), category,
      author: user.nickname, authorId: user.id, date: new Date().toISOString(),
      secret, notice: isAdmin && notice,
      fold: foldType === 'none' ? null : { type: foldType, label: foldType === 'custom' ? foldLabel : undefined },
      comments: [],
      boardId: board.id,   // 소속 게시판 (5.2 다중 게시판)
      thumbSrc, thumbCrop,
      originId: isPaint ? (originId ?? undefined) : undefined,
    };
    setPosts([p, ...posts]);
    toast('등록되었습니다');
    router.push(`/board/${p.id}`);
  };

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>{isPaint ? (editing ? '그림 수정' : originId ? '이어그리기' : '새 그림 그리기') : (editing ? 'EDIT' : 'WRITE')}</PageTitle>
        <EditableDesc k="board-write-desc" def="에디터 / Markdown / HTML — 스크립트는 저장 시 자동 제거" />
      </div>
      <div className="write-grid">
        {/* 좌: 본문 */}
        <div className="panel" style={{ padding: 24 }}>
          <div className="form-row">
            <label className="k-label" style={{ width: 60 }}>제목</label>
            <KInput value={title} onChange={e => setTitle(e.target.value)} style={{ flex: 1 }} />
          </div>
          {isPaint ? (
            <PaintCanvas ref={canvasRef} initialImageUrl={paintBaseImage} lockSize={!!paintBaseImage} />
          ) : (
            <>
              <div className="form-row">
                <label className="k-label" style={{ width: 60 }}>모드</label>
                <div className="mini-seg">
                  <button className={writeMode === 'editor' ? 'on' : ''} onClick={() => setWriteMode('editor')}>에디터</button>
                  <button className={writeMode === 'md' ? 'on' : ''} onClick={() => setWriteMode('md')}>Markdown</button>
                  <button className={writeMode === 'html' ? 'on' : ''} onClick={() => setWriteMode('html')}>HTML</button>
                </div>
              </div>
              {writeMode === 'editor' ? (
                <RichEditor value={body} onChange={setBody} placeholder='내용을 작성하세요 — 이미지 삽입 가능 (스크립트 불허 6.3)' />
              ) : (
                <>
                  <KTextarea
                    style={{ minHeight: 220, fontFamily: writeMode === 'html' ? 'ui-monospace, Consolas, monospace' : undefined }}
                    placeholder={writeMode === 'md' ? '마크다운으로 작성...' : '<div>HTML 코드를 작성/붙여넣기...</div>'}
                    value={body} onChange={e => setBody(e.target.value)}
                  />
                  <div className="preview-box" style={{ marginTop: 14 }}>
                    <div className="pv-label">PREVIEW — 실시간 미리보기</div>
                    <div className="post-body" dangerouslySetInnerHTML={{ __html: preview }} />
                  </div>
                </>
              )}
            </>
          )}
          {/* 티켓 스킨 대표 이미지 — 본문에 삽입한 이미지 리스트에서 선택, 클릭 시 16:9 썸네일 위치 지정 (v1.9) */}
          {board.skin === 'ticket' && bodyImages.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <label className="k-label" style={{ marginBottom: 7 }}>대표 이미지 (티켓 썸네일)</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {bodyImages.map(src => (
                  <div key={src}
                    data-tip={thumbSrc === src ? '썸네일 위치 조정' : '대표로 선택'}
                    onClick={() => { if (thumbSrc !== src) { setThumbSrc(src); setThumbCrop(undefined); } setCropOpen(true); }}
                    style={{
                      width: 104, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', cursor: 'var(--cur-pointer,pointer)',
                      position: 'relative', flexShrink: 0,
                      outline: thumbSrc === src ? '2px solid var(--accent)' : '1px solid var(--line)', outlineOffset: 2,
                    }}>
                    <CropImg src={src} crop={thumbSrc === src ? thumbCrop : undefined} />
                    {thumbSrc === src && (
                      <span style={{
                        position: 'absolute', right: 4, top: 4, fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                        background: 'var(--accent)', color: '#fff', padding: '2px 6px', borderRadius: 999,
                      }}>대표</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* 우: 설정 */}
        <div>
          <div className="panel widget" style={{ marginBottom: 14 }}>
            <h4>설정</h4>
            <div className="form-row">
              <label className="k-label" style={{ width: 60 }}>말머리</label>
              <KSelect minWidth={130} value={category} onChange={setCategory}
                options={board.cats.map(x => ({ value: x.label, label: x.label }))} placeholder='말머리 선택' />
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              <KCheck label="비밀글 (관리자와 나만 열람)" checked={secret} onChange={setSecret} />
              {isAdmin && <KCheck label="공지로 고정" checked={notice} onChange={setNotice} />}
            </div>
          </div>
          <div className="panel widget" style={{ marginBottom: 14 }}>
            <h4>접기 (6.2)</h4>
            <div style={{ display: 'grid', gap: 9 }}>
              <KCheck label="스포일러 접기" checked={foldType === 'spoiler'}
                onChange={v => setFoldType(v ? 'spoiler' : 'none')} />
              <KCheck label="수위 주의 접기" checked={foldType === 'adult'}
                onChange={v => setFoldType(v ? 'adult' : 'none')} />
              <KCheck label="직접 입력 문구" checked={foldType === 'custom'}
                onChange={v => setFoldType(v ? 'custom' : 'none')} />
              {foldType === 'custom' && (
                <KInput placeholder="접기 문구" value={foldLabel} onChange={e => setFoldLabel(e.target.value)} />
              )}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn btn-onbk"
              onClick={() => router.push(editing ? `/board/${editing.id}` : boardHref(board.id))}>CANCEL</button>
            <button className="btn btn-accent" onClick={post}>{editing ? 'SAVE' : 'POST'}</button>
          </div>
        </div>
      </div>

      {/* 대표 썸네일 위치 지정 — 16:9 (티켓 스킨) */}
      {cropOpen && thumbSrc && (
        <CropEditor open src={thumbSrc} aspect="16:9" initial={thumbCrop}
          onClose={() => setCropOpen(false)}
          onApply={c => { setThumbCrop(c); setCropOpen(false); }} />
      )}
    </section>
  );
}

export default function BoardWritePage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><WriteInner /></Suspense>;
}
