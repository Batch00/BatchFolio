-- Applied by hand in the Supabase SQL editor on 2026-11-13. Recorded here for history; do not re-run blindly.
--
-- Why: simplefin_connections.access_url is a standing read credential for the user's bank
-- balances and transactions. The old "simplefin: own data" policy granted the owner ALL on
-- the table through the client API, so any browser session could read or overwrite it.
-- After this change the browser roles can only read user_id, last_synced_at and
-- connection_errors on their own row. All writes and every access_url read go through
-- server routes and the nightly-snapshot Edge Function, which use the service role.

begin;

revoke all on table batchfolio.simplefin_connections from public, anon, authenticated;

grant select (user_id, last_synced_at, connection_errors)
  on table batchfolio.simplefin_connections to authenticated;

drop policy "simplefin: own data" on batchfolio.simplefin_connections;

create policy "simplefin: read own status"
  on batchfolio.simplefin_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
