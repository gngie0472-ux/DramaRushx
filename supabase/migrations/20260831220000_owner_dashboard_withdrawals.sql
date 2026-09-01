/* DramaRush owner-only financial dashboard and withdrawal requests. */

CREATE TABLE IF NOT EXISTS public.app_owner (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_owner ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_only_app_owner" ON public.app_owner;
CREATE POLICY "owner_only_app_owner" ON public.app_owner
  FOR ALL TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

/* Change admin checks from role-based to the single configured owner. */
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_owner
    WHERE owner_user_id = auth.uid()
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.revenue_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'USD',
  method text NOT NULL CHECK (method IN ('bank_transfer', 'paypal', 'other')),
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  provider_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.revenue_withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_read_withdrawals" ON public.revenue_withdrawals;
CREATE POLICY "owner_read_withdrawals" ON public.revenue_withdrawals
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "owner_create_withdrawal" ON public.revenue_withdrawals;
CREATE POLICY "owner_create_withdrawal" ON public.revenue_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND owner_user_id = auth.uid());
DROP POLICY IF EXISTS "owner_update_withdrawal" ON public.revenue_withdrawals;
CREATE POLICY "owner_update_withdrawal" ON public.revenue_withdrawals
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_revenue_withdrawals_status ON public.revenue_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_revenue_withdrawals_created ON public.revenue_withdrawals(created_at DESC);

/* Only the owner can change withdrawal status from the app. Actual money movement
   must be performed by a trusted payment provider/webhook; never put provider
   secret keys in the Expo app. */

-- IMPORTANT: after deployment, set the single owner explicitly in Supabase SQL:
-- INSERT INTO public.app_owner (owner_user_id) VALUES ('YOUR_AUTH_USER_UUID')
-- ON CONFLICT (id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id;
