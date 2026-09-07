
-- Campaign creators join table
CREATE TABLE public.campaign_creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.creators(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited',
  fee NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, creator_id)
);

ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign creators" ON public.campaign_creators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert campaign creators" ON public.campaign_creators FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update campaign creators" ON public.campaign_creators FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete campaign creators" ON public.campaign_creators FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_campaign_creators_updated_at BEFORE UPDATE ON public.campaign_creators FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign deliverables table
CREATE TABLE public.campaign_deliverables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_creator_id UUID NOT NULL REFERENCES public.campaign_creators(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'ig_post',
  description TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaign deliverables" ON public.campaign_deliverables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert campaign deliverables" ON public.campaign_deliverables FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update campaign deliverables" ON public.campaign_deliverables FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete campaign deliverables" ON public.campaign_deliverables FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_campaign_deliverables_updated_at BEFORE UPDATE ON public.campaign_deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
