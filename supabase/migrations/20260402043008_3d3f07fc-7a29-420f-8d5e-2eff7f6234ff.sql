-- Add workflow fields to campaigns
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS objective text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS kpis text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS deliverables text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS markets text[];
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS age_range text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS demographics text;

-- Allow authenticated users to insert campaigns
CREATE POLICY "Authenticated users can insert campaigns"
ON public.campaigns
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to update campaigns
CREATE POLICY "Authenticated users can update campaigns"
ON public.campaigns
FOR UPDATE
TO authenticated
USING (true);