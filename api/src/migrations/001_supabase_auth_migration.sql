-- ============================================================================
-- MIGRATION: Supabase Auth Integration
-- Description: Migrate from custom password storage to Supabase Auth
-- ============================================================================

-- ============================================================================
-- PART 1: Add new columns to public.users
-- ============================================================================

-- Add status column for user account status
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));

-- Add last_active timestamp for tracking user activity
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

-- Add auth_user_id to link to Supabase Auth (will be populated during migration)
-- Note: We use auth_user_id instead of changing id to avoid breaking existing FKs
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for faster lookups by auth_user_id
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);

-- ============================================================================
-- PART 2: Add agency logo_url (optional enhancement)
-- ============================================================================

ALTER TABLE public.agencies 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ============================================================================
-- PART 3: Create audit_logs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- Index for querying by resource
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- PART 4: Handle password_hash column
-- ============================================================================
-- Recommendation: Keep password_hash column but mark as deprecated
-- This allows rollback if needed. Remove after successful migration.

COMMENT ON COLUMN public.users.password_hash IS 
'DEPRECATED: Migrated to Supabase Auth. Do not use. Remove after migration is confirmed.';

-- ============================================================================
-- PART 5: Create helper function to get/ensure user profile
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_or_create_user_profile(
    p_auth_user_id UUID,
    p_email TEXT DEFAULT NULL,
    p_full_name TEXT DEFAULT NULL,
    p_badge_number TEXT DEFAULT NULL,
    p_agency_id UUID DEFAULT NULL,
    p_role TEXT DEFAULT 'field_responder'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Try to get existing user by auth_user_id
    SELECT id INTO v_user_id 
    FROM public.users 
    WHERE auth_user_id = p_auth_user_id;
    
    IF v_user_id IS NOT NULL THEN
        -- Update last_active
        UPDATE public.users 
        SET last_active = NOW() 
        WHERE id = v_user_id;
        RETURN v_user_id;
    END IF;
    
    -- Try to find by email (for migration purposes)
    SELECT id INTO v_user_id 
    FROM public.users 
    WHERE email = p_email;
    
    IF v_user_id IS NOT NULL THEN
        -- Link existing user to auth
        UPDATE public.users 
        SET auth_user_id = p_auth_user_id,
            last_active = NOW()
        WHERE id = v_user_id;
        RETURN v_user_id;
    END IF;
    
    -- Create new user profile
    INSERT INTO public.users (
        auth_user_id,
        email,
        full_name,
        badge_number,
        agency_id,
        role,
        status,
        last_active
    ) VALUES (
        p_auth_user_id,
        p_email,
        p_full_name,
        p_badge_number,
        p_agency_id,
        p_role,
        'active',
        NOW()
    )
    RETURNING id INTO v_user_id;
    
    RETURN v_user_id;
END;
$$;

-- ============================================================================
-- PART 6: Create audit log function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}',
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id, action, resource_type, resource_id, 
        details, ip_address, user_agent
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id,
        p_details, p_ip_address, p_user_agent
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- ============================================================================
-- PART 7: Create trigger to auto-create profile on auth user creation
-- ============================================================================

-- Function to handle new auth user signup
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only create profile if not already exists
    INSERT INTO public.users (id, auth_user_id, email, full_name, status, last_active)
    VALUES (
        NEW.id, 
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'pending',
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$;

-- Trigger on auth.users (requires superuser to create)
-- Run this in Supabase SQL editor as superuser:
-- CREATE TRIGGER on_auth_user_created
--     AFTER INSERT ON auth.users
--     FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- PART 8: RLS Policies for audit_logs
-- ============================================================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
    ON public.audit_logs FOR SELECT
    USING (user_id = auth.uid());

-- Service role can do everything (for API)
CREATE POLICY "Service role full access on audit_logs"
    ON public.audit_logs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================================================
-- PART 9: Migration script to link existing users to Supabase Auth
-- ============================================================================
-- This should be run AFTER creating auth users for existing accounts
-- See the rollout plan for details

-- Example: Link existing user to auth user (run after creating auth user)
-- UPDATE public.users 
-- SET auth_user_id = '<auth-user-uuid>' 
-- WHERE email = 'user@example.com';

-- ============================================================================
-- PART 10: Grant necessary permissions
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- ROLLBACK SCRIPT (save separately for emergencies)
-- ============================================================================
/*
-- To rollback this migration:
ALTER TABLE public.users DROP COLUMN IF EXISTS status;
ALTER TABLE public.users DROP COLUMN IF EXISTS last_active;
ALTER TABLE public.users DROP COLUMN IF EXISTS auth_user_id;
DROP INDEX IF EXISTS idx_users_auth_user_id;
ALTER TABLE public.agencies DROP COLUMN IF EXISTS logo_url;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_user_profile(UUID, TEXT, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.log_audit(UUID, TEXT, TEXT, UUID, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.handle_new_auth_user();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
*/
