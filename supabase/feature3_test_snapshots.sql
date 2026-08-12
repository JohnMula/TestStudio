-- Feature 3: preserve the exact test version a response was submitted against.
-- Apply this migration before deploying the edit-test flow.
alter table public.responses
  add column if not exists test_snapshot jsonb;

comment on column public.responses.test_snapshot is
  'Private test definition captured at submission time so later edits do not alter historical attempts.';
