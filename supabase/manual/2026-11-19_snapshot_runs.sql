-- Written 2026-11-19. Run by hand in the Supabase SQL editor before deploying the
-- nightly-snapshot change from the same date. Recorded here for history; do not re-run blindly.
--
-- Why: the 2026-11-18 nightly run was killed mid-sync and wrote no snapshots, and nothing
-- recorded that it had started or how far it got. nightly-snapshot now inserts a row here
-- when it starts and updates it when it finishes, so a run with started_at but no
-- finished_at is one that was killed. The table holds run counts only, no user data.
-- RLS is on with no policies, so only the service role (which bypasses RLS) can use it.

begin;

create table if not exists batchfolio.snapshot_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz,
  finished_at      timestamptz,
  run_date         date,
  processed        int,
  skipped          int,
  failed           int,
  budget_exceeded  int,
  duration_ms      int,
  finnhub_calls    int,
  notes            text
);

alter table batchfolio.snapshot_runs enable row level security;

revoke all on table batchfolio.snapshot_runs from public, anon, authenticated;

commit;
