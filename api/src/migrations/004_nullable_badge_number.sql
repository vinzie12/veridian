-- ============================================================================
-- MIGRATION: Make badge_number nullable and add citizen role
-- ============================================================================

-- Make badge_number nullable (citizens don't have badge numbers)
ALTER TABLE public.users ALTER COLUMN badge_number DROP NOT NULL;

-- Add 'citizen' to role check constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('super_admin', 'agency_admin', 'commander', 'dispatcher', 'field_responder', 'citizen'));

-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
-- Revert to NOT NULL (if needed)
ALTER TABLE public.users ALTER COLUMN badge_number SET NOT NULL;

-- Revert role constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role IN ('super_admin', 'agency_admin', 'commander', 'dispatcher', 'field_responder'));
*/
