# Drafts and test history setup

Apply [feature10_11_drafts_attempt_history.sql](../supabase/feature10_11_drafts_attempt_history.sql) in the Supabase SQL editor after the existing schema and `feature3_test_snapshots.sql` migration.

It creates the account-owned `drafts` table, adds `taker_id` and `attempt_number` to `responses`, and installs the Row Level Security policy that lets authenticated users read only their own completed attempts.

Existing anonymous/public responses are preserved. New signed-in submissions are linked to the current authenticated Supabase user automatically; no user ID is accepted from the browser.
