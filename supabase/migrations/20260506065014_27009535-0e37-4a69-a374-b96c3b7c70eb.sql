CREATE TABLE public.comet_niches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  virlo_comet_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  platforms TEXT[] NOT NULL DEFAULT '{}',
  cadence TEXT NOT NULL DEFAULT 'weekly',
  min_views INTEGER NOT NULL DEFAULT 10000,
  time_range TEXT NOT NULL DEFAULT 'this_week',
  is_active BOOLEAN NOT NULL DEFAULT true,
  intent TEXT,
  created_by UUID,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.comet_niches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view niches"
ON public.comet_niches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert niches"
ON public.comet_niches FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update niches"
ON public.comet_niches FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete niches"
ON public.comet_niches FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_comet_niches_updated_at
BEFORE UPDATE ON public.comet_niches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();