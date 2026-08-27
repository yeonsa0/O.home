'use client';

// 메인 위젯 렌더러 (4.0) — DIARY/LATEST/UPCOMING 등은 해당 기능(2·3차) 전까지 데모 데이터

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WidgetConf, useMainStore, WIDGET_META, decoSlides } from '@/lib/mainStore';
import { useAuth } from '@/lib/auth';
import { boardEntries, useMenuSettings, buildMenu, canViewHref } from '@/lib/menuStore';
import { sectionHref, MAIN_SEC, useSections, sectionMenuEntries } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries } from '@/lib/linkStore';
import { useBoards } from '@/lib/boardStore';
import { Modal } from '@/components/ui/Modal';
import { KTextarea, KSelect, KStep, KCheck } from '@/components/ui/Kit';
import { ColorField } from '@/components/ui/ColorField';
import { useFonts } from '@/lib/fontStore';
import { BannerEditor, BannerSlide, DEMO_SLIDES, DdayEditor, DecoEditor, TodoEditor, TodoSetItem } from '@/components/main/widgetEditors';
import { CroppedBlobImg, CropValue } from '@/components/ui/CropEditor';
import { useLocalList } from '@/lib/postStore';
import { RoadItem, ROAD_SEED, BackupPost, BACKUP_SEED } from '@/lib/galleryStore';
import { DiaryPost, DIARY_SEED, Mood, MOOD_SEED, moodTint } from '@/lib/diaryStore';
import { useSched, eventColor } from '@/lib/schedStore';
import { StickyMemo, MEMO_SEED, MEMO_SIZE_W, useMemoSettings } from '@/lib/memoStore';
import { BlobImg, useBlobUrl } from '@/lib/blobStore';
import { normalizeInternalLink } from '@/lib/link';
import {
  Applicant, APPLY_SEED, useCommSettings, badgeStyle, maskName, inTrash,
} from '@/lib/commStore';

/* 편집모드 우클릭 「설정」 → 해당 위젯의 설정 모달 열기 (v1.9 사용자 확정 — 이벤트로 연결) */
function useEditEvent(id: string, onOpen: () => void) {
  useEffect(() => {
    const h = (e: Event) => { if ((e as CustomEvent).detail?.id === id) onOpen(); };
    window.addEventListener('ohome-widget-edit', h);
    return () => window.removeEventListener('ohome-widget-edit', h);
  }, [id, onOpen]);
}

/* ---------- 슬라이드 배너 (고정 요소, 4.0) — 이미지·링크·간격·순서 관리 ---------- */

