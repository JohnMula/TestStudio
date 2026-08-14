-- Feature 1: base schema for tests and responses.
--
-- This is the foundational migration — every other file in this folder
-- assumes these two tables (and their base RLS policies) already exist.
-- Apply this migration FIRST, before feature3_test_snapshots.sql. It is
-- named feature0 (not feature1) purely so it sorts before feature10_11's
-- lexicographic tie so a plain `ls supabase/*.sql` matches run order.
--
-- Feature 2 (Google/Facebook sign-in) needs no SQL of its own — it's
-- configured entirely in the Supabase dashboard; see
-- docs/supabase-oauth.md. Every browser (see proxy.ts) already carries a
-- persistent Supabase Auth session, anonymous until that sign-in happens,
-- so auth.uid() is always present and "owns" a test whether the identity
-- behind it is anonymous or a real account.

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  code text not null,
  time_limit text not null default 'Off',
  shuffle boolean not null default true,
  single_attempt boolean not null default false,
  opens_at timestamptz,
  closes_at timestamptz,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint tests_code_unique unique (code),
  constraint tests_time_limit_check check (time_limit in ('Off', '15m', '30m', '60m'))
);

-- Matches listTests()'s `.order('created_at', { ascending: false })` and
-- doubles as the index RLS uses to filter by owner_id = auth.uid().
create index if not exists tests_owner_created_idx
  on public.tests (owner_id, created_at desc);

comment on table public.tests is
  'Published tests. Owner is whichever auth.uid() (anonymous or signed-in) created it — see proxy.ts.';
comment on column public.tests.owner_id is
  'auth.uid() of the browser/account that created this test. Anonymous until the creator signs in.';
comment on column public.tests.questions is
  'Full private question definitions, including answer keys. Never sent to the browser as-is — see toPublicQuestion().';

alter table public.tests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tests'
      and policyname = 'tests_select_own'
  ) then
    create policy tests_select_own on public.tests
      for select using (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tests'
      and policyname = 'tests_insert_own'
  ) then
    create policy tests_insert_own on public.tests
      for insert with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tests'
      and policyname = 'tests_update_own'
  ) then
    create policy tests_update_own on public.tests
      for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tests'
      and policyname = 'tests_delete_own'
  ) then
    create policy tests_delete_own on public.tests
      for delete using (auth.uid() = owner_id);
  end if;
end;
$$;

-- Public test-taking (getPublicTestByCode, codeExists, submitResponse) goes
-- through the service-role client instead, which bypasses RLS entirely — a
-- test-taker never needs, and never gets, a policy of their own on this
-- table. That's also why there's no anonymous SELECT-by-code policy here.

create table if not exists public.responses (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  taker_name text not null default '',
  answers jsonb not null default '{}'::jsonb,
  auto_earned numeric not null default 0,
  auto_possible numeric not null default 0,
  manual_scores jsonb not null default '{}'::jsonb,
  needs_grading boolean not null default false,
  device_id text,
  submitted_at timestamptz not null default timezone('utc', now())
);

-- Backs both `.eq('test_id', ...)` lookups (listTests, updateTest's
-- snapshot backfill) and `.in('test_id', ids)` (listTests dashboard).
create index if not exists responses_test_id_idx
  on public.responses (test_id);

-- Backs the anonymous single-attempt device check in submitResponse(),
-- hasSubmitted(), and hasDeviceSubmitted().
create index if not exists responses_test_device_idx
  on public.responses (test_id, device_id)
  where device_id is not null;

comment on table public.responses is
  'Test-taker submissions. Always written through the service-role client (submitResponse) — taking a test never requires an account.';
comment on column public.responses.device_id is
  'Anonymous single-attempt lock for takers without an account, keyed off a client-generated id.';

alter table public.responses enable row level security;

-- Only test owners can read responses at this base-schema level — a
-- signed-in taker's own-history policy (responses_select_own_attempts) is
-- added later, in feature10_11_drafts_attempt_history.sql.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'responses'
      and policyname = 'responses_select_own_test'
  ) then
    create policy responses_select_own_test on public.responses
      for select using (
        exists (
          select 1 from public.tests t
          where t.id = responses.test_id and t.owner_id = auth.uid()
        )
      );
  end if;
end;
$$;