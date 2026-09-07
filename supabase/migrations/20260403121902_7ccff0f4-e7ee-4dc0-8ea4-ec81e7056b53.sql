ALTER TABLE public.creator_posts
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'instagram',
  ADD COLUMN IF NOT EXISTS views integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_url text;

CREATE INDEX IF NOT EXISTS idx_creator_posts_platform ON public.creator_posts (platform);
CREATE INDEX IF NOT EXISTS idx_creator_posts_creator_platform ON public.creator_posts (creator_id, platform);