-- Features 10 + 11: account-owned builder drafts and test-taking history.
-- Apply after the existing tests/responses schema and feature3 snapshot
-- migration. Existing public/anonymous responses remain untouched.

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'Untitled test',
  question_type text not null default 'multiple_choice',
  draft_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint drafts_question_type_check check (question_type in (
    'multiple_choice', 'true_false', 'identification', 'matching',
    'fill_blank', 'enumeration', 'essay'
  ))
);

create index if not exists drafts_owner_updated_idx
  on public.drafts (owner_id, updated_at desc);

create or replace function public.set_draft_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists drafts_set_updated_at on public.drafts;
create trigger drafts_set_updated_at
before update on public.drafts
for each row execute function public.set_draft_updated_at();

alter table public.drafts enable row level security;

-- Drafts are intentionally unavailable to anonymous identities. The app also
-- checks this in its server actions; the policies make that boundary hold when
-- the table is queried outside this application too.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drafts'
      and policyname = 'drafts_select_own'
  ) then
    create policy drafts_select_own on public.drafts
      for select using (
        auth.uid() = owner_id
        and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drafts'
      and policyname = 'drafts_insert_own'
  ) then
    create policy drafts_insert_own on public.drafts
      for insert with check (
        auth.uid() = owner_id
        and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drafts'
      and policyname = 'drafts_update_own'
  ) then
    create policy drafts_update_own on public.drafts
      for update using (
        auth.uid() = owner_id
        and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      ) with check (
        auth.uid() = owner_id
        and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drafts'
      and policyname = 'drafts_delete_own'
  ) then
    create policy drafts_delete_own on public.drafts
      for delete using (
        auth.uid() = owner_id
        and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
      );
  end if;
end;
$$;

alter table public.responses
  add column if not exists taker_id uuid references auth.users(id) on delete set null,
  add column if not exists attempt_number integer;

alter table public.responses
  drop constraint if exists responses_attempt_number_positive;
alter table public.responses
  add constraint responses_attempt_number_positive
  check (attempt_number is null or attempt_number > 0) not valid;

create index if not exists responses_taker_submitted_idx
  on public.responses (taker_id, submitted_at desc)
  where taker_id is not null;

-- Account attempts get unique, sequential numbers per test. Anonymous
-- responses intentionally remain outside this index and keep their existing
-- device-based behavior.
create unique index if not exists responses_account_attempt_number_idx
  on public.responses (test_id, taker_id, attempt_number)
  where taker_id is not null and attempt_number is not null;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'responses'
      and policyname = 'responses_select_own_attempts'
  ) then
    create policy responses_select_own_attempts on public.responses
      for select using (auth.uid() = taker_id);
  end if;
end;
$$;

comment on table public.drafts is
  'Incomplete account-owned test-builder states. Published tests live in public.tests.';
comment on column public.responses.taker_id is
  'Authenticated account that submitted this response; null for public/anonymous attempts.';
comment on column public.responses.attempt_number is
  'Sequential attempt number per authenticated taker and test.';
