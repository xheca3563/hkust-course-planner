-- P3: Extend profiles table for graduation requirement tracking
-- Run this in Supabase SQL editor against your project

-- Add academic profile columns (safe ALTER TABLE — uses IF NOT EXISTS pattern)
DO $$
BEGIN
    -- Major code (e.g. 'MAEC', 'COMP')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'major'
    ) THEN
        ALTER TABLE profiles ADD COLUMN major TEXT;
    END IF;

    -- Extended major code (e.g. 'EXTM-AI', 'EXTM-DMCA')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'extended_major'
    ) THEN
        ALTER TABLE profiles ADD COLUMN extended_major TEXT;
    END IF;

    -- Minor code (e.g. 'MATH', 'IT')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'minor'
    ) THEN
        ALTER TABLE profiles ADD COLUMN minor TEXT;
    END IF;

    -- School (e.g. 'SSCI', 'SENG', 'SBM', 'SHSS')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'school'
    ) THEN
        ALTER TABLE profiles ADD COLUMN school TEXT;
    END IF;

    -- Admission year (e.g. '2024-25')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'admission_year'
    ) THEN
        ALTER TABLE profiles ADD COLUMN admission_year TEXT;
    END IF;

    -- Completed course codes (e.g. ARRAY['MATH 1013', 'COMP 1021'])
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'completed_courses'
    ) THEN
        ALTER TABLE profiles ADD COLUMN completed_courses TEXT[] DEFAULT '{}';
    END IF;

    -- Additional credits from AP/transfer (defaults to 0)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'credits_adjustment'
    ) THEN
        ALTER TABLE profiles ADD COLUMN credits_adjustment INTEGER DEFAULT 0;
    END IF;

    -- Track/option name for programs split into tracks (e.g. MATH, PHYS)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'track'
    ) THEN
        ALTER TABLE profiles ADD COLUMN track TEXT;
    END IF;

    -- Track last update time
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Ensure RLS allows users to read/write their own profile fields
-- (profiles table should already have RLS enabled from initial setup)
-- If not, uncomment:
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Upsert policy: users can update their own row
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Insert policy: lets the client create the row if it does not exist yet
-- (saveProfile falls back to INSERT when UPDATE affects 0 rows)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Select policy: users can read their own row
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);
