-- Create table for specialty-specific blocks
CREATE TABLE public.user_specialty_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  blocked_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, specialty)
);

-- Enable RLS
ALTER TABLE public.user_specialty_blocks ENABLE ROW LEVEL SECURITY;

-- Admin can manage all blocks
CREATE POLICY "Admins can manage specialty blocks"
ON public.user_specialty_blocks
FOR ALL
USING (get_user_role(auth.uid()) = 'admin');

-- Users can view their own blocks
CREATE POLICY "Users can view own specialty blocks"
ON public.user_specialty_blocks
FOR SELECT
USING (auth.uid() = user_id);