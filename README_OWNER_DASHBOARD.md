# DramaRush — Owner Dashboard

The Admin area is now **owner-only** at the database level. The old `profiles.role = 'admin'` flag is no longer sufficient to enter the private dashboard after the owner migration is applied.

## 1. Set the owner once

1. Create/sign in to your personal account in Supabase Auth.
2. Copy that account's Auth user UUID.
3. Run the final migration `supabase/migrations/20260831220000_owner_dashboard_withdrawals.sql`.
4. In Supabase SQL Editor run:

```sql
INSERT INTO public.app_owner (owner_user_id)
VALUES ('YOUR_AUTH_USER_UUID')
ON CONFLICT (id) DO UPDATE SET owner_user_id = EXCLUDED.owner_user_id;
```

Replace `YOUR_AUTH_USER_UUID` with your own Auth UUID.

After that, only that UUID can access the owner dashboard and financial data through the app's authenticated Supabase policies.

## 2. Dashboard

The private dashboard shows:

- total users
- total episode views
- most watched series
- most watched episodes
- coins sold
- gross revenue from completed `purchase` transactions
- already paid withdrawals
- pending withdrawals
- amount currently available to withdraw

The view total is based on episode views so it is not double-counted against the series aggregate counter.

## 3. Withdrawals

The app can create a withdrawal request containing amount, method, and destination. The database prevents users from creating or reading these records.

**Important:** creating a withdrawal request is not the same as moving money. Actual bank/PayPal transfer must be performed by a trusted payment provider/server-side integration. Provider secret keys must never be placed in the Expo app.
