# Supabase OAuth setup

Feature 2 uses Supabase Auth for Google and Facebook sign-in. No client IDs,
secrets, tokens, or private keys belong in this repository.

## Environment variables

The application needs the following existing public variables in `.env.local`
and in the deployment environment:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are still used by the server-side test
actions. Keep the service role key server-only.

## Supabase dashboard

1. In **Authentication → URL Configuration**, add your app URL as the Site
   URL and add both callback URLs to Redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`
2. In **Authentication → Providers → Google**, enable Google and enter the
   Google OAuth client ID and client secret from Google Cloud Console.
3. In **Authentication → Providers → Facebook**, enable Facebook and enter
   the Facebook app ID and app secret from Meta for Developers.
4. In **Authentication → Settings**, enable **Manual Identity Linking**. This
   lets an existing anonymous TestStudio user attach Google or Facebook to the
   same Supabase user ID, preserving tests created before sign-in.
5. In each provider's external console, register Supabase's provider callback
   URL shown in the corresponding Supabase provider settings.

The app sends the user to `/auth/callback`, exchanges the OAuth code on the
server, restores the session through auth cookies, and returns them to the
requested safe in-app URL (dashboard by default).
