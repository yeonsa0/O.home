'use client';
// 위젯별 설정 에디터 모음 (4.0) — 배너 / D-day / 투두 / 장식 이미지 등
import React, { useState } from 'react';
import { WidgetConf, useMainStore, decoSlides, DecoSlide } from '@/lib/mainStore';
import { KInput, KTextarea, KSelect, KStep, KCheck } from '@/components/ui/Kit';
import { CroppedBlobImg, CropValue } from '@/components/ui/CropEditor';
import { BlobImagePicker } from '@/components/ui/BlobImagePicker';
import { ColorField } from '@/components/ui/ColorField';
import { useFonts } from '@/lib/fontStore';

/* ---------- 배너 관리 에디터 ---------- */
export interface BannerSlide {
  id: string;
  imgId?: string;       // Blob 이미지 ID (우선)
  img?: string;         // 레거시 외부 URL
  crop?: CropValue;     // 크롭 영역
  cap: string;
  sub: string;
  link?: string;
  cls?: string;
}

export const DEMO_SLIDES: BannerSlide[] = [
  { id: 'b1', cap: 'O.HOME V4.0', sub: '새로운 미니홈피 템플릿에 오신 것을 환영합니다', cls: 'c-blue' },
  { id: 'b2', cap: '다양한 위젯 배치', sub: '관리자 모드에서 자유롭게 꾸며보세요', cls: 'c-purple' },
  { id: 'b3', cap: '실시간 연동', sub: '갤러리·일기·스케줄러와 완벽 호환', cls: 'c-dark' },
];