export function BannerWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn } = useMainStore();
  const router = useRouter();
  const [cur, setCur] = useState(0);
  const [mngOpen, setMngOpen] = useState(false);
  useEditEvent(conf.id, () => setMngOpen(true));   // 편집모드 우클릭 → 설정 (v1.9)
  const slides = ((conf.settings.slides as BannerSlide[]) ?? []).length > 0
    ? (conf.settings.slides as BannerSlide[]) : DEMO_SLIDES;
  const interval = (conf.settings.interval as number) ?? 4;

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setCur(c => (c + 1) % slides.length), Math.max(2, interval) * 1000);
    return () => clearInterval(t);
  }, [slides.length, interval]);

  const s = slides[Math.min(cur, slides.length - 1)];
  const go = () => {
    if (editOn || !s.link) return;
    const l = normalizeInternalLink(s.link);
    if (/^https?:\/\//.test(l)) window.open(l, '_blank');
    else router.push(l);
  };

  return (
    <div className="banner" style={{ cursor: s.link && !editOn ? 'pointer' : undefined }} onClick={go}>
      {slides.map((sl, i) => (
        <div key={sl.id} className={`slide ${i === Math.min(cur, slides.length - 1) ? 'on' : ''}`}>
          {sl.imgId
            ? <CroppedBlobImg fileRef={sl.imgId} crop={sl.crop} ph="" />
            : sl.img
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={sl.img} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div className={`ph ${sl.cls ?? ''}`} style={{ position: 'absolute', inset: 0 }}><span>SLIDE BANNER {String(i + 1).padStart(2, '0')}</span></div>}
        </div>
      ))}
      <div className="cap"><b>{s.cap}</b><span>{s.sub}</span></div>
      <div className="dots" onClick={e => e.stopPropagation()}>
        {slides.map((sl, i) => (
          <i key={sl.id} className={i === Math.min(cur, slides.length - 1) ? 'on' : ''} onClick={() => setCur(i)} />
        ))}
      </div>
      {isAdmin && !editOn && (
        <button className="hv-actions"
          style={{
            position: 'absolute', top: 10, right: 10, zIndex: 4, fontSize: 10.5, letterSpacing: '.06em',
            padding: '5px 11px', borderRadius: 999, background: 'rgba(15,17,20,.55)', color: '#dfe2e7',
          }}
          onClick={e => { e.stopPropagation(); setMngOpen(true); }}>MANAGE</button>
      )}
      <div onClick={e => e.stopPropagation()}>
        <Modal open={mngOpen} onClose={() => setMngOpen(false)} title="슬라이드 배너 관리"
          desc="이미지 업로드 · 캡션 · 링크(내부 경로 또는 외부 URL) · ⠿ 드래그로 순서 · 원본은 잘리지 않음">
          {mngOpen && <BannerEditor conf={conf} onSaved={() => setMngOpen(false)} onClose={() => setMngOpen(false)} />}
        </Modal>
      </div>
    </div>
  );
}

/* ---------- 메뉴리스트 (모바일 전용, 8장) ---------- */

export function MenuListWidget() {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [menuSet, , menuLoaded] = useMenuSettings();
  const { boards, loaded: boardsLoaded } = useBoards();
  const { user: wUser, isAdmin: wIsAdmin } = useAuth();
  const { map: wSecMap } = useSections();
  const { links: wLinks } = useCustomLinks();
  return (
    <div className="panel menu-list wgt-menu">
      {(menuLoaded && boardsLoaded
        ? buildMenu(menuSet, [...boardEntries(boards), ...sectionMenuEntries(wSecMap), ...linkEntries(wLinks)], { loggedIn: !!wUser, isAdmin: wIsAdmin })
        : []).map(m =>
        m.children ? (
          <div key={m.label} className={`mgrp ${open === m.label ? 'open' : ''}`}>
            <a onClick={() => setOpen(o => (o === m.label ? null : m.label))}>{m.label}</a>
            <div className="msub">
              {m.children.map(c => <a key={c.href} onClick={() => router.push(c.href)}>{c.label}</a>)}
            </div>
          </div>
        ) : (
          <a key={m.label} onClick={() => router.push(m.href!)}>{m.label}</a>
        )
      )}
    </div>
  );
}

/* ---------- MEMO — 관리자 클릭 시 큰 편집 모달 (4.12 v1.8) ---------- */

export function MemoWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const text = (conf.settings.text as string) ?? '';
  useEditEvent(conf.id, () => { setDraft(text); setOpen(true); });
  return (
    <div className="panel widget" style={{ cursor: isAdmin ? 'pointer' : undefined }}
      onClick={e => { if ((e.target as HTMLElement).closest('.modal-ov')) return; if (isAdmin && !editOn) { setDraft(text); setOpen(true); } }}>
      <h4>MEMO {isAdmin && <span className="more">관리 ›</span>}</h4>
      <p style={{ fontSize: 12, lineHeight: 1.7, color: '#3a3f47', whiteSpace: 'pre-line' }}>{text || '메모가 비어 있습니다'}</p>

      <Modal open={open} onClose={() => setOpen(false)} title="메모 관리" desc="메인 메모 위젯 내용 — 관리자 전용"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={() => {
            updateWidget(conf.id, { settings: { ...conf.settings, text: draft } }, { persist: true }); setOpen(false);
          }}>SAVE</button>
        </>}>
        <KTextarea value={draft} onChange={e => setDraft(e.target.value)} />
      </Modal>
    </div>
  );
}

