import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '../../../../../lib/supabase';

// POST /api/comments/[id]/like  body: { sessionId, action: 'like'|'unlike' }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sessionId, action } = await req.json();
  if (!sessionId) return NextResponse.json({ error: 'sessionId 필요' }, { status: 400 });

  const db = createServiceClient();

  if (action === 'unlike') {
    const { data: existing } = await db.from('comment_likes').select('id').eq('comment_id', id).eq('session_id', sessionId).single();
    if (existing) {
      await db.from('comment_likes').delete().eq('id', existing.id);
      const { data: comment } = await db.from('comments').select('likes_count').eq('id', id).single();
      if (comment) await db.from('comments').update({ likes_count: Math.max(0, comment.likes_count - 1) }).eq('id', id);
    }
    const { data } = await db.from('comments').select('likes_count').eq('id', id).single();
    return NextResponse.json({ likes_count: data?.likes_count ?? 0, liked: false });
  }

  const { error: insertError } = await db.from('comment_likes').insert({ comment_id: id, session_id: sessionId });
  if (insertError) {
    const { data } = await db.from('comments').select('likes_count').eq('id', id).single();
    return NextResponse.json({ likes_count: data?.likes_count ?? 0, liked: true });
  }

  const { data: comment } = await db.from('comments').select('likes_count').eq('id', id).single();
  const newCount = (comment?.likes_count ?? 0) + 1;
  await db.from('comments').update({ likes_count: newCount }).eq('id', id);
  return NextResponse.json({ likes_count: newCount, liked: true });
}
