"use client";

import { useState, useEffect, useCallback } from 'react';
import { Post, Comment } from '../lib/types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type SortKey = 'latest' | 'popular';

function downloadCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminBoardStats() {
  const [posts, setPosts]       = useState<Post[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sort, setSort]         = useState<SortKey>('latest');
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState<'posts' | 'comments'>('posts');
  const [dailyData, setDailyData] = useState<{ date: string; posts: number; comments: number }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [pRes] = await Promise.all([fetch(`/api/posts?sort=${sort}&page=1`)]);
    if (pRes.ok) {
      const pData: Post[] = await pRes.json();
      setPosts(pData);

      // 일별 게시글 집계 (최근 7일)
      const dayMap: Record<string, { posts: number; comments: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        dayMap[d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })] = { posts: 0, comments: 0 };
      }
      pData.forEach(p => {
        const key = new Date(p.created_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
        if (dayMap[key]) dayMap[key].posts++;
      });
      setDailyData(Object.entries(dayMap).map(([date, v]) => ({ date, ...v })));
    }
    setLoading(false);
  }, [sort]);

  useEffect(() => { load(); }, [load]);

  // 댓글은 게시글별로 가져오는 구조라 어드민에서는 posts 기반 통계만 사용
  const totalViews  = posts.reduce((s, p) => s + p.views_count, 0);
  const totalLikes  = posts.reduce((s, p) => s + p.likes_count, 0);
  const totalCmts   = posts.reduce((s, p) => s + p.comments_count, 0);
  const avgViews    = posts.length ? Math.round(totalViews / posts.length) : 0;

  const CARDS = [
    { label: '전체 게시글', value: posts.length, unit: '개' },
    { label: '전체 댓글',  value: totalCmts,   unit: '개' },
    { label: '전체 좋아요', value: totalLikes,  unit: '개' },
    { label: '평균 조회수', value: avgViews,    unit: '회' },
  ];

  return (
    <div className="space-y-8">
      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-4">
        {CARDS.map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <p className="text-sm text-gray-500 mb-1">{c.label}</p>
            <p className="text-3xl font-bold text-gray-900">
              {c.value}<span className="text-base font-normal text-gray-500 ml-1">{c.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 일별 게시글 수 차트 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-800 mb-4">최근 7일 게시글 수</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="posts" fill="#2563EB" radius={[4,4,0,0]} name="게시글" label={{ position: 'top', fontSize: 10 }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 게시글 테이블 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
          <h3 className="text-base font-semibold text-gray-800">게시글 목록</h3>
          <div className="flex gap-2">
            {(['latest','popular'] as const).map(s => (
              <button key={s} onClick={() => setSort(s)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${sort === s ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}>
                {s === 'latest' ? '최신순' : '인기순'}
              </button>
            ))}
            <button
              onClick={() => downloadCSV(posts.map(p => ({ 제목: p.title, 조회수: p.views_count, 좋아요: p.likes_count, 댓글: p.comments_count, 작성일: new Date(p.created_at).toLocaleString('ko-KR') })), '게시판_게시글.csv')}
              className="px-3 py-1.5 rounded text-xs font-medium bg-gray-800 text-white hover:bg-black transition-colors"
            >
              CSV 다운로드
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 py-6 text-center">불러오는 중...</p>
        ) : posts.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">게시글이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm" style={{ minWidth: 540 }}>
              <thead>
                <tr className="bg-gray-50">
                  {['제목', '조회수', '좋아요', '댓글', '작성일'].map(col => (
                    <th key={col} className="border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 font-semibold">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {posts.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-800 max-w-[220px] truncate">{p.title}</td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-center">{p.views_count}</td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-center">{p.likes_count}</td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-center">{p.comments_count}</td>
                    <td className="border border-gray-200 px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{new Date(p.created_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
