'use client';
// 감상타래 — 새 타래 시작 (작품 등록, 4.17 페이지형)
import { useAuth } from '@/lib/auth';
import { PageTitle, EditableDesc } from '@/components/ui/PageText';
import { ThreadForm } from '@/components/threads/ThreadForm';

export default function ThreadNewPage() {
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
        <EditableDesc k="threads-new-desc" def="새 타래 시작 — 작품 정보를 등록하면 타래에 글을 이어 쓸 수 있습니다" />
      </div>
      <ThreadForm />
    </section>
  );
}
