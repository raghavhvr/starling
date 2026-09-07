
CREATE TABLE public.creator_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  image_url TEXT,
  caption TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  post_date TIMESTAMP WITH TIME ZONE,
  instagram_url TEXT,
  shortcode TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view posts"
  ON public.creator_posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert posts"
  ON public.creator_posts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX idx_creator_posts_creator_id ON public.creator_posts(creator_id);