/* ---------- DIARY (최근 일기 — 실데이터, 4.14) ---------- */

export function DiaryWidget() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [posts] = useLocalList<DiaryPost>('ohome.diary.v1', DIARY_SEED);
  const [moods] = useLocalList<Mood>('ohome.moods.v1', MOOD_SEED);
  const [menuSet] = useMenuSettings();
  const viewer = { loggedIn: !!user, isAdmin };
  const canSee = canViewHref(menuSet, '/diary', viewer);
  const latest = posts
    .filter(p => canViewHref(menuSet, sectionHref('diary', p.secId ?? MAIN_SEC), viewer))
    .filter(p => p.visibility === 'public' || (p.visibility === 'member' && !!user))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  if (!canSee) return null;
  return (
    <div className="panel widget" style={{ margin: 0 }}>
      <h4>DIARY <span className="more" onClick={() => router.push('/diary')}>더보기 ›</span></h4>
      {latest.map(p => {
        const m = moods.find(x => x.id === p.moodId);
        return (
          <div key={p.id} className="diary-mini" onClick={() => router.push(`/diary#${p.id}`)}>
            <div className="mood" style={{ background: moodTint(m?.color ?? '#888'), color: m?.color }}>{m?.icon ?? '·'}</div>
            <div className="t"><span className="tt">{p.title}</span> <small>{p.date.slice(5).replace('-', '.')}{m ? ` · ${m.name}` : ''}</small></div>
          </div>
        );
      })}
      {latest.length === 0 && <p className="hint">공개된 일기가 없습니다</p>}
    </div>
  );
}

/* ---------- LATEST (최신 그림 — 로드비 + 갤러리 통합 최신 3장, v1.9 사용자 피드백) ---------- */

