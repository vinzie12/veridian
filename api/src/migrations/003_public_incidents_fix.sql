-- ============================================================================
-- MIGRATION: Allow public incident reporting (anonymous citizens)
-- ============================================================================

-- Make agency_id nullable for public incidents
ALTER TABLE public.incidents ALTER COLUMN agency_id DROP NOT NULL;

-- Make reporter_id nullable for anonymous reports
ALTER TABLE public.incidents ALTER COLUMN reporter_id DROP NOT NULL;

-- Add 'pending_review' to status check constraint
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS incidents_status_check;
ALTER TABLE public.incidents ADD CONSTRAINT incidents_status_check 
CHECK (status IN ('pending', 'pending_review', 'acknowledged', 'en_route', 'on_scene', 'resolved', 'closed', 'cancelled'));

-- Add RLS policy to allow service role to insert public incidents
DROP POLICY IF EXISTS "incidents_public_insert" ON public.incidents;
CREATE POLICY "incidents_public_insert"
ON public.incidents
FOR INSERT
WITH CHECK (agency_id IS NULL AND reporter_id IS NULL);

-- Add RLS policy to allow reading public incidents (for tracking)
DROP POLICY IF EXISTS "incidents_public_read" ON public.incidents;
CREATE POLICY "incidents_public_read"
ON public.incidents
FOR SELECT
USING (agency_id IS NULL);

-- Add index for public incident lookups
CREATE INDEX IF NOT EXISTS idx_incidents_public
ON public.incidents ((extra_fields->>'source'))
WHERE agency_id IS NULL;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
-- Revert nullable changes (if needed)
ALTER TABLE public.incidents ALTER COLUMN agency_id SET NOT NULL;
ALTER TABLE public.incidents ALTER COLUMN reporter_id SET NOT NULL;

-- Drop policies
DROP POLICY IF EXISTS "incidents_public_insert" ON public.incidents;
DROP POLICY IF EXISTS "incidents_public_read" ON public.incidents;

-- Drop index
DROP INDEX IF EXISTS idx_incidents_public;
*/