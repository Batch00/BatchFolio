-- Written 2026-11-23. Run by hand in the Supabase SQL editor. Recorded here for history;
-- do not re-run blindly (cron.schedule with an existing job name replaces that job).
--
-- Why: on 2026-11-23 the 23:00 UTC nightly-snapshot run gave up on SimpleFIN after 60s
-- before it returned any accounts, so the snapshot was written from the day before's data.
-- The sync budget is now 100s, and this second job runs the same function at 23:30 UTC.
-- If the 23:00 run synced, the retry sees a sync from under an hour ago and only rewrites
-- the snapshot; if the 23:00 run timed out, the retry does the sync.
--
-- The command is copied from the existing nightly-snapshot job so the x-cron-secret value
-- stays in the database and is never written into this file.

select cron.schedule(
  'nightly-snapshot-retry',
  '30 23 * * *',
  (select command from cron.job
   where command ilike '%nightly-snapshot%'
     and jobname is distinct from 'nightly-snapshot-retry'
   limit 1)
);
