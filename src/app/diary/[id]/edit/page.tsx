'use client';
// 일기 수정 (4.14) — 페이지형
import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useLocalList } from '@/lib/postStore';
import { DiaryPost, DIARY_SEED, Mood, MOOD_SEED } from '@/lib/diaryStore';
import { DiaryForm } from '@/components/diary/DiaryForm';
import { useToast } from '@/components/ui/Toast';
import { PageTitle } from '@/components/ui/PageText';

export default function DiaryEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [posts, setPosts, loaded] = useLocalList<DiaryPost>('ohome.diary.v1', DIARY_SEED);
  const [moods] = useLocalList<Mood>('ohome.moods.v1', MOOD_SEED);
  const p = posts.find(x => x.id === id);

  if (!loaded) return <section className="page" />;
  if (!isAdmin || !p) {
    return (
      <section className="page">
        <div className="page-head"><PageTitle>DIARY</PageTitle><p>일기를 찾을 수 없거나 권한이 없습니다</p></div>
      </section>
    );
  }

  return (
    <section className="page">
      <div className="page-head"><PageTitle>EDIT DIARY</PageTitle><p>{p.title}</p></div>
      <DiaryForm initial={p} moods={moods}
        onCancel={() => router.push('/diary')}
        onSave={v => {
          setPosts(posts.map(x => (x.id === p.id ? { ...x, ...v } : x)));
          toast('저장되었습니다');
          router.push('/diary');
        }} />
    </section>
  );
}
