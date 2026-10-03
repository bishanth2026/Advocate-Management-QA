# AdvocateDesk isolated test configuration

> **TEST ONLY.** This branch points `auth.js` to the separate `AdvocateDesk-Test` Supabase project (`uqtsksgypncsbcnuanbk`). Do not merge this branch into `main` or the production branch. Production Supabase remains unchanged.

## Local test

1. Check out `staging/advocatedesk-test`.
2. Serve the repository over localhost using a static HTTP server (do not open `app.html` directly as a `file://` URL).
3. In the test project's Supabase Dashboard, open **Authentication → URL Configuration** and add the exact local app URL to **Redirect URLs**. Keep the existing production redirect URLs unchanged.
4. Sign in separately with the two test accounts. Use the dashboard-set credentials; never place passwords, service-role keys, or other secrets in this repository.
5. Confirm each account resolves only to its own test workspace before uploading a synthetic document. Verify list, preview, delete, and cross-workspace denial in both directions.

## Scope and limitations

- This branch changes the client Supabase URL/key for isolated testing only.
- The public publishable/legacy anon key is intended for browser use; access must remain enforced by database RLS and Storage policies.
- The password-reset redirect in `auth.js` still points to the existing GitHub Pages reset page. Configure a test-specific reset URL before testing password recovery.
- Do not copy production case/client records into the test project. Use synthetic test records and documents.
- This branch is not a deployment and does not change GitHub Pages or production configuration.