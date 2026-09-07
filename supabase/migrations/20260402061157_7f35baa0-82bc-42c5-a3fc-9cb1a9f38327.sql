CREATE TABLE public.creator_platforms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  handle TEXT,
  followers INTEGER DEFAULT 0,
  engagement_rate NUMERIC DEFAULT 0,
  avatar_url TEXT,
  bio TEXT,
  profile_url TEXT,
  platform_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creator_id, platform)
);

CREATE INDEX idx_creator_platforms_creator ON public.creator_platforms(creator_id);
CREATE INDEX idx_creator_platforms_platform ON public.creator_platforms(platform);
CREATE INDEX idx_creator_platforms_handle ON public.creator_platforms(handle);

ALTER TABLE public.creator_platforms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view creator platforms"
ON public.creator_platforms FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert creator platforms"
ON public.creator_platforms FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update creator platforms"
ON public.creator_platforms FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete creator platforms"
ON public.creator_platforms FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_creator_platforms_updated_at
BEFORE UPDATE ON public.creator_platforms
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing Instagram data into creator_platforms
INSERT INTO public.creator_platforms (creator_id, platform, handle, followers, engagement_rate, avatar_url, bio, profile_url)
SELECT 
  id,
  COALESCE(platform, 'instagram'),
  handle,
  followers,
  engagement_rate,
  avatar_url,
  bio,
  CASE WHEN handle IS NOT NULL THEN 'https://instagram.com/' || REPLACE(handle, '@', '') ELSE NULL END
FROM public.creators
WHERE handle IS NOT NULL
ON CONFLICT (creator_id, platform) DO NOTHING;