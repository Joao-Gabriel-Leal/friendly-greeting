-- Add blocked column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS blocked boolean DEFAULT false;

-- Create table for specialty-specific blocks/suspensions
CREATE TABLE IF NOT EXISTS public.user_specialty_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  blocked_until TIMESTAMP WITH TIME ZONE,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE(user_id, specialty_id)
);

-- Enable RLS
ALTER TABLE public.user_specialty_blocks ENABLE ROW LEVEL SECURITY;

-- Policies for user_specialty_blocks
CREATE POLICY "Admins can manage specialty blocks"
ON public.user_specialty_blocks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view their own blocks"
ON public.user_specialty_blocks
FOR SELECT
USING (user_id = auth.uid());