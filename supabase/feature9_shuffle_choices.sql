-- Feature 9: persist choice shuffling separately from question shuffling.
-- Existing tests retain the enabled default introduced for this setting.
alter table public.tests
  add column if not exists shuffle_choices boolean not null default true;

comment on column public.tests.shuffle_choices is
  'Whether multiple-choice options are presented in a deterministic shuffled order.';
