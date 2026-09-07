
CREATE POLICY "Authenticated users can delete creators"
ON public.creators
FOR DELETE
TO authenticated
USING (true);
