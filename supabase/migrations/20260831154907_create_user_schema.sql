/*
# DramaRush User Schema - Profiles, Favorites, History, Coins, Subscriptions

1. New Tables
- `profiles`: Extended user data linked to auth.users
  - id (uuid, PK, FK -> auth.users, ON DELETE CASCADE)
  - name (text, not null) - display name
  - avatar_url (text) - profile avatar image
  - coins (int, default 0) - virtual currency balance
  - role (text, default 'user') - 'user' | 'admin'
  - created_at (timestamptz)

- `favorites`: User's favorite series
  - id (uuid, PK)
  - user_id (uuid, FK -> auth.users, ON DELETE CASCADE)
  - series_id (uuid, FK -> series, ON DELETE CASCADE)
  - created_at (timestamptz)
  - UNIQUE(user_id, series_id)

- `watch_history`: User viewing progress per episode
  - id (uuid, PK)
  - user_id (uuid, FK -> auth.users, ON DELETE CASCADE)
  - series_id (uuid, FK -> series, ON DELETE CASCADE)
  - episode_id (uuid, FK -> episodes, ON DELETE CASCADE)
  - position (int, default 0) - last watched position in seconds
  - duration (int, default 0) - episode duration at time of watch
  - watched_at (timestamptz) - last watch timestamp
  - UNIQUE(user_id, episode_id)

- `unlocked_episodes`: Episodes a user has unlocked with coins
  - id (uuid, PK)
  - user_id (uuid, FK -> auth.users, ON DELETE CASCADE)
  - episode_id (uuid, FK -> episodes, ON DELETE CASCADE)
  - unlocked_at (timestamptz)
  - UNIQUE(user_id, episode_id)

- `transactions`: Coin transaction log
  - id (uuid, PK)
  - user_id (uuid, FK -> auth.users, ON DELETE CASCADE)
  - type (text, not null) - 'purchase' | 'spend' | 'refund' | 'reward'
  - amount (numeric, default 0) - monetary amount (for purchases)
  - coins (int, not null) - coins gained (positive) or spent (negative)
  - status (text, default 'completed') - 'pending' | 'completed' | 'failed'
  - description (text) - transaction description
  - reference_id (text) - external reference (e.g. Google Play order ID)
  - created_at (timestamptz)

- `subscriptions`: User subscription state
  - id (uuid, PK)
  - user_id (uuid, FK -> auth.users, ON DELETE CASCADE)
  - plan (text, not null) - 'monthly' | 'yearly'
  - status (text, not null) - 'active' | 'expired' | 'cancelled'
  - start_date (timestamptz, not null)
  - expiry_date (timestamptz, not null)
  - reference_id (text) - external billing reference
  - created_at (timestamptz)
  - UNIQUE(user_id)

2. Indexes
- favorites: user_id, series_id
- watch_history: user_id, watched_at
- unlocked_episodes: user_id, episode_id
- transactions: user_id, created_at
- subscriptions: user_id, status

3. Security
- Enable RLS on all tables.
- profiles: user can read/update own profile; role column is NOT client-writable (protected via column-level privilege).
- favorites, watch_history, unlocked_episodes: owner-scoped CRUD (user_id defaults to auth.uid()).
- transactions: user can read own; inserts only via admin/edge function (no direct user insert).
- subscriptions: user can read own; writes only via admin/edge function.
- profiles.role has column-level privilege: users can NOT update the role column.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  avatar_url text,
  coins int NOT NULL DEFAULT 0,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, series_id)
);

CREATE TABLE IF NOT EXISTS watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  series_id uuid NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  duration int NOT NULL DEFAULT 0,
  watched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, episode_id)
);

CREATE TABLE IF NOT EXISTS unlocked_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  episode_id uuid NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, episode_id)
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('purchase', 'spend', 'refund', 'reward')),
  amount numeric(10,2) NOT NULL DEFAULT 0,
  coins int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  description text,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  status text NOT NULL CHECK (status IN ('active', 'expired', 'cancelled')),
  start_date timestamptz NOT NULL,
  expiry_date timestamptz NOT NULL,
  reference_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_series ON favorites(series_id);
CREATE INDEX IF NOT EXISTS idx_watch_user ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_watched ON watch_history(watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_unlocked_user ON unlocked_episodes(user_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_episode ON unlocked_episodes(episode_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlocked_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- profiles: user reads own, updates own (but NOT the role column - enforced via column privilege below)
DROP POLICY IF EXISTS "read_own_profile" ON profiles;
CREATE POLICY "read_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- favorites: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_favorites" ON favorites;
CREATE POLICY "select_own_favorites" ON favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_favorites" ON favorites;
CREATE POLICY "insert_own_favorites" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_favorites" ON favorites;
CREATE POLICY "delete_own_favorites" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- watch_history: owner-scoped CRUD
DROP POLICY IF EXISTS "select_own_history" ON watch_history;
CREATE POLICY "select_own_history" ON watch_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_history" ON watch_history;
CREATE POLICY "insert_own_history" ON watch_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_history" ON watch_history;
CREATE POLICY "update_own_history" ON watch_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_history" ON watch_history;
CREATE POLICY "delete_own_history" ON watch_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- unlocked_episodes: user can read own unlocks (inserts happen via edge function / admin)
DROP POLICY IF EXISTS "select_own_unlocks" ON unlocked_episodes;
CREATE POLICY "select_own_unlocks" ON unlocked_episodes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- transactions: user can read own only (no direct user insert/update)
DROP POLICY IF EXISTS "select_own_transactions" ON transactions;
CREATE POLICY "select_own_transactions" ON transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- subscriptions: user can read own only
DROP POLICY IF EXISTS "select_own_subscription" ON subscriptions;
CREATE POLICY "select_own_subscription" ON subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- Column-level privilege: prevent users from updating the role column
-- Only the service role / superuser can set role. Revoke update on the column from authenticated and anon.
REVOKE UPDATE (role) ON profiles FROM authenticated, anon;
