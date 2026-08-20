# TestStudio

Make a test. Share a code. TestStudio is a free web app for building tests and quizzes, sharing them with a short code, link, or QR code, and taking them straight in the browser — no account required to take one.

**Live demo:** [teststudio-john.vercel.app](https://teststudio-john.vercel.app)

## What it does

TestStudio lets anyone build a test in a few minutes and hand it out with a short share code. People taking the test just enter the code (or scan a QR code) and go — nothing to install, nothing to sign up for. Test creators can optionally sign in to keep their tests, drafts, and past attempts synced across devices.

## Features

**Creating a test**
- Multiple question types: multiple choice, true/false, identification, matching, fill-in-the-blank, enumeration, and essay
- Auto-grading for objective question types, with a simple review flow for essay/open-ended responses
- Optional per-test settings: shuffle questions and/or answer choices, a time limit with auto-submit, and a single-attempt lock
- A personal question bank to reuse questions across tests
- Drafts autosave as you build, and sync to your account once you sign in

**Taking a test**
- Join with a share code, a direct link, or by scanning a QR code with your camera
- No account needed — answers autosave locally so a refresh mid-test doesn't lose progress
- Instant results with a per-question breakdown once grading is complete

**Accounts (optional)**
- Sign in with Google or Facebook
- Dashboard with your tests, your test-taking history, and in-progress drafts
- Retake tracking and attempt history for tests you've taken while signed in

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/) (Postgres, Auth, Row-Level Security)
- [SWR](https://swr.vercel.app/) for client-side data fetching
- [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) for bot protection
- Hosted on [Vercel](https://vercel.com/)

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project
- (Optional but recommended) A [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/) site

### Setup

```bash
git clone <this-repo-url>
cd teststudio
pnpm install
```

Apply the SQL migrations in `supabase/` via the Supabase SQL Editor, **in this exact order** (the filenames don't sort into run order alphabetically, so don't just go by `ls`):

1. `feature0_schema.sql` — base `tests` / `responses` tables and RLS
2. `feature3_test_snapshots.sql`
3. `feature9_shuffle_choices.sql`
4. `feature10_11_drafts_attempt_history.sql`
5. `feature12_test_descriptions.sql`
6. `feature13_security_hardening.sql`

Create a `.env.local` file with the following variables:

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser | Supabase publishable (anon) key |
| `SUPABASE_URL` | Server | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Server | Supabase anon key, used for requests scoped to the current user |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Full-access Supabase key. **Never** expose this to the browser or commit it to source control. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Browser | Cloudflare Turnstile site key |
| `TURNSTILE_SECRET_KEY` | Server only | Cloudflare Turnstile secret key |

```bash
pnpm dev
```

The app runs at `http://localhost:3000`.

## Project structure

```
app/          Next.js App Router pages
components/   Shared UI components
lib/          Server actions, Supabase clients, and app state
supabase/     SQL migrations, applied via the Supabase SQL Editor
```

## Security

TestStudio is built with a few security principles in mind:

- **Data access is scoped with Row-Level Security** at the database level, not just in application code — a signed-in user can only read or modify their own tests, drafts, and attempt history.
- **Correct answers are never sent to the browser** before a test is submitted and graded.
- **Public write actions are rate-limited and bot-protected** to guard against abuse and automated scraping.
- **Ownership is verified server-side** before any grading or editing action is allowed to proceed.

If you find a security issue, please report it privately rather than opening a public issue.