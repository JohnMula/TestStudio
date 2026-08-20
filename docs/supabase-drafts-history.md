# Drafts and test history setup

Apply [feature10_11_drafts_attempt_history.sql](../supabase/feature10_11_drafts_attempt_history.sql), then [feature14_anonymous_drafts.sql](../supabase/feature14_anonymous_drafts.sql), in the Supabase SQL editor after the existing schema and `feature3_test_snapshots.sql` migration.

feature10_11 creates the `drafts` table, adds `taker_id` and `attempt_number` to `responses`, and installs the Row Level Security policy that lets authenticated users read only their own completed attempts. feature14 then relaxes the `drafts` policies so a browser's anonymous session can own drafts the same way it already owns published tests — a draft no longer requires signing in to show up on the Dashboard.

Test-taking history (attempts) is unaffected by feature14 and still requires a real signed-in account, since attempt records need a stable identity across devices.

Existing anonymous/public responses are preserved. New signed-in submissions are linked to the current authenticated Supabase user automatically; no user ID is accepted from the browser.