export function LatestWidget() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [roads] = useLocalList<RoadItem>('ohome.road.v1', ROAD_SEED);
  const [backups] = useLocalList<BackupPost>('ohome.backup.v1', BACKUP_SEED);
  const [menuSet] = useMenuSettings();
  const viewer = { loggedIn: !!user, isAdmin };
  const seeRoad = canViewHref(menuSet, '/loadb', viewer);
  const seeGal = canViewHref(menuSet, '/gallery', viewer);
  const latest = [
    ...(seeRoad ? roads : []).filter(it => canViewHref(menuSet, sectionHref('roadview', it.secId ?? MAIN_SEC), viewer)).map(it => ({
      id: `r-${it.id}`, date: it.date, ref: it.imgId ?? it.imgUrl, ph: it.ph,
      href: '/loadb', tip: `로드비 · No.${String(it.no ?? 0).padStart(3, '0')}`,
    })),
    ...(seeGal ? backups : [])
      .filter(p => canViewHref(menuSet, sectionHref('gallery', p.secId ?? MAIN_SEC), viewer))
      .filter(p => p.visibility === 'public' && !p.fold).map(p => ({
      id: `b-${p.id}`, date: p.date, ref: p.images[0], ph: p.phList[0] ?? 'cool',
      href: `/gallery/${p.id}`, tip: `갤러리 · ${p.title}`,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const phFallback = ['cool', 'warm', 'red'];
  if (!seeRoad && !seeGal) return null;
  return (
    <div className="panel widget" style={{ margin: 0 }}>
      <h4>LATEST <span className="more" onClick={() => router.push('/gallery')}>더보기 ›</span></h4>
      <div className="latest-grid">
        {[0, 1, 2].map(i => {
          const it = latest[i];
          return (
            <div key={it?.id ?? i} style={{ aspectRatio: '1', borderRadius: 9, overflow: 'hidden', position: 'relative', cursor: it ? 'pointer' : undefined }}
              onClick={() => { if (it) router.push(it.href); }} data-tip={it?.tip}>
              <BlobImg fileRef={it?.ref} ph={it?.ph || phFallback[i]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- D-DAY ---------- */
interface DdayItem { title: string; date: string; plusOne?: boolean }
function ddayLabel(date: string, plusOne?: boolean): { label: string; passed: boolean; near: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(date + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (plusOne && diff <= 0) return { label: `D+${-diff + 1}`, passed: true, near: false };
  if (diff === 0) return { label: 'D-DAY', passed: false, near: true };
  return diff > 0
    ? { label: `D-${diff}`, passed: false, near: diff <= 7 }
    : { label: `D+${-diff}`, passed: true, near: false };
}

export function DdayWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn } = useMainStore();
  const { familyOf } = useFonts();
  const [open, setOpen] = useState(false);
  const items = (conf.settings.items as DdayItem[]) ?? [];
  const dFontId = (conf.settings.fontId as string | undefined) ?? 'serif';
  const dColor = conf.settings.color as string | undefined;
  useEditEvent(conf.id, () => setOpen(true));
  return (
    <div className="panel widget" style={{ cursor: isAdmin ? 'pointer' : undefined }}
      onClick={e => { if ((e.target as HTMLElement).closest('.modal-ov')) return; if (isAdmin && !editOn) setOpen(true); }}>
      <h4>D-DAY {isAdmin && <span className="more">관리 ›</span>}</h4>
      {items.map(it => {
        const d = ddayLabel(it.date, it.plusOne);
        return (
          <div className="dday-row" key={it.title}>
            <span>{it.title}</span>
            <b className={d.near && !dColor ? 'd-red' : ''}
              style={{ fontFamily: familyOf(dFontId), color: dColor }}>{d.label}</b>
          </div>
        );
      })}
      {items.length === 0 && <p className="hint">등록된 D-day가 없습니다</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="D-day 관리"
        desc="추가 · 수정 · 삭제 · ⠿ 드래그로 순서 조정 — 환경설정 「위젯」에서도 관리 가능"
        actions={<button className="btn btn-dark" onClick={() => setOpen(false)}>CLOSE</button>}>
        {open && <DdayEditor conf={conf} />}
      </Modal>
    </div>
  );
}

/* ---------- TO-DO ---------- */
export function TodoWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  const [open, setOpen] = useState(false);
  const items = (conf.settings.items as TodoSetItem[]) ?? [];
  useEditEvent(conf.id, () => setOpen(true));

  const setItems = (next: TodoSetItem[]) => {
    updateWidget(conf.id, { settings: { ...conf.settings, items: next } }, { persist: true });
  };

  return (
    <div className="panel widget" style={{ cursor: isAdmin ? 'pointer' : undefined }}
      onClick={e => {
        if (!isAdmin || editOn) return;
        if ((e.target as HTMLElement).closest('.k-check') || (e.target as HTMLElement).closest('.modal-ov')) return;
        setOpen(true);
      }}>
      <h4>TO-DO {isAdmin && <span className="more">관리 ›</span>}</h4>
      {items.map((it, i) => (
        <label className={`todo-row k-check ${it.done ? 'done' : ''}`} key={`${it.text}-${i}`}
          style={!isAdmin ? { pointerEvents: 'none' } : undefined}>
          <input type="checkbox" checked={it.done}
            onChange={ev => setItems(items.map((x, j) => (j === i ? { ...x, done: ev.target.checked } : x)))} />
          <span className="box" /><span>{it.text}</span>
        </label>
      ))}
      {items.length === 0 && <p className="hint">할 일이 없습니다</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="투두 관리"
        desc="추가 · 체크 · 삭제 · ⠿ 드래그로 순서 조정 — 환경설정 「위젯」에서도 관리 가능">
        {open && <TodoEditor conf={conf} />}
        <div className="modal-actions">
          <button className="btn btn-dark" onClick={() => setOpen(false)}>CLOSE</button>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- UPCOMING ---------- */
export function UpcomingWidget() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { st } = useSched();
  const [menuSet] = useMenuSettings();
  const { list } = useSections();
  const viewer = { loggedIn: !!user, isAdmin };
  const seeSec = (secId?: string) => canViewHref(menuSet, sectionHref('sched', secId ?? MAIN_SEC), viewer);
  const canSee = list('sched').some(s => seeSec(s.id));
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const upcoming = st.events
    .filter(e => seeSec(e.secId))
    .filter(e => isAdmin || e.visibility === 'public' || (e.visibility === 'member' && !!user))
    .map(e => {
      let d = e.start;
      if (e.repeat === 'yearly') {
        const thisYear = `${today.getFullYear()}-${e.start.slice(5)}`;
        d = thisYear >= todayStr ? thisYear : `${today.getFullYear() + 1}-${e.start.slice(5)}`;
      }
      return { e, d };
    })
    .filter(x => x.d >= todayStr)
    .sort((a, b) => a.d.localeCompare(b.d))
    .slice(0, 3);
  if (!canSee) return null;
  return (
    <div className="panel widget" style={{ cursor: 'var(--cur-pointer,pointer)' }} onClick={() => router.push('/cal')}>
      <h4>UPCOMING <span className="more">더보기 ›</span></h4>
      {upcoming.map(({ e, d }) => (
        <div key={e.id} className="dday-row">
          <span>{d.slice(5).replace('-', '.')} · {e.title}</span>
          <b style={{ fontSize: 11, color: eventColor(e, st.cats) }}>●</b>
        </div>
      ))}
      {upcoming.length === 0 && <p className="hint">다가오는 일정이 없습니다</p>}
    </div>
  );
}

/* ---------- 자유 텍스트 ---------- */
export function FreeTextWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { updateWidget } = useMainStore();
  const { fonts, familyOf } = useFonts();
  const [open, setOpen] = useState(false);
  const s = conf.settings as { text?: string; fontId?: string; size?: number; color?: string; align?: 'left' | 'center' | 'right'; bold?: boolean };
  const [draft, setDraft] = useState(s);
  useEditEvent(conf.id, () => { setDraft({ ...s }); setOpen(true); });
  return (
    <div>
      <p style={{
        fontFamily: familyOf(s.fontId) ?? 'var(--sans)',
        fontSize: s.size ?? 15, color: s.color ?? 'var(--page-desc)',
        textAlign: s.align ?? 'left', fontWeight: s.bold ? 700 : 400,
        lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0, wordBreak: 'keep-all',
      }}>
        {s.text || (isAdmin ? '자유 텍스트 — 편집모드에서 우클릭 → 설정' : '')}
      </p>
      <Modal open={open} onClose={() => setOpen(false)} title="자유 텍스트"
        desc="패널 없이 문구만 표시 — 폰트·크기·색·정렬 지정, 배치는 편집모드에서 드래그"
        actions={<>
          <button className="btn btn-ghost" onClick={() => setOpen(false)}>CANCEL</button>
          <button className="btn btn-dark" onClick={() => {
            updateWidget(conf.id, { settings: { ...conf.settings, ...draft } }, { persist: true }); setOpen(false);
          }}>SAVE</button>
        </>}>
        <div style={{ display: 'grid', gap: 10 }}>
          <KTextarea value={draft.text ?? ''} onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <KSelect minWidth={170} value={draft.fontId ?? 'default'}
              onChange={v => setDraft(d => ({ ...d, fontId: v }))}
              options={fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: familyOf(f.id) }}>{f.name}</span> }))} />
            <span className="cp-lb">크기</span>
            <KStep value={draft.size ?? 15} min={10} max={64} step={1} suffix="px"
              onChange={v => setDraft(d => ({ ...d, size: v }))} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="cp-lb">글씨색</span>
            <ColorField value={draft.color ?? '#5d636d'} onChange={hex => setDraft(d => ({ ...d, color: hex }))} />
            <div className="mini-seg">
              {(['left', 'center', 'right'] as const).map(a => (
                <button key={a} className={(draft.align ?? 'left') === a ? 'on' : ''}
                  onClick={() => setDraft(d => ({ ...d, align: a }))}>
                  {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
                </button>
              ))}
            </div>
            <KCheck label="굵게" checked={!!draft.bold} onChange={v => setDraft(d => ({ ...d, bold: v }))} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ---------- 장식 이미지 ---------- */
function ContainImg({ fileRef, rounded }: { fileRef: string; rounded: boolean }) {
  const url = useBlobUrl(fileRef);
  if (!url) return null;
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="" draggable={false}
        style={{
          maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', display: 'block',
          borderRadius: rounded ? 'var(--radius)' : 0,
        }} />
    </div>
  );
}

export function DecoWidget({ conf }: { conf: WidgetConf }) {
  const { isAdmin } = useAuth();
  const { editOn } = useMainStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rounded = (conf.settings.rounded as boolean) ?? true;
  const fit = (conf.settings.fit as 'cover' | 'contain') ?? 'cover';
  const slides = decoSlides(conf.settings);
  const sec = (conf.settings.interval as number) ?? 5;
  const [idx, setIdx] = useState(0);
  const cur = slides[Math.min(idx, slides.length - 1)];

  useEffect(() => {
    if (slides.length < 2 || editOn || open) return;
    const t = setInterval(() => setIdx(i => (i + 1) % slides.length), Math.max(1, sec) * 1000);
    return () => clearInterval(t);
  }, [slides.length, sec, editOn, open]);

  useEffect(() => { if (idx >= slides.length) setIdx(0); }, [slides.length, idx]);
  useEditEvent(conf.id, () => setOpen(true));

  const onBody = () => {
    if (editOn) return;
    if (cur?.link) {
      const l = normalizeInternalLink(cur.link);
      if (/^https?:\/\//.test(l)) window.open(l, '_blank');
      else router.push(l);
    }
  };

  return (
    <div className="deco-wgt"
      style={{
        position: 'relative', width: '100%', height: '100%', minHeight: 80, overflow: 'hidden',
        aspectRatio: conf.h == null ? '1/1' : undefined,
        borderRadius: rounded ? 'var(--radius)' : 0,
        cursor: !editOn && cur?.link ? 'var(--cur-pointer,pointer)' : undefined,
      }}
      onClick={onBody}>
      {cur
        ? (fit === 'contain'
          ? <ContainImg key={cur.id} fileRef={cur.imgId} rounded={rounded} />
          : <CroppedBlobImg key={cur.id} fileRef={cur.imgId} crop={cur.crop} ph="" />)
        : (
          <div className="ph" style={{ position: 'absolute', inset: 0 }}>
            <span style={{ fontSize: 10 }}>{isAdmin ? 'DECO — 편집모드에서 우클릭 → 설정' : 'DECO'}</span>
          </div>
        )}
      {slides.length > 1 && !editOn && (
        <div className="deco-dots" onClick={e => e.stopPropagation()}>
          {slides.map((sl, i) => (
            <i key={sl.id} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} />
          ))}
        </div>
      )}
      <div onClick={e => e.stopPropagation()}>
        <Modal open={open} onClose={() => setOpen(false)} small title="장식 이미지"
          desc="여러 장을 넣으면 순서대로 넘어갑니다 — 위치 크롭은 현재 위젯 비율 기준, 원본은 잘리지 않음">
          {open && <DecoEditor conf={conf} onClose={() => setOpen(false)} />}
        </Modal>
      </div>
    </div>
  );
}

/* ---------- 스티커 메모 미니보드 ---------- */
export function MemoBoardWidget() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [memos] = useLocalList<StickyMemo>('ohome.memo.v1', MEMO_SEED);
  const [settings] = useMemoSettings();
  const [menuSet] = useMenuSettings();
  if (!canViewHref(menuSet, '/memo', { loggedIn: !!user, isAdmin })) return null;
  return (
    <div className="panel widget" style={{ display: 'flex', flexDirection: 'column' }}>
      <h4>STICKY</h4>
      <div className="memo-mini" onClick={() => router.push('/memo')}>
        {memos.map(m => (
          <div key={m.id} className="postit"
            style={{
              left: `${m.x}%`, top: `${m.y}%`, zIndex: m.z,
              transform: `rotate(${m.rot}deg)`, background: m.color,
              width: Math.round(MEMO_SIZE_W[m.size] * 0.53),
            }}>
            {settings.showAuthor && <b>{m.author}</b>}
            {m.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- 커미션 신청자 ---------- */
export function ApplyWidget({ conf }: { conf: WidgetConf }) {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const { editOn, updateWidget } = useMainStore();
  const [menuSet] = useMenuSettings();
  const [settings] = useCommSettings();
  const [apps] = useLocalList<Applicant>('ohome.commapply.v1', APPLY_SEED);
  const [open, setOpen] = useState(false);
  useEditEvent(conf.id, () => setOpen(true));

  const max = Math.max(1, Math.min(20, (conf.settings.count as number) ?? 5));
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const shown = apps
    .filter(a => !inTrash(a) && !!a.deadline && a.deadline >= todayStr)
    .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))
    .slice(0, max);

  const dleft = (d: string) => {
    const ms = Date.parse(`${d}T00:00:00`) - Date.parse(`${todayStr}T00:00:00`);
    const n = Math.round(ms / 86400000);
    return n === 0 ? 'D-DAY' : `D-${n}`;
  };

  if (!canViewHref(menuSet, '/comm-apply', { loggedIn: !!user, isAdmin })) return null;

  return (
    <div className="panel widget" style={{ cursor: 'var(--cur-pointer,pointer)' }}
      onClick={e => {
        if ((e.target as HTMLElement).closest('.modal-ov')) return;
        if (editOn) return;
        router.push('/comm-apply');
      }}>
      <h4>COMMISSION <span className="more" onClick={e => { e.stopPropagation(); router.push('/comm-apply'); }}>전체 ›</span></h4>
      {shown.map(a => {
        const badge = settings.applyBadges.find(b => b.id === a.badgeId);
        return (
          <div className="apply-row" key={a.id}>
            <b>{dleft(a.deadline!)}</b>
            <span>{isAdmin ? a.name : maskName(a.name, a.nameOpen ?? 1)}</span>
            {badge && <i style={badgeStyle(badge, settings.badgeShape)}>{badge.label}</i>}
          </div>
        );
      })}
      {shown.length === 0 && <p className="hint">다가오는 마감이 없습니다</p>}

      <Modal open={open} onClose={() => setOpen(false)} small title="커미션 신청자 위젯"
        desc="마감이 가까운 순으로 보여 줍니다 — 마감일이 없거나 지난 신청은 빼고 셉니다"
        actions={<button className="btn btn-dark" onClick={() => setOpen(false)}>확인</button>}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="cp-lb">몇 명까지</span>
          <KStep value={(conf.settings.count as number) ?? 5} min={1} max={20} suffix="명"
            onChange={v => updateWidget(conf.id, { settings: { ...conf.settings, count: v } }, { persist: true })} />
        </div>
      </Modal>
    </div>
  );
}

/* ---------- 타입 → 렌더러 ---------- */
export function renderWidget(conf: WidgetConf) {
  switch (conf.type) {
    case 'banner': return <BannerWidget conf={conf} />;
    case 'menu': return <MenuListWidget />;
    case 'memo': return <MemoWidget conf={conf} />;
    case 'diary': return <DiaryWidget />;
    case 'latest': return <LatestWidget />;
    case 'dday': return <DdayWidget conf={conf} />;
    case 'todo': return <TodoWidget conf={conf} />;
    case 'upcoming': return <UpcomingWidget />;
    case 'freetext': return <FreeTextWidget conf={conf} />;
    case 'deco': return <DecoWidget conf={conf} />;
    case 'memoboard': return <MemoBoardWidget />;
    case 'apply': return <ApplyWidget conf={conf} />;
    default: return <div className="panel widget"><h4>{WIDGET_META[conf.type]?.title ?? conf.type}</h4></div>;
  }
}
