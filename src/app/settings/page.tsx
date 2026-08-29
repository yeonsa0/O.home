'use client';
// 환경설정 (기획서 5장) — 0차: 「디자인」 탭(테마) 실동작.
// 나머지 카테고리는 해당 기능 마일스톤에서 함께 구현.
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, inviteCode, setInviteCode } from '@/lib/auth';
import { useMembers } from '@/lib/members';
import { useTheme } from '@/lib/ThemeProvider';
import { ThemeVars } from '@/lib/theme';
import { ColorField } from '@/components/ui/ColorField';
import { KStep, KToggle, KInput, LiveInput, KTextarea, KSelect, KCheck, Pager } from '@/components/ui/Kit';
import { DragList } from '@/components/ui/DragList';
import { useMainStore, WidgetConf, WIDGET_META, MULTI_TYPES, widgetLabel } from '@/lib/mainStore';
import { useConfirmDelete, ConfirmModal, Modal } from '@/components/ui/Modal';
import { exportBackup, importBackup, resetGroups, RESET_CONTENT, RESET_EXTRA } from '@/lib/backup';
import { DiaryPost, DIARY_SEED } from '@/lib/diaryStore';
import { newId } from '@/lib/postStore';
import { useCommSettings, badgeStyle, CommBadge, CommSettings } from '@/lib/commStore';
import {
  useBoardSettings, boardBadgeStyle, BoardBadge, galleryCatsOf,
  useBoards, Board, BoardSkin, BoardPerm, DEFAULT_BOARD_CATS, MAIN_BOARD_ID, PAINT_BOARD_ID, boardHref,
} from '@/lib/boardStore';
import { useThreadSettings, ThreadWork, THREAD_SEED, ThreadCat, threadBadgeStyle, threadCats, threadCatsPatch } from '@/lib/threadStore';
import { useTrpgSettings, DOTORI_STATUS_KEYS, DotoriStatus, dotoriBadgeStyle } from '@/lib/galleryStore';
import { useMemoSettings } from '@/lib/memoStore';
import {
  useMenuSettings, MenuSettings, MenuPerm, MenuVis, PLAYLOG_COLS,
  MenuGroupNode, MenuLeaf, defaultTree, newGroupId, menuLabelFor, extraBoardHref, boardEntries,
  IMG_PROTECT_AREAS,
} from '@/lib/menuStore';
import { FEATURES } from '@/lib/menu';
import { SectionsBlock } from '@/components/settings/SectionList';
import { useSections, sectionMenuEntries, MAIN_SEC, inSection } from '@/lib/sectionStore';
import { useCustomLinks, linkEntries, toInternalPath } from '@/lib/linkStore';
import { useSiteDraft } from '@/lib/siteStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCursorSettings, CursorState, CURSOR_STATE_LABEL } from '@/lib/cursorStore';
import { RelQuestionSet, RELQ_SEED, RELQ_KEY, CP_LABEL } from '@/lib/relqStore';
import { SymbolInput } from '@/components/ui/SymbolInput';
import { allBlobs, putBlobAs, useBlobUrl, getBlob } from '@/lib/blobStore';
import { parseAni } from '@/lib/aniCursor';
import { fileDrop } from '@/lib/dnd';
import { Character, CHAR_SEED, Relation, REL_SEED } from '@/lib/charStore';
import { useLocalList } from '@/lib/postStore';
import { Mood, MOOD_SEED, moodTint } from '@/lib/diaryStore';
import {
  TextSettingEditor, DdayEditor, TodoEditor, BannerEditor, DecoEditor,
} from '@/components/main/widgetEditors';
import { useBgm, BgmTrack, parseVideoId } from '@/lib/bgmStore';
import { useFonts, fontCssUrl, FontDef, FontRole, ROLE_LABEL, FOLLOW_MENU, FOLLOW_TITLE } from '@/lib/fontStore';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc, getPageText, setPageText } from '@/components/ui/PageText';
import { putBlob } from '@/lib/blobStore';
import { getSetting, setSetting, pushLocalSettings, unsyncedSettingKeys, SETTING_KEYS } from '@/lib/settingStore';
import { isServerMode, createBackend, backend } from '@/lib/backend';
import type { BackendConfig, BackendKind } from '@/lib/backend/types';
import { CONTENT_COLLECTIONS } from '@/lib/backend/types';
import { visFloorOf } from '@/lib/visFloor';
import { validateConfig, configFileText, saveLocalConfig, parseFirebaseSnippet, serverConfig } from '@/lib/serverConfig';
import { migrateTo, findOrphanFiles } from '@/lib/transfer';
import { FIRESTORE_RULES, STORAGE_RULES } from '@/lib/firebaseRules';

const CATEGORIES = [
  '디자인', '메인 페이지', '위젯', '메뉴 관리', '게시판 관리', '자관 질문', '커미션', 'TRPG', '감상타래', '메모장',
  '폰트', '마우스 커서', 'BGM', '무드 리스트', '회원/보안', '데이터 백업',
] as const;

/** 색 항목 한 쌍 렌더 헬퍼 */
function CP({ label, k, def }: { label?: string; k: keyof ThemeVars; def?: string }) {
  const { state, setVar } = useTheme();
  // def: 값이 없을 때 실제로 적용되는 기본색 (예: 입력 포커스 = 포인트색)
  return (
    <>
      {label && <span className="cp-lb">{label}</span>}
      <ColorField value={String(state.vars[k] ?? def ?? '#888888')} onChange={hex => setVar(k, hex as never)} />
    </>
  );
}

/**
 * 위젯 스타일 (v2.0 사용자 요청) — 메인·사이드에 얹히는 카드의 배경·타이틀색·본문색·테두리.
 *
 * 색을 안 정하면 `--wg-*`가 카드 색을 그대로 가리키므로 지금까지와 똑같이 보인다. 그래서 값이
 * 비어 있을 때 입력란에는 **지금 실제로 쓰이는 카드 색**을 채워 둔다 — 처음 열었을 때 엉뚱한
 * 회색이 아니라 화면에 보이는 그 색이 나와야 조금만 바꿔 쓰기 쉽다.
 * 테두리는 켤 때만 그린다(끄면 지금처럼 그림자만).
 */
function WidgetStyleRow() {
  const { state, setVar } = useTheme();
  const v = state.vars;
  return (
    <div className="set-row" style={{ flexWrap: 'wrap' }}>
      <div className="l"><b>위젯</b>
        <small>메인·사이드에 얹히는 카드 — 비워 두면 카드 색을 그대로 따라갑니다</small></div>
      <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
        <div className="cp-grid2">
          <CP label="배경" k="wgBg" def={v.cardBg ?? '#fbfbfc'} />
          <CP label="타이틀" k="wgTitle" def={v.pageDesc ?? '#8a8f98'} />
          <CP label="본문" k="wgFg" def={v.cardFg ?? '#1d2025'} />
        </div>
        <div className="cf-row" style={{ justifyContent: 'flex-end' }}>
          <KCheck label="테두리" checked={!!v.wgBorder} onChange={b => setVar('wgBorder', b)} />
          {v.wgBorder && <CP label="색" k="wgBd" def="#e6e8ec" />}
        </div>
      </div>
    </div>
  );
}

