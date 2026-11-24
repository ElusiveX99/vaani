# Vaani security baseline

This file separates repository protections from controls requiring provider-dashboard access. A commit cannot configure or prove Supabase, LiveKit, Vercel Firewall, or account-level settings.

## Repository protections

- Global response headers are configured in `next.config.ts`.
- LiveKit token and moderation endpoints use bounded JSON parsing.
- State-changing endpoints retain same-origin checks.
- LiveKit tokens are issued only after server-side identity, live-session, and accepted-membership checks; token lifetime is reduced to two hours.
- Database-backed rate limits cover LiveKit token issuance and moderation, session document mutations. Limits are enforced per authenticated user and action.
- Private session/reader responses use no-store headers where implemented.

## Provider verification required

### Supabase
- Verify RLS on every Data API-exposed table, including profiles, sessions, session_members, session_documents, session_reader_state, and session_messages.
- Review all CRUD policies, grants, views, and SECURITY DEFINER functions; verify ownership, safe search_path, and EXECUTE grants.
- Verify session-pdfs is private and inspect storage policies, upload size limits, and MIME restrictions.
- Keep service-role and secret keys server-only.
- Configure Auth rate limits, CAPTCHA/bot protection where appropriate, email verification, password policy, and allowed redirect URLs.
- Enable backups/PITR where available and test restoration.

### LiveKit
- Keep API credentials server-only and rotate exposed credentials.
- Verify room access is granted only through server-issued tokens after accepted-membership checks.
- Verify participant removal and moderation revoke access as intended.
- Review room, participant, and bandwidth limits and enable usage alerts.

### Vercel
- Enable/review Firewall and DDoS protections; configure rate-limit rules for authentication-sensitive and resource-intensive routes where supported.
- Configure spend and usage alerts.
- Verify production branch, deployment protection, team access, environment-variable scopes, and preview deployment behavior.
- Do not expose production secrets to untrusted preview deployments.

### GitHub and dependencies
- Enable secret scanning and push protection where available.
- Enable Dependabot alerts and security updates.
- Protect main with required checks/reviews where supported.
- Keep Actions permissions least-privilege and review third-party actions.
- Review dependency audit findings before upgrading packages.

## Still required
- Extend distributed rate limiting to login-adjacent actions, gathering chat, PDF uploads, and session creation. The current database-backed limiter covers LiveKit token issuance and moderation, session document mutations; process-local memory is not a reliable security boundary on serverless infrastructure.
- Centralized alerts for repeated authentication failures, authorization denials, token issuance spikes, unusual database usage, and resource consumption.
- Tested backup restoration, incident response, credential rotation, and rollback procedures.
- An enforcing CSP tailored to actual script, image, font, Supabase, and LiveKit origins. Do not deploy a guessed CSP; it can break authentication and conference connectivity.

This repository update is not a penetration test and does not prove database policies or provider settings. Run build, lint, dependency audit, role-based authorization tests, storage-policy tests, and conference regression tests before declaring the release verified.
