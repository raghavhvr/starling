
CREATE TABLE public.virlo_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  endpoint TEXT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_virlo_cache_key ON public.virlo_cache(cache_key);
CREATE INDEX idx_virlo_cache_expires ON public.virlo_cache(expires_at);

ALTER TABLE public.virlo_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view virlo cache"
  ON public.virlo_cache FOR SELECT
  TO authenticated
  USING (true);