/** 역할 폰트 한 줄 — 폰트 + 굵기 + 크기 배율 (5.1, 폰트별 체감 크기 보정) */
function FontRoleRow({ role }: { role: FontRole }) {
  const { fonts, roles, setRole, familyOf } = useFonts();
  const cfg = roles[role];
  const wBtn = (w: number | undefined, label: string) => (
    <button className={cfg.weight === w ? 'on' : ''} onClick={() => setRole(role, { weight: w })}>{label}</button>
  );
  return (
    <div className="set-row" style={{ flexWrap: 'wrap' }}>
      <div className="l"><b>{ROLE_LABEL[role].label}</b>{ROLE_LABEL[role].desc && <small>{ROLE_LABEL[role].desc}</small>}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {/* 폰트 이름이 길어도 줄이 넘어가지 않게 상한을 둔다 — 넘치면 … (v2.0 사용자 요청) */}
        <KSelect minWidth={170} value={cfg.id} onChange={v => setRole(role, { id: v })}
          options={[
            ...(role === 'dropdown' ? [{ value: FOLLOW_MENU, label: <span>메뉴 폰트와 동일</span> }] : []),
            ...(role === 'pagetitle' ? [{ value: FOLLOW_TITLE, label: <span>타이틀 폰트와 동일</span> }] : []),
            ...fonts.map(f => ({ value: f.id, label: <span style={{ fontFamily: familyOf(f.id) }}>{f.name}</span> })),
          ]} />
        <div className="mini-seg">
          {wBtn(undefined, '기본')}
          {wBtn(300, '가늘게')}
          {wBtn(400, '보통')}
          {wBtn(700, '굵게')}
        </div>
        <KStep value={cfg.scale ?? 100} min={80} max={130} step={5} suffix="%"
          onChange={v => setRole(role, { scale: v })} />
      </div>
    </div>
  );
}

/** 브라우저 탭 제목 (v1.9 사용자 요청) — 비우면 「로고 텍스트 — 개인홈」. DocTitle.tsx가 실제로 적용 */
function DocTitleControl() {
  const { site, set } = useSiteDraft();
  return (
    <LiveInput value={site.docTitle ?? ''} onValue={v => set({ docTitle: v || undefined })}
      placeholder={`${site.title} — 개인홈`} style={{ width: 220 }} />
  );
}

/** 브라우저 탭 아이콘 (v2.0 사용자 요청) — DocIcon.tsx가 site.favicon(putBlob 참조)을 실제로 적용 */
function FaviconControl() {
  const { site, set } = useSiteDraft();
  const url = useBlobUrl(site.favicon);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--line)', objectFit: 'cover' }} />
      )}
      <input id="siteFaviconFile" type="file" accept="image/png,image/x-icon,image/svg+xml" style={{ display: 'none' }}
        onChange={async e => {
          const f = e.target.files?.[0];
          if (f) set({ favicon: await putBlob(f) });
          e.target.value = '';
        }} />
      <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
        onClick={() => document.getElementById('siteFaviconFile')?.click()}>
        {site.favicon ? 'CHANGE' : 'UPLOAD'}
      </button>
      {site.favicon && (
        <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
          onClick={() => set({ favicon: undefined })}>REMOVE</button>
      )}
    </div>
  );
}

/** 크롤링 설명 문구 (v2.0 사용자 요청) — 비우면 서브타이틀, 그것도 비었으면 기본 문구 (generateMetadata) */
function CrawlDescControl() {
  const { site, set } = useSiteDraft();
  return (
    <LiveInput value={site.crawlDesc ?? ''} onValue={v => set({ crawlDesc: v || undefined })}
      placeholder={site.subtitle || '기본 문구 사용'} style={{ width: 260 }} />
  );
}

/** 로고 텍스트 · 서브타이틀 · 서브타이틀 정렬 (5.2) — TopBar.tsx가 실제로 적용 */
function LogoControls() {
  const { site, set } = useSiteDraft();
  return (
    <>
      <LiveInput value={site.title} onValue={v => set({ title: v })} placeholder="로고 텍스트" style={{ width: 140 }} />
      <LiveInput value={site.subtitle} onValue={v => set({ subtitle: v })} placeholder="서브타이틀" style={{ width: 160 }} />
      <div className="mini-seg">
        {(['left', 'center', 'right'] as const).map(a => (
          <button key={a} className={site.align === a ? 'on' : ''} onClick={() => set({ align: a })}>
            {a === 'left' ? '왼쪽' : a === 'center' ? '가운데' : '오른쪽'}
          </button>
        ))}
      </div>
    </>
  );
}

