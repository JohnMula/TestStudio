-- Feature 14: let anonymous sessions own drafts, same as public.tests.
--
-- feature10_11_drafts_attempt_history.sql deliberately restricted drafts to
-- real signed-in accounts. In practice that meant a draft built without
-- signing in only ever lived in the browser's localStorage and never
-- appeared in the Dashboard's Drafts tab, even though published tests have
-- always worked this way for anonymous sessions (see feature0_schema.sql).
-- This migration brings drafts in line with that existing behavior: every
-- browser already carries a persistent Supabase Auth session (anonymous
-- until sign-in — see proxy.ts), so auth.uid() is always present and can
-- own a draft the same way it owns a test.
--
-- Apply after feature10_11_drafts_attempt_history.sql.

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drafts'
      and policyname = 'drafts_select_own'
  ) then
    drop policy drafts_select_own on public.drafts;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drafts'
      and policyname = 'drafts_insert_own'
  ) then
    drop policy drafts_insert_own on public.drafts;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drafts'
      and policyname = 'drafts_update_own'
  ) then
    drop policy drafts_update_own on public.drafts;
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'drafts'
      and policyname = 'drafts_delete_own'
  ) then
    drop policy drafts_delete_own on public.drafts;
  end if;
end;
$$;

create policy drafts_select_own on public.drafts
  for select using (auth.uid() = owner_id);

create policy drafts_insert_own on public.drafts
  for insert with check (auth.uid() = owner_id);

create policy drafts_update_own on public.drafts
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy drafts_delete_own on public.drafts
  for delete using (auth.uid() = owner_id);

comment on table public.drafts is
  'Incomplete builder states. Owner is whichever auth.uid() (anonymous or signed-in) created it — see proxy.ts. Published tests live in public.tests.';
