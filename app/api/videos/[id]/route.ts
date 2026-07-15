import { NextRequest, NextResponse } from 'next/server';
import { getVideoById } from '../../../../lib/videos';

// GET /api/videos/[id] → 단일 영상 (미존재 404). PII 없음, 목록과 동일 필드.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id 필요' }, { status: 400 });
  try {
    const video = await getVideoById(decodeURIComponent(id));
    if (!video) {
      return NextResponse.json({ error: '영상을 찾을 수 없습니다.' }, { status: 404 });
    }
    const res = NextResponse.json(video);
    // 목록 엔드포인트와 동일 posture — PII 없음이라 공개 캐시 허용.
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return res;
  } catch {
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
