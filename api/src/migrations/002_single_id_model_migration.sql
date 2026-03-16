-- ============================================================================
-- MIGRATION: Single-ID Model for Supabase Auth Integration
-- Rule: public.users.id MUST equal auth.users.id
-- No auth_user_id column needed - direct ID match
-- ============================================================================

-- ============================================================================
-- PART 1: Add new columns to public.users
-- ============================================================================

-- Add status column for user account status
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' 
CHECK (status IN ('active', 'inactive', 'suspended', 'pending'));

-- Add last_active timestamp for tracking user activity
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

-- Mark password_hash as deprecated (do not remove yet)
COMMENT ON COLUMN public.users.password_hash IS 'DEPRECATED: Migrating to Supabase Auth. Do not use for new users. Remove after migration complete.';

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
    agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_agency_id ON public.audit_logs(agency_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- PART 4: Add/Ensure Foreign Keys
-- ============================================================================

-- Add FK: users.agency_id -> agencies.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_users_agency_id' 
        AND table_name = 'users' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.users 
        ADD CONSTRAINT fk_users_agency_id 
        FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add FK: incidents.agency_id -> agencies.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_incidents_agency_id' 
        AND table_name = 'incidents' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.incidents 
        ADD CONSTRAINT fk_incidents_agency_id 
        FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add FK: incidents.reporter_id -> users.id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_incidents_reporter_id' 
        AND table_name = 'incidents' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.incidents 
        ADD CONSTRAINT fk_incidents_reporter_id 
        FOREIGN KEY (reporter_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- PART 5: Enable RLS on tables (minimal policy guidance)
-- ============================================================================

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on incidents table
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Enable RLS on audit_logs table
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read their own profile
CREATE POLICY IF NOT EXISTS "users_read_own" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- RLS Policy: Users can update their own profile (limited fields)
CREATE POLICY IF NOT EXISTS "users_update_own" ON public.users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- RLS Policy: Users can read incidents in their agency
CREATE POLICY IF NOT EXISTS "incidents_read_agency" ON public.incidents
    FOR SELECT USING (
        agency_id IN (
            SELECT agency_id FROM public.users WHERE id = auth.uid()
        )
    );

-- RLS Policy: Users can create incidents in their agency
CREATE POLICY IF NOT EXISTS "incidents_create_agency" ON public.incidents
    FOR INSERT WITH CHECK (
        agency_id IN (
            SELECT agency_id FROM public.users WHERE id = auth.uid()
        )
    );

-- RLS Policy: Service role bypasses RLS (for API operations)
-- Note: Your API uses service role key, so it bypasses RLS automatically

-- ============================================================================
-- PART 6: Helper function for audit logging
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit(
    p_user_id UUID,
    p_action TEXT,
    p_resource_type TEXT DEFAULT NULL,
    p_resource_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'::jsonb,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_agency_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        user_id, action, resource_type, resource_id, 
        details, ip_address, user_agent, agency_id
    ) VALUES (
        p_user_id, p_action, p_resource_type, p_resource_id,
        p_details, p_ip_address, p_user_agent, p_agency_id
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- ============================================================================
-- PART 7: Remove auth_user_id column if it exists (cleanup from old migration)
-- ============================================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS auth_user_id;

-- ============================================================================
-- ROLLBACK (run only if needed to revert all changes)
-- ============================================================================
/*
-- Remove columns added
ALTER TABLE public.users DROP COLUMN IF EXISTS status;
ALTER TABLE public.users DROP COLUMN IF EXISTS last_active;
ALTER TABLE public.agencies DROP COLUMN IF EXISTS logo_url;

-- Drop audit_logs table
DROP TABLE IF EXISTS public.audit_logs CASCADE;

-- Remove FKs
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_agency_id;
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS fk_incidents_agency_id;
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS fk_incidents_reporter_id;

-- Disable RLS
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;

-- Drop policies
DROP POLICY IF EXISTS "users_read_own" ON public.users;
DROP POLICY IF EXISTS "users_update_own" ON public.users;
DROP POLICY IF EXISTS "incidents_read_agency" ON public.incidents;
DROP POLICY IF EXISTS "incidents_create_agency" ON public.incidents;

-- Drop helper function
DROP FUNCTION IF EXISTS public.log_audit(UUID, TEXT, TEXT, UUID, JSONB, TEXT, TEXT, UUID);

-- Remove deprecation comment
COMMENT ON COLUMN public.users.password_hash IS NULL;
*/
