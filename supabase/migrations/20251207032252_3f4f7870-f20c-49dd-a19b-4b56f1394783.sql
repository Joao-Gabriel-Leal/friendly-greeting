-- Add 'professional' role to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'professional';

-- Add user_id column to professionals table to link with auth users
ALTER TABLE public.professionals 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS password_temp text;

-- Add unique constraint on user_id for professionals
CREATE UNIQUE INDEX IF NOT EXISTS professionals_user_id_unique ON public.professionals(user_id) WHERE user_id IS NOT NULL;

-- Create a function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Add RLS policy for professionals to view their own appointments
CREATE POLICY "Professionals can view their own appointments"
ON public.appointments
FOR SELECT
USING (
  professional_id IN (
    SELECT id FROM public.professionals WHERE user_id = auth.uid()
  )
);

-- Add RLS policy for professionals to update their own appointments (for cancellation)
CREATE POLICY "Professionals can update their own appointments"
ON public.appointments
FOR UPDATE
USING (
  professional_id IN (
    SELECT id FROM public.professionals WHERE user_id = auth.uid()
  )
);