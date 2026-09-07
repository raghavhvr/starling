CREATE TABLE public.campaign_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_activities_campaign ON public.campaign_activities(campaign_id);

ALTER TABLE public.campaign_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign activities"
ON public.campaign_activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert campaign activities"
ON public.campaign_activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update campaign activities"
ON public.campaign_activities FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete campaign activities"
ON public.campaign_activities FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_campaign_activities_updated_at
BEFORE UPDATE ON public.campaign_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();