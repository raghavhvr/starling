
-- CREATORS TABLE
CREATE TABLE public.creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT,
  platform TEXT DEFAULT 'instagram',
  brand TEXT,
  cluster TEXT,
  country TEXT,
  followers INTEGER DEFAULT 0,
  engagement_rate NUMERIC(5,2) DEFAULT 0,
  roi NUMERIC(5,2) DEFAULT 0,
  soi_score INTEGER DEFAULT 0,
  cpv NUMERIC(8,4) DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  avatar_url TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view creators"
  ON public.creators FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_creators_updated_at
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CAMPAIGNS TABLE
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  cluster TEXT,
  status TEXT DEFAULT 'draft',
  budget NUMERIC(12,2) DEFAULT 0,
  spent NUMERIC(12,2) DEFAULT 0,
  start_date DATE,
  end_date DATE,
  description TEXT,
  step INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaigns"
  ON public.campaigns FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- TRENDS TABLE
CREATE TABLE public.trends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  relevance_score INTEGER DEFAULT 0,
  source TEXT,
  brand TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view trends"
  ON public.trends FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_trends_updated_at
  BEFORE UPDATE ON public.trends
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FINANCIAL DATA TABLE
CREATE TABLE public.financial_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL,
  cluster TEXT,
  category TEXT,
  amount NUMERIC(12,2) DEFAULT 0,
  period TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view financial data"
  ON public.financial_data FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER update_financial_data_updated_at
  BEFORE UPDATE ON public.financial_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
