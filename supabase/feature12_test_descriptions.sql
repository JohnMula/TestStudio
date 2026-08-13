-- Feature 12: persist the optional test description used by the builder,
-- imported JSON tests, previews, and the public test introduction.

alter table public.tests
  add column if not exists description text not null default '';

comment on column public.tests.description is
  'Optional creator-facing description or instructions shown before a test begins.';
