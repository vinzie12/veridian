-- ============================================================================
-- MIGRATION: Incident Types Table with Dynamic Management
-- Version: 004
-- Description: Creates incident_types table, migrates incidents.incident_type 
--              to FK relationship, and adds RLS policies
-- ============================================================================

-- ============================================================================
-- PART 1: Create incident_types table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.incident_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    color_code TEXT DEFAULT '#666666',
    icon TEXT DEFAULT '⚠️',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_incident_types_name ON public.incident_types(name);
CREATE INDEX IF NOT EXISTS idx_incident_types_active ON public.incident_types(is_active);

-- ============================================================================
-- PART 2: Seed incident_types with common types
-- ============================================================================

INSERT INTO public.incident_types (name, description, color_code, icon, sort_order) VALUES
    ('fire', 'Fire-related emergencies including wildfires, structure fires, vehicle fires', '#FF3300', '🔥', 1),
    ('medical', 'Medical emergencies requiring EMS response', '#0066FF', '🏥', 2),
    ('police', 'Law enforcement situations including crimes, threats, disturbances', '#0044CC', '🚨', 3),
    ('flood', 'Flooding events including flash floods, river overflow', '#0099FF', '🌊', 4),
    ('accident', 'Traffic accidents, vehicle collisions, transportation incidents', '#FFAA00', '🚗', 5),
    ('rescue', 'Search and rescue operations, trapped individuals', '#FF6600', '🚁', 6),
    ('hazard', 'Hazardous materials, chemical spills, gas leaks', '#FF00FF', '☢️', 7),
    ('natural_disaster', 'Earthquakes, typhoons, volcanic activity', '#8B4513', '🌋', 8),
    ('infrastructure', 'Power outages, water main breaks, road damage', '#666666', '🏗️', 9),
    ('other', 'Other emergency situations not categorized', '#888888', '📋', 99)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PART 3: Add incident_type_id FK column to incidents
-- ============================================================================

-- Make old incident_type column nullable (for migration)
ALTER TABLE public.incidents 
ALTER COLUMN incident_type DROP NOT NULL;

-- Add the new column (nullable for migration)
ALTER TABLE public.incidents 
ADD COLUMN IF NOT EXISTS incident_type_id UUID REFERENCES public.incident_types(id);

-- Create index for FK lookups
CREATE INDEX IF NOT EXISTS idx_incidents_type_id ON public.incidents(incident_type_id);

-- ============================================================================
-- PART 4: Migrate existing incident_type text data to incident_type_id
-- ============================================================================

-- Update incident_type_id based on existing text values
UPDATE public.incidents i
SET incident_type_id = it.id
FROM public.incident_types it
WHERE LOWER(i.incident_type) = LOWER(it.name)
AND i.incident_type_id IS NULL;

-- Handle any unmapped types by setting to 'other'
UPDATE public.incidents i
SET incident_type_id = (SELECT id FROM public.incident_types WHERE name = 'other' LIMIT 1)
WHERE i.incident_type_id IS NULL 
AND i.incident_type IS NOT NULL;

-- ============================================================================
-- PART 5: Add FK constraint (with ON DELETE SET NULL for flexibility)
-- ============================================================================

-- Add foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_incidents_incident_type_id' 
        AND table_name = 'incidents' AND table_schema = 'public'
    ) THEN
        ALTER TABLE public.incidents 
        ADD CONSTRAINT fk_incidents_incident_type_id 
        FOREIGN KEY (incident_type_id) REFERENCES public.incident_types(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- PART 6: Enable RLS on incident_types table
-- ============================================================================

ALTER TABLE public.incident_types ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read incident types
CREATE POLICY IF NOT EXISTS "incident_types_read_authenticated" ON public.incident_types
    FOR SELECT
    USING (auth.role() = 'authenticated' OR auth.role() = 'anon');

-- Policy: Only admins can insert incident types
CREATE POLICY IF NOT EXISTS "incident_types_insert_admin" ON public.incident_types
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'agency_admin')
        )
    );

-- Policy: Only admins can update incident types
CREATE POLICY IF NOT EXISTS "incident_types_update_admin" ON public.incident_types
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'agency_admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role IN ('super_admin', 'agency_admin')
        )
    );

-- Policy: Only super_admin can delete incident types
CREATE POLICY IF NOT EXISTS "incident_types_delete_superadmin" ON public.incident_types
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- ============================================================================
-- PART 7: Add trigger for updated_at timestamp
-- ============================================================================

-- Create update timestamp function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to incident_types
DROP TRIGGER IF EXISTS update_incident_types_updated_at ON public.incident_types;
CREATE TRIGGER update_incident_types_updated_at
    BEFORE UPDATE ON public.incident_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PART 8: Verification queries (run manually to verify migration)
-- ============================================================================

-- Check migration status:
-- SELECT 
--     COUNT(*) as total_incidents,
--     COUNT(incident_type_id) as with_type_id,
--     COUNT(incident_type) as with_text_type
-- FROM public.incidents;

-- Check incident types seeded:
-- SELECT * FROM public.incident_types ORDER BY sort_order;

-- ============================================================================
-- PART 9: Drop old incident_type column (RUN AFTER VERIFICATION)
-- ============================================================================

-- Uncomment and run AFTER verifying data migration is complete:
-- ALTER TABLE public.incidents DROP COLUMN IF EXISTS incident_type;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
/*
-- Remove trigger
DROP TRIGGER IF EXISTS update_incident_types_updated_at ON public.incident_types;

-- Drop RLS policies
DROP POLICY IF EXISTS "incident_types_read_authenticated" ON public.incident_types;
DROP POLICY IF EXISTS "incident_types_insert_admin" ON public.incident_types;
DROP POLICY IF EXISTS "incident_types_update_admin" ON public.incident_types;
DROP POLICY IF EXISTS "incident_types_delete_superadmin" ON public.incident_types;

-- Disable RLS
ALTER TABLE public.incident_types DISABLE ROW LEVEL SECURITY;

-- Drop FK constraint
ALTER TABLE public.incidents DROP CONSTRAINT IF EXISTS fk_incidents_incident_type_id;

-- Drop index
DROP INDEX IF EXISTS idx_incidents_type_id;

-- Remove incident_type_id column
ALTER TABLE public.incidents DROP COLUMN IF EXISTS incident_type_id;

-- Drop indexes on incident_types
DROP INDEX IF EXISTS idx_incident_types_name;
DROP INDEX IF EXISTS idx_incident_types_active;

-- Drop incident_types table
DROP TABLE IF EXISTS public.incident_types;
*/
