-- Add UPDATE policy for sales table
CREATE POLICY "Users can update their own sales" 
ON public.sales 
FOR UPDATE 
USING (auth.uid() = user_id);