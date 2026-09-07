CREATE POLICY "Authenticated users can delete campaigns"
ON public.campaigns
FOR DELETE
TO authenticated
USING (true);