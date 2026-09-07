ALTER TABLE public.creators
  ADD COLUMN IF NOT EXISTS virlo_tracking_id text,
  ADD COLUMN IF NOT EXISTS virlo_tracking_platform text,
  ADD COLUMN IF NOT EXISTS virlo_tracking_status text;