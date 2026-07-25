-- Supports selective entity-notification queries that start at a user's blog access row.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_zero_blog_blogger_user_blog
  ON public.blog_blogger (user_id, blog_id);