function DesignPane() {
  const {
    state, dirty: themeDirty, setMode, setPointAccent, setPointTone, setVar,
    resetMode, save, discard, presets, savePreset, applyPreset, removePreset,
  } = useTheme();
  // 디자인 탭의 색상 외 요소(로고·역할 폰트)도 SAVE 드래프트로 통합 (v1.9 사용자 확정)
  const siteDraft = useSiteDraft();
  const { rolesDirty, saveRoles, discardRoles } = useFonts();
  const dirty = themeDirty || siteDraft.dirty || rolesDirty;
  // 저장 안 한 채 새로고침·창 닫기를 하면 조용히 사라진다 —
  // 미리보기가 화면(탭 제목·로고·색)에 바로 적용돼서 저장된 줄 알기 쉬우므로 한 번 물어본다
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const toast = useToast();
  const del = useConfirmDelete();
  const [resetOpen, setResetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetSel, setPresetSel] = useState('');
  const modeBtn = (m: typeof state.mode, label: string) => (
    <button className={state.mode === m ? 'on' : ''} onClick={() => setMode(m)}>{label}</button>
  );
  return (
    <div className="set-sec">
      <h3>테마</h3>
      <div className="d">변경은 미리보기로만 반영 — [SAVE]를 눌러야 저장 · 모드마다 수정값을 따로 기억합니다</div>

      <div className="set-row">
        <div className="l"><b>모드</b><small>전환해도 각 모드의 수정값은 유지 — 초기화는 [선택 리셋]에서 모드별로</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="seg in-panel">
            {modeBtn('light', '라이트')}
            {modeBtn('dark', '다크')}
            {modeBtn('point', '포인트 자동')}
            {modeBtn('custom', '커스텀')}
          </div>
          <button className="btn btn-ghost" style={{ padding: '7px 12px', fontSize: 11 }}
            onClick={() => setResetOpen(true)}>선택 리셋</button>
        </div>
      </div>

      {/* 저장/취소 — 이리저리 실험 후 저장하지 않을 수 있음 (v1.9) */}
      <div className="set-row">
        <div className="l"><b>저장</b><small>화면에는 바로 보이지만 <b>SAVE를 눌러야 실제로 저장</b>됩니다 — 색·폰트·로고·탭 제목 모두</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {dirty && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>저장 안 된 변경</span>}
          {/* 컨트롤 세로 크기 통일 — 35px (btn-dark 기본과 동일) */}
          <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11, opacity: dirty ? 1 : 0.45 }}
            disabled={!dirty} onClick={() => { discard(); siteDraft.discard(); discardRoles(); toast('저장된 테마로 되돌렸습니다'); }}>변경 취소</button>
          <button className="btn btn-dark" style={{ padding: '0 18px', fontSize: 11, opacity: dirty ? 1 : 0.45 }}
            disabled={!dirty} onClick={() => { save(); siteDraft.save(); saveRoles(); toast('테마가 저장되었습니다'); }}>SAVE</button>
        </div>
      </div>

      {/* 테마 프리셋 — 이름으로 저장해 두고 드롭다운에서 커스텀으로 적용 (v1.9) */}
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>테마 저장해두기</b><small>현재 색 구성을 이름으로 보관 — 적용하면 커스텀 모드에 불러옵니다</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* 저장된 테마 컨트롤은 왼쪽에 등장 — 테마 이름/KEEP 위치는 고정 (사용자 확정) */}
          {presets.length > 0 && (
            <>
              <KSelect minWidth={140} value={presetSel} onChange={setPresetSel}
                options={[{ value: '', label: '저장한 테마' }, ...presets.map(p => ({ value: p.id, label: p.name }))]} />
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                onClick={() => { if (presetSel) { applyPreset(presetSel); toast('커스텀 모드에 적용했습니다 — 저장하려면 SAVE'); } }}>APPLY</button>
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11, marginRight: 10 }}
                onClick={() => {
                  const p = presets.find(x => x.id === presetSel);
                  if (p) del.ask(`테마 「${p.name}」를 삭제하시겠습니까?`, () => { removePreset(p.id); setPresetSel(''); });
                }}>DELETE</button>
            </>
          )}
          {/* 인풋·버튼 세로 크기 통일 (35px) */}
          <KInput placeholder="테마 이름" value={presetName} onChange={e => setPresetName(e.target.value)}
            style={{ width: 120, height: 35, boxSizing: 'border-box' }} />
          <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
            onClick={() => {
              if (!presetName.trim()) { toast('테마 이름을 입력해 주세요'); return; }
              savePreset(presetName.trim());
              setPresetName('');
              toast('테마가 보관함에 저장되었습니다');
            }}>KEEP</button>
        </div>
      </div>

      {/* 선택 리셋 — 모드를 골라 그 모드의 수정값만 초기화 */}
      <ConfirmModal open={resetOpen} wide title="어떤 테마를 초기화할까요?"
        body="선택한 모드의 수정값만 초기 상태로 돌아갑니다. 확정은 [SAVE]를 눌러야 저장됩니다."
        onClose={() => setResetOpen(false)}
        buttons={[
          { label: '라이트', kind: 'ghost', onClick: () => { resetMode('light'); setResetOpen(false); } },
          { label: '다크', kind: 'ghost', onClick: () => { resetMode('dark'); setResetOpen(false); } },
          { label: '포인트 자동', kind: 'ghost', onClick: () => { resetMode('point'); setResetOpen(false); } },
          { label: '커스텀', kind: 'ghost', onClick: () => { resetMode('custom'); setResetOpen(false); } },
          { label: 'CANCEL', kind: 'dark', onClick: () => setResetOpen(false) },
        ]} />
      {del.element}

      <div className="set-row">
        <div className="l"><b>포인트 자동 톤</b><small>포인트 자동 모드를 다크 느낌으로 깔지, 라이트 느낌으로 깔지</small></div>
        <div className="mini-seg">
          <button className={state.pointTone === 'dark' ? 'on' : ''} onClick={() => setPointTone('dark')}>다크 느낌</button>
          <button className={state.pointTone === 'light' ? 'on' : ''} onClick={() => setPointTone('light')}>라이트 느낌</button>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>포인트 컬러</b><small>포인트 자동 모드의 기준색 — 변경 즉시 전체 재파생</small></div>
        <div className="cp-group">
          <ColorField value={state.vars.accent}
            onChange={hex => state.mode === 'point' ? setPointAccent(hex) : setVar('accent', hex)} />
        </div>
      </div>

      {/* 배경 — 그라데이션(각도) / 이미지(블러) 선택 (v1.9) */}
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>배경</b><small>그라데이션(시작→끝·각도) 또는 이미지(업로드·블러)</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div className="mini-seg">
            <button className={(state.vars.bgType ?? 'gradient') === 'gradient' ? 'on' : ''}
              onClick={() => setVar('bgType', 'gradient')}>그라데이션</button>
            <button className={state.vars.bgType === 'image' ? 'on' : ''}
              onClick={() => setVar('bgType', 'image')}>이미지</button>
          </div>
          {(state.vars.bgType ?? 'gradient') === 'gradient' ? (
            <>
              <CP k="bgG1" />
              <span style={{ color: 'var(--faint)', fontSize: 11 }}>→</span>
              <CP k="bgG2" />
              <span className="cp-lb">각도</span>
              <KStep value={state.vars.bgAngle ?? 180} min={0} max={360} step={15} suffix="°"
                onChange={v => setVar('bgAngle', v)} />
            </>
          ) : (
            <>
              <input id="themeBgFile" type="file" accept="image/*" style={{ display: 'none' }}
                onChange={async e => {
                  const f = e.target.files?.[0];
                  if (f) setVar('bgImageId', await putBlob(f));
                  e.target.value = '';
                }} />
              <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                onClick={() => document.getElementById('themeBgFile')?.click()}>
                {state.vars.bgImageId ? 'CHANGE' : 'UPLOAD'}
              </button>
              {state.vars.bgImageId && (
                <button className="btn btn-ghost" style={{ height: 35, padding: '0 14px', fontSize: 11 }}
                  onClick={() => setVar('bgImageId', undefined)}>REMOVE</button>
              )}
              <span className="cp-lb">블러</span>
              <KStep value={state.vars.bgBlur ?? 0} min={0} max={30} step={2} suffix="px"
                onChange={v => setVar('bgBlur', v)} />
            </>
          )}
        </div>
      </div>

      {/* 카드 색 — 패널·게시판 리스트·필터 등 공통 (v1.9) */}
      <div className="set-row">
        <div className="l"><b>카드</b><small>패널·게시판 리스트·필터 카드의 배경과 글씨색 — 보조 글씨색은 자동 파생</small></div>
        <div className="cp-group">
          <CP label="배경" k="cardBg" />
          <CP label="글씨" k="cardFg" />
        </div>
      </div>

      {/* 브라우저 탭 제목 (v1.9 사용자 요청) — 비우면 「로고 텍스트 — 개인홈」 */}
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>브라우저 탭 제목</b><small>탭·즐겨찾기에 표시되는 이름 — 비우면 「로고 텍스트 — 개인홈」</small></div>
        <DocTitleControl />
      </div>

      {/* 브라우저 탭 아이콘 (v2.0 사용자 요청) — 지정 전에는 배포 기본 아이콘이 뜬다 */}
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>브라우저 탭 아이콘</b><small>탭·즐겨찾기에 표시되는 작은 그림 — 정사각형 PNG 권장, 비우면 기본 아이콘</small></div>
        <FaviconControl />
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>크롤링 설명 문구</b><small>카톡·디스코드 등에 링크 공유 시 제목 아래 뜨는 한 줄 — 비우면 서브타이틀, 그것도 비었으면 기본 문구</small></div>
        <CrawlDescControl />
      </div>

      {/* 로고 — 텍스트/서브타이틀/정렬/글씨색 (5.2) */}
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>로고</b><small>상단바 로고 텍스트·아랫줄 서브타이틀·정렬</small></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
          <LogoControls />
          {/* 글씨색은 줄 오른쪽 끝으로 (v1.9 사용자 요청) */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <CP label="글씨" k="topBrand" />
          </div>
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>상단메뉴</b></div>
        <div className="cp-group">
          <CP label="배경" k="topBg" />
          <CP label="글씨" k="topFg" />
          <CP label="호버 글씨" k="topHv" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>하위메뉴 드롭다운</b></div>
        <div className="cp-group">
          <CP label="배경" k="ddBg" />
          <CP label="글씨" k="ddFg" />
          <CP label="호버" k="ddHv" />
        </div>
      </div>

      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>페이지 타이틀</b><small>각 메뉴 상단 큰 제목과 설명 문구</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {/* 헤더 표시 옵션 (v1.9): 둘 다 / 제목만 / 설명만 / 안 띄움 */}
          <div className="mini-seg">
            {(['both', 'title', 'desc', 'none'] as const).map(m => (
              <button key={m} className={(state.vars.pageHead ?? 'both') === m ? 'on' : ''}
                onClick={() => setVar('pageHead', m)}>
                {m === 'both' ? '둘 다' : m === 'title' ? '제목만' : m === 'desc' ? '설명만' : '안 띄움'}
              </button>
            ))}
          </div>
          {/* 모바일에서만 헤더를 생략할지 (v1.9 사용자 요청) */}
          <span className="cp-lb">모바일</span>
          <div className="mini-seg">
            <button className={(state.vars.pageHeadM ?? 'same') === 'same' ? 'on' : ''}
              onClick={() => setVar('pageHeadM', 'same')}>동일</button>
            <button className={state.vars.pageHeadM === 'none' ? 'on' : ''}
              onClick={() => setVar('pageHeadM', 'none')}>생략</button>
          </div>
          <CP label="제목" k="pageTitle" />
          <CP label="설명" k="pageDesc" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>BGM 플레이어</b></div>
        <div className="cp-group">
          <CP label="배경" k="bgmBg" />
          <CP label="글씨" k="bgmFg" />
          <CP label="아이콘" k="bgmIc" />
          <CP label="볼륨바" k="bgmVol" />
        </div>
      </div>

      {/* 캐릭터 탭 리스트 (v1.9 사용자 요청) — 좌측 아이콘 탭 4색 */}
      <div className="set-row">
        <div className="l"><b>캐릭터 탭 리스트</b><small>캐릭터 상세 좌측 아이콘 탭</small></div>
        <div className="cp-grid2">
          <CP label="배경" k="tabBg" />
          <CP label="글씨" k="tabFg" />
          <CP label="선택 배경" k="tabOnBg" />
          <CP label="선택 글씨" k="tabOnFg" />
        </div>
      </div>

      {/* 입력 포커스 (v1.9 사용자 요청) — 인풋·텍스트에리어·드롭다운·에디터 공통 */}
      <div className="set-row" style={{ flexWrap: 'wrap' }}>
        <div className="l"><b>입력 포커스</b><small>인풋·드롭다운을 선택했을 때의 테두리색과 강조 링</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 }}>
          {/* 미리보기는 왼쪽, 설정 컨트롤은 오른쪽 정렬 (v1.9 사용자 요청) */}
          <KInput style={{ width: 130, marginRight: 'auto' }} defaultValue="포커스 미리보기" />
          <CP label="색" k="focusColor" def={state.vars.accent} />
          {/* 한 줄에 들어가도록 짧게 — 자세한 뜻은 툴팁 (v1.9) */}
          <div className="mini-seg">
            <button data-tip="은은하게 번지는 링" className={(state.vars.focusRing ?? 'glow') === 'glow' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'glow')}>번짐</button>
            <button data-tip="선명한 실선 링" className={state.vars.focusRing === 'line' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'line')}>라인</button>
            <button data-tip="링 없이 테두리 색만 바뀜" className={state.vars.focusRing === 'none' ? 'on' : ''}
              onClick={() => setVar('focusRing', 'none')}>테두리만</button>
          </div>
          {(state.vars.focusRing ?? 'glow') !== 'none' && (
            <>
              <span className="cp-lb">두께</span>
              <KStep value={state.vars.focusW ?? 3} min={1} max={6} step={1} suffix="px"
                onChange={v => setVar('focusW', v)} />
            </>
          )}
        </div>
      </div>

      {/* 이미지 편집(크롭) 배경 (v1.9 사용자 요청) — 투명 PNG 위치 지정 시 보이는 판 */}
      <div className="set-row">
        <div className="l"><b>이미지 편집 배경</b><small>썸네일·헤더 위치 지정 화면의 판 — 투명 이미지에서 보임</small></div>
        <div className="cp-group">
          <CP label="배경" k="cropBg" />
        </div>
      </div>

      {/* 스티커 메모 보드 (v1.9 사용자 요청) — 라이트 모드에서 배치 판이 안 보이던 문제 */}
      <div className="set-row">
        <div className="l"><b>스티커 메모 보드</b><small>메모장 배치 판과 메인 미니보드 위젯의 배경</small></div>
        <div className="cp-group">
          <CP label="배경" k="memoBoard" />
          <CP label="테두리" k="memoBoardBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>스크롤바</b></div>
        <div className="cp-group">
          <CP label="색" k="sbThumb" />
          <CP label="테두리" k="sbBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>검색창</b><small>게시판·리스트 공통 검색 인풋 — 라이트/다크 전환 시 자동 연동</small></div>
        {/* 4항목은 한 줄에 안 들어가 밀림 — 2×2 그리드 정렬 (열 맞춤) */}
        <div className="cp-grid2">
          <CP label="배경" k="searchBg" />
          <CP label="글씨" k="searchFg" />
          <CP label="아이콘" k="searchIc" />
          <CP label="테두리" k="searchBd" />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>스위치 탭</b><small>게시판 말머리·갤러리 보기 전환 등 — 고른 쪽은 아래 진한 버튼색을 그대로 따라갑니다</small></div>
        <div className="cp-group">
          <CP label="배경" k="segBg" />
          <CP label="글씨" k="segFg" />
        </div>
      </div>

      {/* 위젯 스타일 (v2.0 사용자 요청) — 메인·사이드 카드. 안 정하면 카드 색을 그대로 따라간다 */}
      <WidgetStyleRow />

      <div className="set-row">
        <div className="l"><b>진한 버튼</b><small>등록·저장 버튼과 체크박스·선택 필터 칩 공통</small></div>
        <div className="cp-group">
          <CP label="버튼" k="btnDark" />
          <CP label="글씨" k="btnDarkFg" />
          <CP label="호버" k="btnDarkHv" />
        </div>
      </div>

      {/* 사이트 역할 폰트 (5.1) — 폰트 라이브러리(내장+직접 등록)에서 선택 + 굵기·크기 보정 */}
      <FontRoleRow role="title" />
      <FontRoleRow role="pagetitle" />
      <FontRoleRow role="subtitle" />
      <FontRoleRow role="logosub" />
      <FontRoleRow role="menu" />
      <FontRoleRow role="dropdown" />
      <FontRoleRow role="body" />

      <div className="set-row">
        <div className="l"><b>모서리 둥글기</b><small>카드/버튼 radius</small></div>
        <KStep value={state.vars.radius} min={0} max={30} onChange={v => setVar('radius', v)} />
      </div>

      {/* 그림자 설정 — 블록/드롭다운 나란히 묶음 */}
      <div className="set-row">
        <div className="l"><b>블록 그림자</b><small>패널·카드·배너·모달의 드롭섀도우 세기 — 0%는 그림자 없음</small></div>
        {/* 색은 왼쪽으로 빼고 세기 컨트롤은 오른쪽 — 아래 「드롭다운 그림자」 행과 열이 맞음 (v1.9 사용자 요청) */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
          <span className="cp-lb" style={{ marginLeft: 'auto' }}>색</span>
          <ColorField value={state.vars.shColor ?? '#000000'} onChange={hex => setVar('shColor', hex)} />
          <div className="mini-seg" style={{ marginLeft: 10 }}>
            {([['없음', 0], ['약하게', 30], ['보통', 50], ['강하게', 100]] as const).map(([label, v]) => (
              <button key={label} className={state.vars.shadow === v ? 'on' : ''}
                onClick={() => setVar('shadow', v)}>{label}</button>
            ))}
          </div>
          <KStep value={state.vars.shadow} min={0} max={200} step={10} suffix="%" onChange={v => setVar('shadow', v)} />
        </div>
      </div>

      <div className="set-row">
        <div className="l"><b>드롭다운 그림자</b><small>하위메뉴·프로필 메뉴·셀렉트 팝업·달력 — 블록 그림자와 별개, 없음도 가능</small></div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="mini-seg">
            {([['없음', 0], ['약하게', 30], ['보통', 50], ['강하게', 100]] as const).map(([label, v]) => (
              <button key={label} className={(state.vars.ddShadow ?? 100) === v ? 'on' : ''}
                onClick={() => setVar('ddShadow', v)}>{label}</button>
            ))}
          </div>
          <KStep value={state.vars.ddShadow ?? 100} min={0} max={200} step={10} suffix="%" onChange={v => setVar('ddShadow', v)} />
        </div>
      </div>

      <SpellCheckRow />
    </div>
  );
}

