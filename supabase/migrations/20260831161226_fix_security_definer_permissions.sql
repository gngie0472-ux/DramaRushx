/*
# Fix SECURITY DEFINER function execute permissions

1. Security Changes
- Revoke EXECUTE on `handle_new_user()` from anon and authenticated - this is a trigger function, should only be called by the trigger, not directly.
- Revoke EXECUTE on `get_user_coins()` from anon - only authenticated users should call this.
- Revoke EXECUTE on `unlock_episode(uuid)` from anon - only authenticated users should call this.
- Revoke EXECUTE on `has_active_subscription()` from anon - only authenticated users should call this.
- Keep EXECUTE on unlock_episode and has_active_subscription for authenticated role (already granted).
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_coins() FROM anon;
REVOKE EXECUTE ON FUNCTION public.unlock_episode(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription() FROM anon;
