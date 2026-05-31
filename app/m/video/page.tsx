'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { M } from '../_styles/tokens';
import MobileHeader from '../_components/MobileHeader';
import MobileVideoCard from '../_components/MobileVideoCard';
import type { Video, VideoLevel } from '../../../lib/types';
import { getSessionId } from '../../../lib/utils';

const ALL = '전체';

export default function MobileVideoListPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>([]);
  const [levels, setLevels] = useState<VideoLevel[]>([]);
  const [activeLevel, setActiveLevel] = useState<string>(ALL);
  const [statsById, setStatsById] = useState<Record<string, { likes: number; comments: number }>>({});
  const [loading, setLoading] = useState(true);

  // 데이터 로드
  useEffect(() => {
    (async () => {
      try {
        const [vRes, lRes] = await Promise.all([fetch('/api/videos'), fetch('/api/video-levels')]);
        if (vRes.ok) setVideos(await vRes.json());
        if (lRes.ok) setLevels(await lRes.json());
      } catch {
        /* offline fallback (SW 처리) */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 영상별 stats 로드
  useEffect(() => {
    if (videos.length === 0) return;
    const ids = videos.map(v => v.id).join(',');
    const sid = getSessionId();
    fetch(`/api/videos/stats?ids=${encodeURIComponent(ids)}&sessionId=${encodeURIComponent(sid)}`)
      .then(r => r.ok ? r.json() : [])
      .then((arr: { video_id: string; likes_count: number; comments_count: number }[]) => {
        const map: typeof statsById = {};
        for (const s of arr) {
          map[s.video_id] = { likes: s.likes_count, comments: s.comments_count };
        }
        setStatsById(map);
      })
      .catch(() => { /* ignore */ });
  }, [videos]);

  const filtered = useMemo(() => {
    if (activeLevel === ALL) return videos;
    return videos.filter(v => v.level === activeLevel);
  }, [videos, activeLevel]);

  const countByLevel = useMemo(() => {
    const c: Record<string, number> = { [ALL]: videos.length };
    for (const v of videos) c[v.level] = (c[v.level] || 0) + 1;
    return c;
  }, [videos]);

  return (
    <>
      <MobileHeader title="AI 강의" />

      {/* 레벨 필터 칩 */}
      <div
        style={{
          padding: '16px',
          maxWidth: M.maxW,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            paddingBottom: 4,
          }}
        >
          <Chip
            label={ALL}
            count={countByLevel[ALL]}
            active={activeLevel === ALL}
            onClick={() => setActiveLevel(ALL)}
          />
          {levels.map(l => (
            <Chip
              key={l.id}
              label={l.name}
              count={countByLevel[l.name] || 0}
              active={activeLevel === l.name}
              onClick={() => setActiveLevel(l.name)}
            />
          ))}
        </div>
      </div>

      {/* 리스트 */}
      <div style={{ maxWidth: M.maxW, margin: '0 auto', paddingTop: 8 }}>
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <Empty msg="해당 레벨의 강의가 아직 없어요" />
        ) : (
          filtered.map(v => (
            <MobileVideoCard
              key={v.id}
              video={v}
              likes={statsById[v.id]?.likes}
              comments={statsById[v.id]?.comments}
              onClick={video => router.push(`/m/video/${encodeURIComponent(video.id)}`)}
            />
          ))
        )}
      </div>
    </>
  );
}

function Chip({
  label, count, active, onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        padding: '10px 16px',
        borderRadius: 24,
        border: active ? 'none' : `1px solid ${M.border}`,
        background: active ? M.primary : M.surface,
        color: active ? '#fff' : M.textBody,
        fontSize: 13,
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: M.fontKo,
        letterSpacing: '-0.01em',
      }}
    >
      {label} · {count}
    </button>
  );
}

function SkeletonList() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            margin: '0 16px 16px',
            borderRadius: M.r4,
            border: `1px solid ${M.border}`,
            background: M.surface,
            overflow: 'hidden',
          }}
        >
          <div style={{ paddingTop: '56.25%', background: M.surfaceAlt }} />
          <div style={{ padding: 16 }}>
            <div style={{ height: 14, width: '60%', background: M.surfaceAlt, borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 14, width: '90%', background: M.surfaceAlt, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: 60,
        color: M.textMuted,
        fontSize: 14,
      }}
    >
      {msg}
    </div>
  );
}
