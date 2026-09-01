/*
# DramaRush Core Schema - Categories, Series, Episodes

1. New Tables
- `categories`: Drama genre categories (Romance, Thriller, Family, etc.)
  - id (uuid, PK)
  - name (text, unique, not null) - category display name
  - slug (text, unique, not null) - URL-friendly identifier
  - image_url (text) - category cover image
  - sort_order (int, default 0) - display ordering
  - created_at (timestamptz)

- `series`: Drama series/shows
  - id (uuid, PK)
  - title (text, not null) - series name
  - description (text) - series synopsis
  - cover_image_url (text) - poster/cover image
  - banner_image_url (text) - large banner image for featured display
  - category_id (uuid, FK -> categories) - primary category
  - rating (numeric, default 0) - user rating 0-10
  - total_episodes (int, default 0) - total episode count
  - status (text, default 'ongoing') - 'ongoing' | 'completed'
  - is_featured (boolean, default false) - show in featured banner
  - is_free (boolean, default false) - entire series free
  - sort_order (int, default 0) - display ordering
  - view_count (bigint, default 0) - total views across episodes
  - created_at (timestamptz)

- `episodes`: Individual episodes belonging to a series
  - id (uuid, PK)
  - series_id (uuid, FK -> series, ON DELETE CASCADE)
  - episode_number (int, not null) - sequential episode number
  - title (text, not null) - episode title
  - description (text) - episode synopsis
  - thumbnail_url (text) - episode thumbnail image
  - video_url (text, not null) - video URL from Storage/CDN
  - duration (int, default 0) - duration in seconds
  - is_free (boolean, default false) - episode is free to watch
  - coin_price (int, default 0) - coins required to unlock
  - view_count (bigint, default 0) - total views
  - created_at (timestamptz)

2. Indexes
- series: category_id, status, is_featured, sort_order, created_at, view_count
- episodes: series_id, episode_number

3. Security
- Enable RLS on all three tables.
- Public read access (anon + authenticated) for categories, series, episodes - content is publicly browsable.
- No public write access - all writes go through admin role / edge functions.
*/

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  cover_image_url text,
  banner_image_url text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  rating numeric(3,1) NOT NULL DEFAULT 0,
  total_episodes int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
  is_featured boolean NOT NULL DEFAULT false,
  is_free boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  view_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  episode_number int NOT NULL,
  title text NOT NULL,
  description text,
  thumbnail_url text,
  video_url text NOT NULL,
  duration int NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  coin_price int NOT NULL DEFAULT 0,
  view_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(series_id, episode_number)
);

CREATE INDEX IF NOT EXISTS idx_series_category ON series(category_id);
CREATE INDEX IF NOT EXISTS idx_series_status ON series(status);
CREATE INDEX IF NOT EXISTS idx_series_featured ON series(is_featured);
CREATE INDEX IF NOT EXISTS idx_series_sort ON series(sort_order);
CREATE INDEX IF NOT EXISTS idx_series_created ON series(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_series_views ON series(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_episodes_series ON episodes(series_id);
CREATE INDEX IF NOT EXISTS idx_episodes_number ON episodes(series_id, episode_number);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_categories" ON categories;
CREATE POLICY "public_read_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_series" ON series;
CREATE POLICY "public_read_series" ON series FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_episodes" ON episodes;
CREATE POLICY "public_read_episodes" ON episodes FOR SELECT
  TO anon, authenticated USING (true);