export function BannerEditor({ conf, onSaved, onClose }: { conf: WidgetConf; onSaved: () => void; onClose: () => void }) {
  const { updateWidget } = useMainStore();
  const raw = (conf.settings.slides as BannerSlide[]) ?? [];
  const [slides, setSlides] = useState<BannerSlide[]>(raw.length > 0 ? raw : DEMO_SLIDES);
  const [interval, setIntervalVal] = useState<number>((conf.settings.interval as number) ?? 4);
  const [cropFor, setCropFor] = useState<string | null>(null);

  const save = () => {
    updateWidget(conf.id, { settings: { ...conf.settings, slides, interval } }, { persist: true });
    onSaved();
  };

  const cropTarget = slides.find(s => s.id === cropFor);

  if (cropFor && cropTarget) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <p className="hint">배너 크기에 맞게 표시 영역을 지정합니다 (원본은 잘리지 않습니다)</p>
        <div style={{ height: 280, position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
          <CroppedBlobImg fileRef={cropTarget.imgId!} crop={cropTarget.crop} />
        </div>
        <CropEditor initial={cropTarget.crop} onSave={c => {
          setSlides(slides.map(s => s.id === cropFor ? { ...s, crop: c } : s));
          setCropFor(null);
        }} onCancel={() => setCropFor(null)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="cp-lb">전환 간격</span>
        <KStep value={interval} min={2} max={15} step={1} suffix="초" onChange={setIntervalVal} />
      </div>
      <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
        {slides.map((sl, i) => (
          <div key={sl.id} style={{ display: 'grid', gap: 8, padding: 10, background: 'var(--panel-sub)', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>#{i + 1}</span>
              <BlobImagePicker value={sl.imgId} onChange={id => setSlides(slides.map(s => s.id === sl.id ? { ...s, imgId: id } : s))} />
              <div style={{ display: 'grid', gap: 6, flex: 1 }}>
                <KInput placeholder="메인 문구 (CAPTION)" value={sl.cap} onChange={e => setSlides(slides.map(s => s.id === sl.id ? { ...s, cap: e.target.value } : s))} />
                <KInput placeholder="서브 문구" value={sl.sub} onChange={e => setSlides(slides.map(s => s.id === sl.id ? { ...s, sub: e.target.value } : s))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <KInput placeholder="링크 (선택 — 클릭 시 이동)" value={sl.link ?? ''} onChange={e => setSlides(slides.map(s => s.id === sl.id ? { ...s, link: e.target.value || undefined } : s))} />
              {sl.imgId && (
                <button className="btn btn-ghost" style={{ height: 26, padding: '0 10px', fontSize: 11 }} onClick={() => setCropFor(sl.id)}>✂ 위치 크롭</button>
              )}
              <button className="btn btn-ghost" style={{ height: 26, padding: '0 8px', fontSize: 11, color: 'var(--red)' }}
                onClick={() => setSlides(slides.filter(s => s.id !== sl.id))}>삭제</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={() => setSlides([...slides, { id: `s-${Date.now()}`, cap: 'NEW SLIDE', sub: '설명을 입력하세요' }])}>+ 슬라이드 추가</button>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost" onClick={onClose}>취소</button>
          <button className="btn btn-dark" onClick={save}>저장</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- D-day 관리 에디터 ---------- */
export function DdayEditor({ conf }: { conf: WidgetConf }) {
  const { updateWidget } = useMainStore();
  const { fonts, familyOf } = useFonts();
  const items = (conf.settings.items as Array<{ title: string; date: string; plusOne?: boolean }>) ?? [];
  const fontId = (conf.settings.fontId as string) ?? 'serif';
  const color = (conf.settings.color as string) ?? '';

  const save = (nextItems: typeof items, nextFont = fontId, nextCol = color) => {
    updateWidget(conf.id, { settings: { ...conf.settings, items: nextItems, fontId: nextFont, color: nextCol } }, { persist: true });
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className="cp-lb">디데이 폰트</span>
        <KSelect minWidth={170} value={fontId} onChange={v => save(items, v, color)}
          options={fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: familyOf(f.id) }}>{f.name}</span> }))} />
        <span className="cp-lb">글씨색</span>
        <ColorField value={color} onChange={hex => save(items, fontId, hex)} />
      </div>
      <div style={{ display: 'grid', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <KInput placeholder="제목 (예: 우리 만난 지)" value={it.title}
              onChange={e => { const n = [...items]; n[i] = { ...n[i], title: e.target.value }; save(n); }} />
            <input type="date" value={it.date} className="k-input" style={{ width: 140 }}
              onChange={e => { const n = [...items]; n[i] = { ...n[i], date: e.target.value }; save(n); }} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, whiteSpace: 'nowrap', cursor: 'pointer' }}>
              <input type="checkbox" checked={!!it.plusOne}
                onChange={e => { const n = [...items]; n[i] = { ...n[i], plusOne: e.target.checked }; save(n); }} />
              <span>+1일 세기</span>
            </label>
            <button className="btn btn-ghost" style={{ padding: '0 8px', color: 'var(--red)' }}
              onClick={() => save(items.filter((_, idx) => idx !== i))}>삭제</button>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost" onClick={() => save([...items, { title: '새 기념일', date: new Date().toISOString().slice(0, 10) }])}>
        + D-day 추가
      </button>
    </div>
  );
}

/* ---------- Todo 관리 에디터 ---------- */
export interface TodoSetItem { text: string; done: boolean }

export function TodoEditor({ conf }: { conf: WidgetConf }) {
  const { updateWidget } = useMainStore();
  const items = (conf.settings.items as TodoSetItem[]) ?? [];

  const save = (next: TodoSetItem[]) => {
    updateWidget(conf.id, { settings: { ...conf.settings, items: next } }, { persist: true });
  };

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={it.done}
              onChange={e => { const n = [...items]; n[i] = { ...n[i], done: e.target.checked }; save(n); }} />
            <KInput value={it.text} onChange={e => { const n = [...items]; n[i] = { ...n[i], text: e.target.value }; save(n); }} />
            <button className="btn btn-ghost" style={{ padding: '0 8px', color: 'var(--red)' }}
              onClick={() => save(items.filter((_, idx) => idx !== i))}>삭제</button>
          </div>
        ))}
      </div>
      <button className="btn btn-ghost" onClick={() => save([...items, { text: '새로운 할 일', done: false }])}>+ 할 일 추가</button>
    </div>
  );
}

/* ---------- 장식 이미지(Deco) 관리 에디터 (v2.0 다중 슬라이드 + 크롭) ---------- */
export function DecoEditor({ conf, onClose }: { conf: WidgetConf; onClose: () => void }) {
  const { updateWidget } = useMainStore();
  const rounded = (conf.settings.rounded as boolean) ?? true;
  const fit = (conf.settings.fit as 'cover' | 'contain') ?? 'cover';
  const sec = (conf.settings.interval as number) ?? 5;
  const slides = decoSlides(conf.settings);

  const [list, setList] = useState<DecoSlide[]>(slides);
  const [isRounded, setIsRounded] = useState(rounded);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>(fit);
  const [interval, setIntervalVal] = useState<number>(sec);
  const [cropId, setCropId] = useState<string | null>(null);

  const saveAll = (nextList = list, nextRounded = isRounded, nextFit = fitMode, nextSec = interval) => {
    updateWidget(conf.id, {
      settings: { ...conf.settings, slides: nextList, rounded: nextRounded, fit: nextFit, interval: nextSec },
    }, { persist: true });
  };

  const cropTarget = list.find(s => s.id === cropId);

  if (cropId && cropTarget) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <p className="hint">위젯 비율에 맞춰 크롭 영역을 지정합니다 (원본은 잘리지 않습니다)</p>
        <div style={{ height: 280, position: 'relative', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
          <CroppedBlobImg fileRef={cropTarget.imgId} crop={cropTarget.crop} />
        </div>
        <CropEditor initial={cropTarget.crop} onSave={c => {
          const n = list.map(s => s.id === cropId ? { ...s, crop: c } : s);
          setList(n);
          saveAll(n);
          setCropId(null);
        }} onCancel={() => setCropId(null)} />
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <KCheck label="이미지 둥근 모서리" checked={isRounded} onChange={v => { setIsRounded(v); saveAll(list, v); }} />
        <div className="mini-seg">
          <button className={fitMode === 'cover' ? 'on' : ''} onClick={() => { setFitMode('cover'); saveAll(list, isRounded, 'cover'); }}>꽉 채우기(크롭)</button>
          <button className={fitMode === 'contain' ? 'on' : ''} onClick={() => { setFitMode('contain'); saveAll(list, isRounded, 'contain'); }}>비율 유지(안 잘림)</button>
        </div>
      </div>
      {list.length > 1 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="cp-lb">전환 간격</span>
          <KStep value={interval} min={1} max={15} step={1} suffix="초" onChange={v => { setIntervalVal(v); saveAll(list, isRounded, fitMode, v); }} />
        </div>
      )}
      <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
        {list.map((sl, i) => (
          <div key={sl.id} style={{ display: 'grid', gap: 8, padding: 10, background: 'var(--panel-sub)', borderRadius: 8, border: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>#{i + 1}</span>
              <BlobImagePicker value={sl.imgId} onChange={id => {
                const n = list.map(s => s.id === sl.id ? { ...s, imgId: id } : s);
                setList(n); saveAll(n);
              }} />
              <div style={{ display: 'flex', gap: 6, flex: 1, flexDirection: 'column' }}>
                <KInput placeholder="링크 (선택 — 클릭 시 이동)" value={sl.link ?? ''}
                  onChange={e => {
                    const n = list.map(s => s.id === sl.id ? { ...s, link: e.target.value || undefined } : s);
                    setList(n); saveAll(n);
                  }} />
                {/* 👇 여기에 마우스 오버 문구(툴팁) 입력 칸 추가 완료! */}
                <KInput placeholder="마우스 오버 문구 (선택 — 툴팁)" value={sl.tooltip ?? ''}
                  onChange={e => {
                    const n = list.map(s => s.id === sl.id ? { ...s, tooltip: e.target.value || undefined } : s);
                    setList(n); saveAll(n);
                  }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
              {fitMode === 'cover' && sl.imgId && (
                <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 10 }} onClick={() => setCropId(sl.id)}>✂ 위치</button>
              )}
              {list.length > 1 && (
                <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 10 }}
                  onClick={() => {
                    if (i > 0) {
                      const n = [...list]; const t = n[i]; n[i] = n[i - 1]; n[i - 1] = t;
                      setList(n); saveAll(n);
                    }
                  }}>▲ 위로</button>
              )}
              <button className="btn btn-ghost" style={{ height: 24, padding: '0 8px', fontSize: 10, color: 'var(--red)' }}
                onClick={() => { const n = list.filter(s => s.id !== sl.id); setList(n); saveAll(n); }}>삭제</button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-ghost" onClick={() => {
          const n = [...list, { id: `d-${Date.now()}`, imgId: '' }];
          setList(n); saveAll(n);
        }}>+ 이미지 추가</button>
        <button className="btn btn-dark" onClick={onClose}>확인</button>
      </div>
    </div>
  );
}

// 간단 크롭 조절용 내부 컴포넌트
function CropEditor({ initial, onSave, onCancel }: { initial?: CropValue; onSave: (c: CropValue) => void; onCancel: () => void }) {
  const [crop, setCrop] = useState<CropValue>(initial ?? { x: 0, y: 0, zoom: 1 });
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="cp-lb" style={{ fontSize: 11 }}>확대(ZOOM)</span>
        <input type="range" min="1" max="3" step="0.05" value={crop.zoom}
          onChange={e => setCrop({ ...crop, zoom: parseFloat(e.target.value) })} style={{ flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" style={{ height: 26, fontSize: 11 }} onClick={onCancel}>취소</button>
        <button className="btn btn-dark" style={{ height: 26, fontSize: 11 }} onClick={() => onSave(crop)}>적용</button>
      </div>
    </div>
  );
}
