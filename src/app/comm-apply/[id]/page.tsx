'use client';
// 신청 상세 (4.18) — 마감일·상태·신청 정보 + 내용(권한자만) + 제출 신청서 HTML(격리 렌더) · 수정/삭제
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import {
  Applicant, APPLY_SEED, CommItem, COMM_SEED, useCommSettings, badgeStyle, maskName, applyVis, APPLY_VIS_LABEL,
} from '@/lib/commStore';
import { sanitizeHtml } from '@/lib/sanitize';
import { getBlob } from '@/lib/blobStore';
import { HtmlBody } from '@/components/ui/HtmlBody';
import { ConfirmModal } from '@/components/ui/Modal';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

export default function ApplicantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAdmin } = useAuth();
  const [apps, setApps, loaded] = useLocalList<Applicant>('ohome.commapply.v1', APPLY_SEED);
  const [comms] = useLocalList<CommItem>('ohome.comm.v1', COMM_SEED);
  const [settings, , setLoaded] = useCommSettings();
  const [delAsk, setDelAsk] = useState(false);

  const a = apps.find(x => x.id === id);
  const vis = a ? applyVis(a) : 'private';
  // 본인 열람 — 지정 회원(selfId)만, 미지정 구버전 데이터는 로그인 회원 허용
  const canSee = isAdmin || vis === 'public'
    || (vis === 'self' && !!user && (a?.selfId ? user.id === a.selfId : true));
  const html = useMemo(() => (a && canSee ? sanitizeHtml(a.content) : ''), [a, canSee]);

  // 제출 신청서 HTML (v1.9) — blob에서 읽어 널 오리진 iframe 샌드박스로 격리 렌더 (스크립트 실행 불가)
  const [submitHtml, setSubmitHtml] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setSubmitHtml(null);
    if (a?.submitFileId && canSee) {
      getBlob(a.submitFileId).then(b => {
        if (!b || cancelled) return;
        b.text().then(t => { if (!cancelled) setSubmitHtml(t); });
      });
    }
    return () => { cancelled = true; };
  }, [a?.submitFileId, canSee]);

  if (!loaded || !setLoaded) return <section className="page" />;
  if (!a || (settings.applyVisibility === 'private' && !isAdmin)
    || (settings.applyVisibility === 'member' && !user)) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>APPLICANTS</PageTitle><p>신청을 찾을 수 없거나 열람 권한이 없습니다</p></div>
      </section>
    );
  }

  const badge = settings.applyBadges.find(b => b.id === a.badgeId);
  const comm = comms.find(c => c.id === a.commId);

  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>APPLICANT</PageTitle>
        <EditableDesc k="commapply-detail-desc" def="신청 상세" />
        <div className="head-actions">
          {isAdmin && <button className="btn btn-dark" onClick={() => router.push(`/comm-apply/${a.id}/edit`)}>EDIT</button>}
          {isAdmin && <button className="btn btn-dark" onClick={() => setDelAsk(true)}>DELETE</button>}
        </div>
      </div>

      {/* 본문만 폭 제한 — 헤더(제목·설명)는 풀폭 위치 유지 */}
      <div className="panel" style={{ padding: 28, maxWidth: 760, margin: '0 auto' }}>
        {/* 상단 — 마감일 크게 + 상태 뱃지 */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, borderBottom: '1.5px solid var(--line)', paddingBottom: 16 }}>
          <div>
            <small style={{ display: 'block', fontSize: 9, letterSpacing: '.22em', color: 'var(--faint)' }}>DEADLINE</small>
            <b style={{ fontFamily: 'var(--serif)', fontSize: 26, letterSpacing: '.05em' }}>
              {a.deadline ? a.deadline.replace(/-/g, '.') : '—'}
            </b>
          </div>
          {badge && <span style={{ ...badgeStyle(badge, settings.badgeShape), marginBottom: 5 }}>{badge.label}</span>}
        </div>

        {/* 신청 정보 */}
        <div style={{ display: 'grid', gap: 8, padding: '16px 0', borderBottom: '1px dashed var(--line)', fontSize: 12.5 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* 비권한자에게는 마스킹 표기 (관리자만 전체) */}
            <b style={{ minWidth: 76, color: 'var(--faint)', fontWeight: 600 }}>신청자</b>
            {isAdmin ? a.name : maskName(a.name, a.nameOpen ?? 1)}
          </div>
          {a.source && (
            <div style={{ display: 'flex', gap: 10 }}>
              <b style={{ minWidth: 76, color: 'var(--faint)', fontWeight: 600 }}>출처</b>{a.source}
            </div>
          )}
          {a.appliedDate && (
            <div style={{ display: 'flex', gap: 10 }}>
              <b style={{ minWidth: 76, color: 'var(--faint)', fontWeight: 600 }}>신청일</b>{a.appliedDate.replace(/-/g, '.')}
            </div>
          )}
          {comm && (
            <div style={{ display: 'flex', gap: 10 }}>
              <b style={{ minWidth: 76, color: 'var(--faint)', fontWeight: 600 }}>커미션</b>
              <span style={{ color: 'var(--accent)', cursor: 'var(--cur-pointer,pointer)', fontWeight: 600 }}
                onClick={() => router.push(`/comm/${comm.id}`)}>{comm.name} ›</span>
            </div>
          )}
        </div>

        {/* 내용 — 관리자 / 열람 허용된 본인만 */}
        <div style={{ paddingTop: 16 }}>
          {canSee ? (
            a.content
              ? <HtmlBody className="post-body" style={{ fontSize: 13 }} html={html} />
              : <p className="hint">내용이 비어 있습니다</p>
          ) : (
            <p className="hint" style={{ textAlign: 'center', padding: '14px 0' }}>
              {vis === 'self'
                ? '내용 비공개 — 관리자와 신청자 본인만 열람할 수 있습니다 (로그인 필요)'
                : '내용 비공개 — 관리자만 열람할 수 있습니다'}
            </p>
          )}
        </div>

        {/* 제출된 신청서 HTML — 커미션 양식으로 받은 파일 (격리 iframe, 권한자만) */}
        {canSee && a.submitFileId && (
          <div style={{ marginTop: 18, borderTop: '1px dashed var(--line)', paddingTop: 16 }}>
            <h4 style={{ fontSize: 11.5, letterSpacing: '.12em', color: 'var(--faint)', marginBottom: 12 }}>SUBMITTED FORM</h4>
            {submitHtml !== null ? (
              /* allow-scripts만 — 널 오리진이라 사이트 쿠키·스토리지 접근 불가 (6.3 정책), 내장 이미지 뷰어 동작용 */
              <iframe sandbox="allow-scripts" srcDoc={submitHtml} title="제출된 신청서"
                style={{ width: '100%', height: 520, border: '1px solid var(--line)', borderRadius: 11, background: '#f4f2ef' }} />
            ) : (
              <p className="hint">신청서를 불러오는 중…</p>
            )}
          </div>
        )}
      </div>

      <ConfirmModal open={delAsk} title="신청을 삭제하시겠습니까?"
        body={`"${isAdmin ? a.name : maskName(a.name, a.nameOpen ?? 1)}" — 삭제하면 복구할 수 없습니다.`}
        onClose={() => setDelAsk(false)}
        buttons={[
          { label: 'DELETE', kind: 'accent', onClick: () => { setApps(apps.filter(x => x.id !== a.id)); router.push('/comm-apply'); } },
          { label: 'CANCEL', kind: 'ghost', onClick: () => setDelAsk(false) },
        ]} />
    </section>
  );
}
