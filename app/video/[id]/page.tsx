import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getVideoById } from '../../../lib/videos';
import { getCurrentUser } from '../../../lib/session';
import { extractVideoId } from '../../../lib/utils';
import VideoWatch from '../../../components/VideoWatch';

// 사용자별 워터마크가 들어가므로 CDN 캐시 금지(동적 렌더).
export const dynamic = 'force-dynamic';

// OG 메타는 인증과 무관하게 항상 반환 → 카톡·팀즈 등 스크래퍼(쿠키 없음)도 미리보기 카드 렌더.
// 단, 색인은 막는다(noindex) — 사내 한정 자료.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const video = await getVideoById(decodeURIComponent(id));
  if (!video) {
    return {
      title: '영상을 찾을 수 없습니다 · 이랜드리테일 AI 캠퍼스',
      robots: { index: false, follow: false },
    };
  }
  const ytid = extractVideoId(video.youtubeUrl);
  const thumb = ytid ? `https://img.youtube.com/vi/${ytid}/hqdefault.jpg` : undefined;
  const desc =
    (video.description || '').split('\n').map(s => s.trim()).filter(Boolean)[0]
    || '이랜드리테일 임직원 전용 강의 영상';
  return {
    title: `${video.title} · 이랜드리테일 AI 캠퍼스`,
    description: desc,
    robots: { index: false, follow: false },
    openGraph: {
      title: video.title,
      description: desc,
      type: 'video.other',
      ...(thumb ? { images: [thumb] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: video.title,
      description: desc,
      ...(thumb ? { images: [thumb] } : {}),
    },
  };
}

export default async function VideoWatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = await getVideoById(decodeURIComponent(id));
  if (!video) notFound();
  const user = await getCurrentUser();
  return <VideoWatch video={video} watermarkEmail={user?.email ?? null} />;
}
