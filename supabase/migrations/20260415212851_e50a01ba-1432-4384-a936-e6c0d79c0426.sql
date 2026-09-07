CREATE TABLE public.trend_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trend_id uuid NOT NULL REFERENCES public.trends(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'reddit',
  author text,
  content text NOT NULL,
  source_url text,
  likes integer DEFAULT 0,
  replies integer DEFAULT 0,
  posted_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trend_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trend comments"
  ON public.trend_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert trend comments"
  ON public.trend_comments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can delete trend comments"
  ON public.trend_comments FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_trend_comments_trend_id ON public.trend_comments(trend_id);
CREATE INDEX idx_trend_comments_platform ON public.trend_comments(platform);