'use client';
// 감상타래 — 작품 정보 수정 (4.17 페이지형)
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';
import { ThreadForm } from '@/components/threads/ThreadForm';

export default function ThreadEditPage() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>THREADS</PageTitle><p>관리자 전용 페이지</p></div>
      </section>
    );
  }
  return (
    <section className="page">
      <div className="page-head">
        <PageTitle>THREADS</PageTitle>
        <EditableDesc k="threads-edit-desc" def="작품 정보 수정" />
      </div>
      <ThreadForm editId={id} />
    </section>
  );
}
