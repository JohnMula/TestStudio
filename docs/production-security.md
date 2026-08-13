# Production security checklist

This project now validates server-action input, keeps sensitive Supabase work
on the server, rate-limits public and mutating actions, verifies Turnstile
server-side, and emits a nonce-based Content Security Policy plus standard
browser security headers. These controls reduce risk; no application can be
made immune to every attack. Deploy it behind a managed edge/WAF to absorb
volumetric DDoS traffic before it reaches Next.js or Supabase.

## Required before deploying

1. Apply every migration in `supabase/`, including
   `feature13_security_hardening.sql`. In production, a missing rate-limit
   secret or database function deliberately rejects protected requests.
2. Copy `.env.example` into your host's environment-variable manager and set
   every required value. Generate `RATE_LIMIT_SECRET` with a password manager
   or `openssl rand -base64 48`. Do not put `SUPABASE_SERVICE_ROLE_KEY` in a
   `NEXT_PUBLIC_*` variable, client component, repository, log, or support
   ticket. Rotate it immediately if it has ever been exposed.
3. Create a Cloudflare Turnstile widget for the production domain, set both
   Turnstile keys, and set `TURNSTILE_HOSTNAMES` to the exact allowed hostname
   list. The server rejects missing, invalid, timed-out, or wrong-hostname
   tokens in production.
4. Keep `TRUST_PROXY_IP_HEADERS` unset on Vercel. For another host, set it to
   `true` only if your reverse proxy strips client-supplied forwarding headers
   and writes trusted values itself. Otherwise attackers can choose their own
   rate-limit identity.
5. Host the app behind Vercel, Cloudflare, or another DDoS-protected edge.
   Enable its WAF/bot protection and configure an edge rule for unusually high
   request volume to `/take/*`, Server Actions, and authentication endpoints.
   Do not publish a direct, unprotected origin address.

## Supabase verification

Run Supabase's Security Advisor after applying migrations. Confirm that RLS is
enabled on `public.tests`, `public.responses`, and `public.drafts`, and review
their policies with a non-owner/anonymous test account. Browser roles should
not have a policy that can read private question answer keys, other creators'
tests, other takers' responses, or `public.rate_limits`.

The service-role key bypasses RLS by design. It is used only by server-only
modules for narrowly scoped public submission, code lookup, rate limiting, and
owner-checked grading operations. Keep Supabase dashboard/database access
restricted, enable MFA for project administrators, and set sensible Auth
rate-limit/CAPTCHA settings in the Supabase dashboard.

## Ongoing operations

- Keep production dependencies current and run `npm audit --omit=dev --audit-level=high` in CI.
- Monitor application, edge, and Supabase logs for rate-limit failures,
  Turnstile failures, unusual anonymous sign-ins, and repeated server-action
  errors. Configure alerts for sustained spikes.
- Take and test database backups. Periodically prune old `public.rate_limits`
  rows with a scheduled database job; retaining one day is normally ample.
- Re-run the Supabase Security Advisor and review RLS policies whenever schema
  changes introduce a table, view, function, storage bucket, or RPC.
- Test the deployed site with browser devtools after changing its CSP. External
  services added later must be intentionally added to the policy in
  `lib/security-headers.ts`; do not weaken it with broad wildcards or
  `unsafe-inline` scripts.
