
CREATE TABLE public.creator_collaborations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  brand_name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram',
  post_url TEXT,
  post_date TIMESTAMP WITH TIME ZONE,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  collaboration_type TEXT DEFAULT 'sponsored',
  image_url TEXT,
  caption TEXT,
  shortcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(creator_id, shortcode)
);

ALTER TABLE public.creator_collaborations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view collaborations"
  ON public.creator_collaborations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert collaborations"
  ON public.creator_collaborations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update collaborations"
  ON public.creator_collaborations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete collaborations"
  ON public.creator_collaborations FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_creator_collaborations_updated_at
  BEFORE UPDATE ON public.creator_collaborations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
