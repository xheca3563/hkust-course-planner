-- CoursePlanner Supabase Database Schema
-- Copy and paste this entire script into Supabase SQL Editor (https://supabase.com/dashboard)
-- Run all at once — order matters.

-- ── Profiles ──
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Saved Timetables ──
CREATE TABLE saved_timetables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled',
  courses JSONB NOT NULL DEFAULT '[]',
  selections JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Saved Favorites (smart mode schedules) ──
CREATE TABLE saved_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  schedule_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── User Preferences / Constraints ──
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  constraints JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Auto-create profile on signup ──
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Row Level Security (RLS) ──
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_timetables ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Timetables: separate policies for each operation (WITH CHECK needed for INSERT)
CREATE POLICY "timetables_select" ON saved_timetables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "timetables_insert" ON saved_timetables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "timetables_update" ON saved_timetables FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "timetables_delete" ON saved_timetables FOR DELETE USING (auth.uid() = user_id);

-- Favorites
CREATE POLICY "favorites_select" ON saved_favorites FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "favorites_insert" ON saved_favorites FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_update" ON saved_favorites FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "favorites_delete" ON saved_favorites FOR DELETE USING (auth.uid() = user_id);

-- Preferences
CREATE POLICY "prefs_select" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prefs_insert" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs_update" ON user_preferences FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prefs_delete" ON user_preferences FOR DELETE USING (auth.uid() = user_id);

-- Grant table access to authenticated users (required in addition to RLS)
GRANT ALL ON profiles TO authenticated;
GRANT ALL ON saved_timetables TO authenticated;
GRANT ALL ON saved_favorites TO authenticated;
GRANT ALL ON user_preferences TO authenticated;
