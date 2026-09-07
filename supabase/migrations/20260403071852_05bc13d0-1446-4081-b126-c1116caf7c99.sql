
-- Add user_id to creators table to link to auth accounts
ALTER TABLE public.creators ADD COLUMN IF NOT EXISTS user_id UUID;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_creators_user_id ON public.creators(user_id);

-- Policy: creators can view their own record
CREATE POLICY "Creators can view own record"
  ON public.creators FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
