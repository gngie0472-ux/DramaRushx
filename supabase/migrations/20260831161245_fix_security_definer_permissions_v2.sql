/*
# Fix SECURITY DEFINER function execute permissions (second pass)

The default grant gives EXECUTE to PUBLIC which includes anon.
Revoke from PUBLIC first, then grant only to the roles that need it.

1. Security Changes
- handle_new_user: trigger function - revoke from PUBLIC, no direct grants needed (trigger runs as owner)
- get_user_coins: revoke from PUBLIC, grant to authenticated only
- unlock_episode: revoke from PUBLIC, grant to authenticated only
- has_active_subscription: revoke from PUBLIC, grant to authenticated only
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_coins() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unlock_episode(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_active_subscription() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_user_coins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_episode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated;
