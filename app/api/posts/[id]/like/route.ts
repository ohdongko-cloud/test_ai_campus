import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabase';

// POST /api/posts/[id]/like  body: { sessionId, action: 'like'|'unlike' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessionId, action } = await req.json();

  if (!sessionId) return NextResponse.json({ error: 'sessionId 필요' }, { status: 400 });

  const db = createServiceClient();

  if (action === 'unlike') {
    const { data: existing } = await db.from('post_likes').select('id').eq('post_id', id).eq('session_id', sessionId).single();
    if (existing) {
      await db.from('post_likes').delete().eq('id', existing.id);
      const { data: post } = await db.from('posts').select('likes_count').eq('id', id).single();
      if (post) await db.from('posts').update({ likes_count: Math.max(0, post.likes_count - 1) }).eq('id', id);
    }
    const { data } = await db.from('posts').select('likes_count').eq('id', id).single();
    return NextResponse.json({ likes_count: data?.likes_count ?? 0, liked: false });
  }

  // like
  const { error: insertError } = await db.from('post_likes').insert({ post_id: id, session_id: sessionId });
  if (insertError) {
    // 이미 좋아요한 경우 (unique constraint)
    const { data } = await db.from('posts').select('likes_count').eq('id', id).single();
    return NextResponse.json({ likes_count: data?.likes_count ?? 0, liked: true });
  }

  const { data: post } = await db.from('posts').select('likes_count').eq('id', id).single();
  const newCount = (post?.likes_count ?? 0) + 1;
  await db.from('posts').update({ likes_count: newCount }).eq('id', id);
  return NextResponse.json({ likes_count: newCount, liked: true });
}
