
CREATE POLICY "Authenticated users can insert creators"
  ON public.creators FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update creators"
  ON public.creators FOR UPDATE
  TO authenticated
  USING (true);