/** 맞춤법 검사 밑줄 (v2.0 사용자 요청) — 페이지 전체의 빨간 물결줄을 끈다.
 *  다른 로고·탭제목 설정과 같은 드래프트/SAVE 흐름을 탄다. */
function SpellCheckRow() {
  const { site, set } = useSiteDraft();
  const off = !!site.noSpell;
  return (
    <div className="set-row">
      <div className="l"><b>맞춤법 검사 밑줄</b><small>입력칸·에디터에 브라우저가 그리는 빨간 물결줄 — 끄면 사이트 전체에서 보이지 않습니다</small></div>
      <div className="mini-seg">
        <button className={!off ? 'on' : ''} onClick={() => set({ noSpell: false })}>표시</button>
        <button className={off ? 'on' : ''} onClick={() => set({ noSpell: true })}>숨김</button>
      </div>
    </div>
  );
}

/** 메인 페이지 탭 (v1.9 확정) — 모바일 표시 토글 + 모바일 세로 나열 순서
    토글은 모바일에서만 뺀다(사용자 확정) — PC 메인 구성은 편집모드의 [＋ 위젯]·우클릭 삭제로 */
function MainPagePane() {
  const { state, setMobileOff, setMobileOrder, resetMain } = useMainStore();
  const toast = useToast();
  const [resetAsk, setResetAsk] = useState(false);    // 기본 구성 확인 (v1.9)
  // 모바일 순서 목록: 고정 요소(배너·회원정보창)는 포함되지 않음
  const orderable = state.mobileOrder
    .map(id => state.widgets.find(w => w.id === id))
    .filter((w): w is NonNullable<typeof w> => !!w && !w.fixed);

  return (
    <div className="set-sec">
      {/* 제목 + 설명은 다른 탭과 똑같은 흐름(h3 → .d)으로 두고, 기본 구성 버튼만 우상단에 띄움
          (버튼 높이가 제목줄을 늘려 설명문이 떨어져 보이던 문제 — v1.9 사용자 피드백) */}
      <div style={{ position: 'relative' }}>
        <h3>메인 페이지</h3>
        <button className="btn btn-ghost" style={{ position: 'absolute', right: 0, top: -3, padding: '6px 14px', fontSize: 11 }}
          onClick={() => setResetAsk(true)}>기본 구성</button>
      </div>
      <ConfirmModal open={resetAsk} title="메인 페이지를 기본 구성으로 되돌릴까요?"
        body="추가한 위젯과 배치·크기·모바일 순서가 전부 처음 상태로 돌아갑니다. 되돌린 뒤에는 복구할 수 없습니다."
        onClose={() => setResetAsk(false)}
        buttons={[
          { label: 'RESET', kind: 'accent', onClick: () => { resetMain(); setResetAsk(false); toast('메인 페이지가 기본 구성으로 돌아갔습니다'); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setResetAsk(false) },
        ]} />
      <div className="d">모바일 표시 여부 + 모바일 세로 나열 순서 — ⠿ 드래그로 순서 변경</div>

      {/* 메인 레이아웃은 고정 캔버스 하나 — 반응형 옵션 제거 (v1.9, PC/모바일 두 가지만) */}
      <DragList
        items={orderable}
        keyOf={w => w.id}
        onReorder={list => setMobileOrder(list.map(w => w.id))}
        render={(w, i) => (
          <div className="set-row" style={{ width: '100%' }}>
            <div className="l" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
              <span className="mw-no">{i + 1}</span>
              <span className="drag-h">⠿</span>
              <div>
                {/* 뱃지는 이름 옆에 — b가 블록이라 사이에 두면 설명문 줄로 내려감 (v1.9 사용자 피드백) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <b>{widgetLabel(state.widgets, w)}</b>
                  {MULTI_TYPES.includes(w.type) && <span className="pill">중복 추가 가능</span>}
                </div>
                <small>{WIDGET_META[w.type].desc}</small>
              </div>
            </div>
            <KToggle checked={!w.mOff} onChange={v => setMobileOff(w.id, !v)} />
          </div>
        )}
      />
      <p className="hint">토글을 끄면 <b>모바일에서만</b> 빠지고 PC 메인에는 그대로 표시됩니다 · 순서는 <b>모바일 세로 나열 순서</b> — PC 배치는 메인에서 편집모드로 자유 조정</p>
      <p className="hint">메인에서 위젯을 완전히 빼거나 더하려면 편집모드에서 — 추가는 상단바 [＋ 위젯], 삭제는 위젯 우클릭 → 위젯 삭제</p>
      <p className="hint">고정 요소: 슬라이드 배너(최상단) · 회원정보창 — 순서 목록에 포함되지 않음</p>
    </div>
  );
}

/** 위젯 탭 — 메인 위젯들의 내용·설정값을 한곳에서 관리 (메인 페이지의 관리 모달과 같은 데이터) */
function WidgetsPane() {
  const { state } = useMainStore();
  // 설정값이 있는 위젯만 — 실데이터 연동 위젯(DIARY·LATEST·UPCOMING)과 메뉴리스트·회원정보창은 설정값 없음
  const editable = state.widgets.filter(w =>
    (['banner', 'memo', 'dday', 'todo', 'freetext', 'deco'] as const).some(t => t === w.type));

  const editorOf = (w: WidgetConf) => {
    switch (w.type) {
      case 'memo':
      case 'freetext': return <TextSettingEditor conf={w} />;
      case 'dday': return <DdayEditor conf={w} />;
      case 'todo': return <TodoEditor conf={w} />;
      case 'deco': return <DecoEditor conf={w} />;
      case 'banner': return <BannerEditor conf={w} />;
      default: return null;
    }
  };

  return (
    <div className="set-sec">
      <h3>위젯</h3>
      <div className="d">메인 위젯의 내용·설정값 관리 — 메인 페이지의 관리 모달과 같은 데이터라서 어느 쪽에서 바꿔도 즉시 반영</div>

      {editable.map(w => (
        <div key={w.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
            {/* 중복 추가 가능한 위젯(이미지·자유 텍스트)은 번호로 구분 (v1.9) */}
            <b style={{ fontSize: 13, letterSpacing: '.04em' }}>{widgetLabel(state.widgets, w)}</b>
            {MULTI_TYPES.includes(w.type) && <span className="pill">중복 추가 가능</span>}
            <small style={{ color: 'var(--faint)', fontSize: 10.5 }}>{WIDGET_META[w.type].desc}</small>
            {w.mOff && <span className="pill" style={{ marginLeft: 'auto' }}>모바일 제외</span>}
          </div>
          {editorOf(w)}
        </div>
      ))}
      <p className="hint">DIARY·LATEST·UPCOMING은 일기·로드뷰·스케줄 실데이터를 그대로 보여주는 위젯이라 별도 설정값이 없습니다 · 위젯 켜기/끄기와 순서는 「메인 페이지」 카테고리에서</p>
    </div>
  );
}

/** 게시판 관리 탭 (5.2) — 게시판 생성·삭제·스킨·권한 + 게시판별 말머리 + 뱃지 색 */
function BoardPane() {
  const { st, patchSystem } = useBoardSettings();
  const { boards, setBoards, patchBoard } = useBoards();
  const [catBoard, setCatBoard] = useState(MAIN_BOARD_ID);   // 말머리 편집 대상 게시판
  const del = useConfirmDelete();

  const sel = boards.find(b => b.id === catBoard) ?? boards[0];
  const patchCat = (id: string, p: Partial<BoardBadge>) =>
    patchBoard(sel.id, { cats: sel.cats.map(c => (c.id === id ? { ...c, ...p } : c)) });
  const addCat = () => patchBoard(sel.id, {
    cats: [...sel.cats, { id: newId(), label: '새 말머리', bg: '#eef0f2', border: '#d7dae0', fg: '#5d636d' }],
  });
  const removeCat = (id: string) => patchBoard(sel.id, { cats: sel.cats.filter(c => c.id !== id) });

  const colorCells = (b: BoardBadge, patch: (p: Partial<BoardBadge>) => void) => (
    <>
      <span className="cp-lb">배경</span>
      <ColorField value={b.bg} onChange={hex => patch({ bg: hex })} />
      <span className="cp-lb">테두리</span>
      <ColorField value={b.border} onChange={hex => patch({ border: hex })} />
      <span className="cp-lb">글씨</span>
      <ColorField value={b.fg} onChange={hex => patch({ fg: hex })} />
    </>
  );

  const addBoard = () => {
    const id = newId();
    setBoards([...boards, {
      id, name: '새 게시판', desc: '', skin: 'list', permWrite: 'member', permComment: 'member',
      cats: DEFAULT_BOARD_CATS.map(c => ({ ...c, id: newId() })),
    }]);
  };
  const removeBoard = (id: string) => {
    setBoards(boards.filter(b => b.id !== id));
    if (catBoard === id) setCatBoard(MAIN_BOARD_ID);
  };

  const skinLabel: Record<BoardSkin, string> = { list: '기본형', ticket: '티켓형', paint: '그림판형' };
  const permLabel: Record<BoardPerm, string> = { guest: '전체', member: '회원', admin: '관리자' };

  return (
    <div className="set-sec">
      <h3>게시판 관리</h3>
      <div className="d">게시판 생성·삭제·스킨·말머리·뱃지 스타일 설정 — 게시판을 지워도 글 데이터는 남아 있습니다</div>

      <h4 style={{ fontSize: 12.5, margin: '18px 0 4px' }}>게시판 목록</h4>
      <DragList
        items={boards}
        keyOf={b => b.id}
        onReorder={setBoards}
        render={b => (
          <div className="set-row" style={{ width: '100%', flexWrap: 'wrap' }}>
            <div className="l" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="drag-h">⠿</span>
              <LiveInput value={b.name} onValue={v => patchBoard(b.id, { name: v })} style={{ width: 110 }} />
              <small style={{ color: 'var(--faint)' }}>{boardHref(b.id)}</small>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="mini-seg">
                {(['list', 'ticket', 'paint'] as BoardSkin[]).map(sk => (
                  <button key={sk} className={b.skin === sk ? 'on' : ''}
                    onClick={() => patchBoard(b.id, { skin: sk })}>{skinLabel[sk]}</button>
                ))}
              </div>
              <span className="cp-lb">글쓰기</span>
              <KSelect minWidth={70} value={b.permWrite} onChange={v => patchBoard(b.id, { permWrite: v as BoardPerm })}
                options={(['guest', 'member', 'admin'] as BoardPerm[]).map(p => ({ value: p, label: permLabel[p] }))} />
              <span className="cp-lb">댓글</span>
              <KSelect minWidth={70} value={b.permComment} onChange={v => patchBoard(b.id, { permComment: v as BoardPerm })}
                options={(['guest', 'member', 'admin'] as BoardPerm[]).map(p => ({ value: p, label: permLabel[p] }))} />
              {b.id === MAIN_BOARD_ID || b.id === PAINT_BOARD_ID ? (
                <span className="pill" data-tip="기본 게시판은 삭제할 수 없습니다">고정</span>
              ) : (
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px' }}
                  onClick={() => del.ask(`「${b.name}」 게시판을 삭제할까요? 이미 쓴 글은 남지만 목록에서는 더 이상 보이지 않습니다.`,
                    () => removeBoard(b.id))}>DELETE</button>
              )}
            </div>
          </div>
        )}
      />
      <button className="btn btn-ghost" onClick={addBoard} style={{ fontSize: 11, padding: '7px 14px', marginTop: 8 }}>＋ 게시판 추가</button>
      {del.element}

      <h4 style={{ fontSize: 12.5, margin: '26px 0 4px' }}>말머리(카테고리)</h4>
      <div className="d" style={{ marginBottom: 10 }}>게시판마다 따로 관리 — 어느 게시판 것을 고칠지 먼저 골라 주세요</div>
      <KSelect minWidth={140} value={sel.id} onChange={setCatBoard}
        options={boards.map(b => ({ value: b.id, label: b.name }))} />

      <div style={{ marginTop: 10 }}>
        {sel.cats.map(c => (
          <div className="set-row" key={c.id}>
            <div className="l"><LiveInput value={c.label} onValue={v => patchCat(c.id, { label: v })} style={{ width: 100 }} /></div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {colorCells(c, p => patchCat(c.id, p))}
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                onClick={() => removeCat(c.id)}>삭제</button>
            </div>
          </div>
        ))}
        {sel.cats.length === 0 && <p className="hint">말머리가 없습니다 — 추가해 주세요</p>}
      </div>
      <button className="btn btn-ghost" onClick={addCat} style={{ fontSize: 11, padding: '7px 14px', marginTop: 8 }}>＋ 말머리 추가</button>

      <h4 style={{ fontSize: 12.5, margin: '26px 0 4px' }}>시스템 뱃지 색</h4>
      <div className="d" style={{ marginBottom: 10 }}>공지·비밀·접힘 — 모든 게시판 공통, 이름은 그대로 두고 색만 바꿀 수 있습니다</div>
      {st.system.map(b => (
        <div className="set-row" key={b.id}>
          <div className="l">{b.label}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {colorCells(b, p => patchSystem(b.id, p))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 메뉴 관리 탭 (5.2) — 상단 메뉴 트리를 자유롭게: 그룹 생성·삭제·순서, 항목 배치·순서·공개범위.
 *  게시판·섹션(갤러리 등 여러 개로 만든 목록)·커스텀 링크는 만들어도 자동으로 메뉴에 붙지 않고
 *  「미배치」에 머문다 — 원하는 그룹에 직접 넣어야 노출된다 (사용자 확정, 3장 원칙: 데이터는 보존). */
function MenuPane() {
  const [ms, patchMenu] = useMenuSettings();
  const { boards } = useBoards();
  const { map: secMap } = useSections();
  const { links } = useCustomLinks();
  const del = useConfirmDelete();

  const tree = ms.tree ?? defaultTree();
  const extra = [...boardEntries(boards), ...sectionMenuEntries(secMap), ...linkEntries(links)];
  const placedHrefs = new Set(tree.flatMap(g => (g.href ? [g.href] : g.items.map(it => it.href))));
  // href 기준으로 한 번씩만 — FEATURES/게시판/섹션이 같은 href를 가리키는 경우가 있어서 중복 방지
  const unplaced = Array.from(
    new Map(
      [
        ...FEATURES.map(f => ({ href: f.href, name: f.label })),
        ...extra,
      ]
        .filter(u => !placedHrefs.has(u.href))
        .map(u => [u.href, u] as const),
    ).values(),
  );

  const setTree = (next: MenuGroupNode[]) => patchMenu({ tree: next });
  const addGroup = () => setTree([...tree, { id: newGroupId(), label: '새 그룹', items: [] }]);
  const removeGroup = (id: string) => setTree(tree.filter(g => g.id !== id));
  const patchGroup = (id: string, p: Partial<MenuGroupNode>) =>
    setTree(tree.map(g => (g.id === id ? { ...g, ...p } : g)));
  const addItemTo = (groupId: string, href: string) =>
    setTree(tree.map(g => (g.id === groupId ? { ...g, items: [...g.items, { href }] } : g)));
  const removeItem = (groupId: string, href: string) =>
    setTree(tree.map(g => (g.id === groupId ? { ...g, items: g.items.filter(it => it.href !== href) } : g)));
  const patchItem = (groupId: string, href: string, p: Partial<MenuLeaf>) =>
    setTree(tree.map(g => (g.id === groupId ? { ...g, items: g.items.map(it => (it.href === href ? { ...it, ...p } : it)) } : g)));
  const moveItem = (fromId: string, toId: string, href: string) => {
    if (fromId === toId || !toId) return;
    const leaf = tree.find(g => g.id === fromId)?.items.find(it => it.href === href);
    if (!leaf) return;
    setTree(tree.map(g => {
      if (g.id === fromId) return { ...g, items: g.items.filter(it => it.href !== href) };
      if (g.id === toId) return { ...g, items: [...g.items, leaf] };
      return g;
    }));
  };
  const labelOf = (href: string, label?: string) => label ?? menuLabelFor(href, extra) ?? href;
  const visOptions = [
    { value: 'all', label: '전체' }, { value: 'member', label: '회원' }, { value: 'admin', label: '관리자' },
  ];

  return (
    <div className="set-sec">
      <h3>메뉴 관리</h3>
      <div className="d">상단 메뉴 그룹·항목을 자유롭게 구성 — 메뉴에서 빼도 데이터는 그대로 남습니다</div>

      <DragList
        items={tree}
        keyOf={g => g.id}
        onReorder={setTree}
        render={g => (
          <div className="panel" style={{ padding: 14, marginBottom: 10, width: '100%' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <span className="drag-h">⠿</span>
              <LiveInput value={g.label} onValue={v => patchGroup(g.id, { label: v })} style={{ width: 130 }} />
              {g.href && <span className="pill">단독 메뉴 · {g.href}</span>}
              <span className="cp-lb">공개범위</span>
              <KSelect minWidth={90} value={g.vis ?? 'all'} onChange={v => patchGroup(g.id, { vis: v as MenuVis })} options={visOptions} />
              <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 11, padding: '5px 12px' }}
                onClick={() => del.ask(`「${g.label}」 그룹을 삭제할까요? 안의 항목은 미배치로 돌아갑니다.`, () => removeGroup(g.id))}>DELETE</button>
            </div>
            {!g.href && (
              g.items.length > 0 ? (
                <DragList
                  items={g.items}
                  keyOf={it => it.href}
                  onReorder={list => patchGroup(g.id, { items: list })}
                  render={it => (
                    <div className="set-row" style={{ width: '100%', padding: '6px 0' }}>
                      <div className="l" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span className="drag-h">⠿</span>
                        <LiveInput value={it.label ?? ''} onValue={v => patchItem(g.id, it.href, { label: v || undefined })}
                          placeholder={labelOf(it.href)} style={{ width: 110 }} />
                        <small style={{ color: 'var(--faint)' }}>{it.href}</small>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <KSelect minWidth={80} value={it.vis ?? 'all'} onChange={v => patchItem(g.id, it.href, { vis: v as MenuVis })} options={visOptions} />
                        <KSelect minWidth={100} value="" onChange={toId => moveItem(g.id, toId, it.href)}
                          options={[{ value: '', label: '다른 그룹으로' }, ...tree.filter(x => x.id !== g.id && !x.href).map(x => ({ value: x.id, label: x.label }))]} />
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => removeItem(g.id, it.href)}>빼기</button>
                      </div>
                    </div>
                  )}
                />
              ) : <p className="hint">이 그룹에는 항목이 없습니다 — 아래 「미배치」에서 추가해 주세요</p>
            )}
          </div>
        )}
      />
      <button className="btn btn-ghost" onClick={addGroup} style={{ fontSize: 11, padding: '7px 14px' }}>＋ 그룹 추가</button>
      {del.element}

      <h4 style={{ fontSize: 12.5, margin: '22px 0 4px' }}>미배치 — 아직 메뉴에 없는 기능</h4>
      <div className="d" style={{ marginBottom: 8 }}>그룹을 골라 추가하면 상단 메뉴에 나타납니다 (그림판 게시판도 여기서 추가)</div>
      {unplaced.map(u => (
        <div className="set-row" key={u.href}>
          <div className="l"><b>{u.name}</b><small>{u.href}</small></div>
          <KSelect minWidth={150} value="" onChange={gid => { if (gid) addItemTo(gid, u.href); }}
            options={[{ value: '', label: '그룹 선택' }, ...tree.filter(g => !g.href).map(g => ({ value: g.id, label: g.label }))]} />
        </div>
      ))}
      {unplaced.length === 0 && <p className="hint">모든 기능이 메뉴에 배치돼 있습니다</p>}
    </div>
  );
}

/* ---------- 카테고리 → 화면 매핑 ----------
 * 지금 실제로 구현된 건 5개 (디자인 / 메인 페이지 / 위젯 / 메뉴 관리 / 게시판 관리).
 * 나머지 카테고리는 이전 커밋 어딘가에 있던 구현이 빠져 있는 상태 — 저장소 히스토리에서
 * 복원 전까지는 "준비 중" 안내만 표시한다 (없는 걸 있는 척하지 않기 위해). */
const CAT_PANE: Partial<Record<typeof CATEGORIES[number], () => React.ReactElement>> = {
  '디자인': DesignPane,
  '메인 페이지': MainPagePane,
  '위젯': WidgetsPane,
  '메뉴 관리': MenuPane,
  '게시판 관리': BoardPane,
};

function SettingsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAdmin, ready } = useAuth();
  const tabParam = params.get('tab');
  const initial = (CATEGORIES as readonly string[]).includes(tabParam ?? '')
    ? (tabParam as typeof CATEGORIES[number]) : CATEGORIES[0];
  const [cat, setCat] = useState<typeof CATEGORIES[number]>(initial);

  const go = (c: typeof CATEGORIES[number]) => {
    setCat(c);
    router.replace(`/settings?tab=${encodeURIComponent(c)}`);
  };

  if (!ready) return <section className="page" />;
  if (!isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>SETTINGS</PageTitle><p>관리자 전용 페이지입니다</p></div>
      </section>
    );
  }

  const Pane = CAT_PANE[cat];

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>SETTINGS</PageTitle>
        <EditableDesc k="settings-desc" def="사이트 환경설정 — 왼쪽에서 카테고리를 골라 주세요" />
      </div>
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 148 }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => go(c)}
              style={{
                textAlign: 'left', padding: '9px 12px', borderRadius: 8, fontSize: 12.5,
                border: 'none', cursor: 'var(--cur-pointer,pointer)',
                background: c === cat ? 'var(--accent)' : 'transparent',
                color: c === cat ? '#fff' : 'var(--sub)',
                fontWeight: c === cat ? 700 : 400,
              }}>{c}</button>
          ))}
        </nav>
        <div className="panel" style={{ flex: 1, padding: 24, minWidth: 280 }}>
          {Pane ? <Pane /> : (
            <div className="set-sec">
              <h3>{cat}</h3>
              <div className="d">이 카테고리 화면은 아직 복구되지 않았습니다 — 저장소 커밋 히스토리에서 이전 버전을 찾아 복원이 필요합니다.</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  // useSearchParams는 Suspense 경계 필요 (Next App Router)
  return <Suspense fallback={<section className="page" />}><SettingsInner /></Suspense>;
}
