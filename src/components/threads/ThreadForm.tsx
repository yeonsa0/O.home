'use client';
// 감상타래 작품 등록/수정 폼 (4.17) — 페이지형 (등록: /threads/new · 수정: /threads/[id]/edit)
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocalList, newId } from '@/lib/postStore';
import { useSectionParam, secStamp, secQuery, MAIN_SEC } from '@/lib/sectionStore';
import { ThreadWork, THREAD_SEED, useThreadSettings, threadCats } from '@/lib/threadStore';
import { useFonts } from '@/lib/fontStore';
import { putBlob, useBlobUrl } from '@/lib/blobStore';
import { CropEditor, CropImg, CropValue } from '@/components/ui/CropEditor';
import { KInput, KSelect, KLabel } from '@/components/ui/Kit';
import { useToast } from '@/components/ui/Toast';

const PHS = ['cool', 'warm', 'pale', 'red'];

export function ThreadForm({ editId }: { editId?: string }) {
  // 1. 모든 리액트 훅(Hooks)을 최상단에 고정 선언 (리액트 #310 에러 완전 차단)
  const router = useRouter();
  const toast = useToast();
  const [works, setWorks, loaded] = useLocalList<ThreadWork>('ohome.threads.v1', THREAD_SEED);
  const sec = useSectionParam('threads');
  const [settings] = useThreadSettings();
  const { fonts, familyOf } = useFonts();

  const orig = editId ? works.find(w => w.id === editId) : undefined;
  const secId = orig ? (orig.secId ?? MAIN_SEC) : sec.id;
  const cats = threadCats(settings, secId);

  const [title, setTitle] = useState(orig?.title ?? '');
  const [fontId, setFontId] = useState(orig?.titleFontId ?? 'default');
  const [author, setAuthor] = useState(orig?.author ?? '');
  const [role, setRole] = useState(orig?.authorRole ?? '');
  const [catId, setCatId] = useState(orig?.catId ?? cats[0]?.id ?? 'book');
  const [vis, setVis] = useState<ThreadWork['visibility']>(orig?.visibility ?? 'public');
  const [poster, setPoster] = useState<File | null>(null);
  const [posterUrl, setPosterUrl] = useState('');
  const [crop, setCrop] = useState<CropValue | undefined>(orig?.posterCrop);
  const [cropOpen, setCropOpen] = useState(false);
  const posterRef = useRef<HTMLInputElement>(null);
  const origUrl = useBlobUrl(orig?.posterId);
  const previewUrl = posterUrl || origUrl;
  const hydrated = useRef(false);

  useEffect(() => {
    if (!orig && cats.length > 0 && !cats.some(c => c.id === catId)) setCatId(cats[0].id);
  }, [cats, orig, catId]);

  useEffect(() => {
    if (!editId || !loaded || hydrated.current) return;
    const o = works.find(w => w.id === editId);
    if (!o) return;
    hydrated.current = true;
    setTitle(o.title); setFontId(o.titleFontId ?? 'default');
    setAuthor(o.author); setRole(o.authorRole ?? '');
    setCatId(o.catId); setVis(o.visibility);
    setCrop(o.posterCrop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, loaded, works]);

  // 2. 모든 훅이 실행된 후에 조기 리턴 처리
  if (editId && !loaded) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text)' }}>불러오는 중...</div>;
  }

  const save = async () => {
    if (!title.trim()) { toast('작품명을 입력해 주세요'); return; }
    const posterId = poster ? await putBlob(poster) : orig?.posterId;
    if (orig) {
      setWorks(works.map(w => w.id === orig.id ? {
        ...w,
        title: title.trim(), titleFontId: fontId === 'default' ? undefined : fontId,
        author: author.trim(), authorRole: role.trim() || undefined,
        catId, visibility: vis, posterId, posterCrop: crop,
      } : w));
      toast('저장되었습니다');
    } else {
      const w: ThreadWork = {
        id: newId(),
        title: title.trim(), titleFontId: fontId === 'default' ? undefined : fontId,
        author: author.trim(), authorRole: role.trim() || undefined,
        catId, visibility: vis, posterId, posterCrop: crop,
        ph: PHS[works.length % PHS.length],
        created: new Date().toISOString(), posts: [],
      };
      setWorks([{ ...w, ...secStamp(sec.id) }, ...works]);
      toast('타래가 시작되었습니다');
    }
    router.push('/threads' + secQuery('threads', secId));
  };

  return (
    <>
      <div className="panel" style={{ maxWidth: 560, margin: '0 auto', padding: 26 }}>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <KLabel>Title</KLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              <KInput value={title} onChange={e => setTitle(e.target.value)}
                style={{ fontFamily: familyOf(fontId === 'default' ? undefined : fontId) }} />
              <KSelect minWidth={150} value={fontId} onChange={setFontId}
                options={[
                  { value: 'default', label: '기본 폰트' },
                  ...fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: familyOf(f.id) }}>{f.name}</span> })),
                ]} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <KLabel>Author</KLabel>
              <KInput value={author} onChange={e => setAuthor(e.target.value)} />
            </div>
            <div style={{ width: 140 }}>
              <KLabel>Role (optional)</KLabel>
              <KInput value={role} onChange={e => setRole(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div>
              <KLabel>Category</KLabel>
              <KSelect minWidth={130} value={catId} onChange={setCatId}
                options={cats.map(c => ({ value: c.id, label: c.label }))} />
            </div>
            <div>
              <KLabel>Visibility</KLabel>
              <KSelect minWidth={130} value={vis} onChange={v => setVis(v as ThreadWork['visibility'])}
                options={[
                  { value: 'public', label: '전체공개' },
                  { value: 'member', label: '멤버공개' },
                  { value: 'private', label: '나만보기' },
                ]} />
            </div>
          </div>
          <div>
            <KLabel>Poster</KLabel>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div
                style={{
                  width: 110, aspectRatio: '3/4', borderRadius: 9, overflow: 'hidden', cursor: 'var(--cur-pointer,pointer)',
                  border: '1.5px dashed var(--line)', position: 'relative', flexShrink: 0,
                }}
                onClick={() => posterRef.current?.click()}>
                {previewUrl && <CropImg src={previewUrl} crop={crop} />}
              </div>
              <input ref={posterRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) { setPoster(f); setPosterUrl(URL.createObjectURL(f)); setCrop(undefined); setCropOpen(true); }
                  e.target.value = '';
                }} />
              {previewUrl && (
                <button className="btn btn-ghost" style={{ padding: '5px 11px', fontSize: 11 }}
                  onClick={() => setCropOpen(true)}>✂ 위치·확대 조정</button>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
            <button className="btn btn-ghost" onClick={() => router.push('/threads' + secQuery('threads', secId))}>CANCEL</button>
            <button className="btn btn-dark" onClick={save}>{orig ? 'SAVE' : 'ADD'}</button>
          </div>
        </div>
      </div>
      {previewUrl && (
        <CropEditor open={cropOpen} src={previewUrl} aspect="3:4" initial={crop}
          onClose={() => setCropOpen(false)}
          onApply={c => { setCrop(c); setCropOpen(false); }} />
      )}
    </>
  );
}
