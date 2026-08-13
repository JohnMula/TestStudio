-- Feature 13: server-action rate limiting.
--
-- Apply this after the existing schema migrations. The application calls the
-- function only with the Supabase service-role key; no browser role can read
-- or write limiter records, and public EXECUTE is revoked explicitly.

create table if not exists public.rate_limits (
  key text primary key,
  window_started_at timestamptz not null default timezone('utc', now()),
  count integer not null default 0 check (count >= 0)
);

alter table public.rate_limits enable row level security;

revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(
  p_key text,
  p_max_count integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean := false;
begin
  if p_key is null or length(p_key) = 0 or length(p_key) > 200 then
    return false;
  end if;
  if p_max_count < 1 or p_max_count > 100000 then
    return false;
  end if;
  if p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  with updated as (
    insert into public.rate_limits as existing (key, window_started_at, count)
    values (p_key, timezone('utc', now()), 1)
    on conflict (key) do update
      set count = case
            when existing.window_started_at <= timezone('utc', now()) - (p_window_seconds * interval '1 second')
              then 1
            else existing.count + 1
          end,
          window_started_at = case
            when existing.window_started_at <= timezone('utc', now()) - (p_window_seconds * interval '1 second')
              then timezone('utc', now())
            else existing.window_started_at
          end
    returning count
  )
  select count <= p_max_count into allowed from updated;

  return coalesce(allowed, false);
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

comment on table public.rate_limits is
  'Private, hashed server-action rate-limit counters. Rows are intentionally inaccessible to browser roles.';
comment on function public.check_rate_limit(text, integer, integer) is
  'Atomically increments a private counter and returns whether the caller is within its requested time window.';
