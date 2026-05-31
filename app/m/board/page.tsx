'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { M } from '../_styles/tokens';
import MobileHeader from '../_components/MobileHeader';
import MobileSearchBar from '../_components/MobileSearchBar';
import MobilePostCard from '../_components/MobilePostCard';
import type { Post } from '../../../lib/types';

export default function MobileBoardPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/posts');
        if (!res.ok) {
          setError('게시판을 불러오지 못했습니다.');
          return;
        }
        const data = await res.json();
        const list: Post[] = Array.isArray(data) ? data : (data?.posts ?? []);
        setPosts(list);
      } catch {
        setError('서버에 연결할 수 없습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return posts;
    return posts.filter(
      p => p.title.toLowerCase().includes(t) || (p.content || '').toLowerCase().includes(t)
    );
  }, [posts, q]);

  return (
    <>
      <MobileHeader title="게시판" />
      <div style={{ paddingTop: 16, paddingBottom: 24, maxWidth: M.maxW, margin: '0 auto' }}>
        <MobileSearchBar
          value={q}
          onChange={setQ}
          placeholder="관심 주제를 검색해보세요"
        />

        <div style={{ marginTop: 16 }}>
          {loading ? (
            <Skeleton />
          ) : error ? (
            <ErrorBox msg={error} />
          ) : filtered.length === 0 ? (
            <Empty msg={q ? '검색 결과가 없어요' : '아직 게시글이 없어요'} />
          ) : (
            filtered.map(p => (
              <MobilePostCard
                key={p.id}
                post={p}
                onClick={post => router.push(`/m/board?id=${encodeURIComponent(post.id)}`)}
              />
            ))
          )}
        </div>
      </div>

      {/* 글쓰기 FAB */}
      <button
        type="button"
        aria-label="새 게시글 작성"
        onClick={() => router.push('/m/board?new=1')}
        style={{
          position: 'fixed',
          right: 20,
          bottom: `calc(${M.tabBarH}px + env(safe-area-inset-bottom, 0px) + 20px)`,
          width: 56,
          height: 56,
          borderRadius: 28,
          background: M.primary,
          color: '#fff',
          border: 'none',
          boxShadow: M.shadowLg,
          cursor: 'pointer',
          fontSize: 28,
          fontWeight: 700,
          zIndex: 30,
          fontFamily: M.fontEn,
          lineHeight: 1,
        }}
      >
        +
      </button>
    </>
  );
}

function Skeleton() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            margin: '0 16px 12px',
            borderRadius: M.r3,
            border: `1px solid ${M.border}`,
            background: M.surface,
            padding: 16,
          }}
        >
          <div style={{ height: 14, width: '70%', background: M.surfaceAlt, borderRadius: 4, marginBottom: 8 }} />
          <div style={{ height: 12, width: '40%', background: M.surfaceAlt, borderRadius: 4 }} />
        </div>
      ))}
    </>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: M.textMuted, fontSize: 14, fontFamily: M.fontKo }}>
      {msg}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div
      style={{
        margin: '0 16px',
        padding: 16,
        background: M.dangerBg,
        color: M.danger,
        borderRadius: M.r3,
        fontSize: 13,
        fontFamily: M.fontKo,
        textAlign: 'center',
      }}
    >
      {msg}
    </div>
  );
}
