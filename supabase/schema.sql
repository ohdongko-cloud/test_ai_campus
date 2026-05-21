-- posts
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  password_hash TEXT,
  link          TEXT,
  views_count   INTEGER NOT NULL DEFAULT 0,
  likes_count   INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- post_likes
CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  liked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, session_id)
);

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  password_hash TEXT,
  likes_count   INTEGER NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- comment_likes
CREATE TABLE IF NOT EXISTS comment_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  liked_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(comment_id, session_id)
);

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read"   ON posts FOR SELECT USING (true);
CREATE POLICY "public_insert" ON posts FOR INSERT WITH CHECK (true);

CREATE POLICY "public_read"   ON post_likes FOR SELECT USING (true);
CREATE POLICY "public_insert" ON post_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete" ON post_likes FOR DELETE USING (true);

CREATE POLICY "public_read"   ON comments FOR SELECT USING (true);
CREATE POLICY "public_insert" ON comments FOR INSERT WITH CHECK (true);

CREATE POLICY "public_read"   ON comment_likes FOR SELECT USING (true);
CREATE POLICY "public_insert" ON comment_likes FOR INSERT WITH CHECK (true);
CREATE POLICY "public_delete" ON comment_likes FOR DELETE USING (true);

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_updated_at    BEFORE UPDATE ON posts    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
