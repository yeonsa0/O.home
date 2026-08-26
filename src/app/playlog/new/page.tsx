'use client';
// 플레이기록 추가 (4.16) — 페이지형 등록
import React, { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useSectionParam, secStamp, secQuery } from '@/lib/sectionStore';
import { useLocalList, newId } from '@/lib/postStore';
import { PlayRecord, PLAYLOG_SEED } from '@/lib/galleryStore';
import { PlaylogForm } from '@/components/trpg/PlaylogForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';

function PlaylogNewPageInner() {
  // 어느 섹션에서 눌러 왔는지 (v2.0) — 새 항목을 그 목록에 넣는다
  const sec = useSectionParam('playlog');
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useLocalList<PlayRecord>('ohome.playlog.v1', PLAYLOG_SEED);

  if (!isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>PLAY LOG</PageTitle><p>관리자 전용 페이지</p></div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head"><PageTitle>ADD RECORD</PageTitle><EditableDesc k="playlog-new-desc" def="플레이기록 추가" /></div>
      <PlaylogForm initial={null} records={records}
        onCancel={() => router.push('/playlog' + secQuery(sec.id))}
        onSave={v => {
          setRecords([...records, { id: newId(), ...v, ...secStamp(sec.id) }]);
          toast('기록이 추가되었습니다');
          router.push('/playlog' + secQuery(sec.id));
        }} />
    </section>
  );
}

export default function PlaylogNewPage() {
  return <Suspense fallback={<section className="page" />}><PlaylogNewPageInner /></Suspense>;
}
