# Supabase migration history recovery

**Status:** Clean replay and catalog comparison completed on 2026-11-24.

Production project: `latpkjjrccxsnwdtttmx`

Isolated replay project: `cklbsprwmzsfzolzkebm` (`vaani-migration-replay`, Mumbai)

## What is in the active migration directory

There are 49 active SQL migration files:

- 44 files reconstructed from the 44 records in production's `supabase_migrations.schema_migrations` ledger. Their version, name, and statement order are preserved from that ledger.
- 5 additive recovery migrations that make the recorded chain reproducible and reconcile schema changes that existed in production but were missing from its ledger.

The original, unrecorded SQL sources are retained under `docs/maintenance/legacy-migrations/` as historical evidence. They are not mixed into the active migration directory unless a reviewed, safe version is required for the canonical chain. The active migration directory has no duplicate version prefixes.

## Recovery migrations

| Migration | Purpose |
|---|---|
| `20261122093000_restore_unrecorded_gathering_schema` | Restores invitation, join-request, notification, and recurrence prerequisites missing from the recorded chain, plus required legacy routines referenced by later migrations |
| `20261123140000_simplify_permanent_invitation_links` | Removes obsolete participant-invite and expiring/multi-use link fields; aligns gathering RPC signatures and recurrence behavior |
| `20261123180000_restore_invitation_visibility_and_hard_delete` | Restores creator/manager visibility and permanent invitation-link deletion; does not delete historical revoked-link rows |
| `20261123190000_reconcile_function_and_notification_contract` | Aligns 14 database function definitions with production, restores privilege boundaries, removes a superseded policy, and widens the notification type constraint to accept types emitted by current functions |
| `20261123191000_restore_session_pdf_bucket` | Recreates the private `session-pdfs` Storage bucket with the production file-size and MIME-type limits |

The recovery migration at `20261122093000` is intentionally ordered before the first recorded migration that references the missing objects. Production already contains those objects, but its migration ledger does not record their creation. When preparing production rollout, mark this one migration as already applied after verifying the live objects; do not attempt to replay its DDL against production.

## Portability corrections

- The baseline uses `CREATE EXTENSION IF NOT EXISTS` for platform extensions and disables function-body validation only while the baseline creates functions with forward references.
- The reminder migration enables `pg_cron` when available and guards the scheduler calls, so a missing cron catalog cannot break the rest of the schema replay.
- The `session-pdfs` bucket is now part of the migration chain rather than an undocumented manual setup step.
- The final invitation migrations are idempotent where they may encounter objects already present in production. The hard-delete migration does not purge historical revoked-link rows.

## Clean-room replay

The final replay was run from a reset isolated Supabase project using the actual SQL files in this branch—not SQL copied directly from the live database during the replay.

- **49 of 49 active migration files applied successfully in order.**
- No manual schema patches or temporary helper DDL were needed during this final replay.
- `pg_cron` installed and the `vaani-gathering-reminders` scheduled job was created.
- Both Storage buckets were present with matching configuration.

## Production-to-replay catalog comparison

| Catalog | Production | Replay | Result |
|---|---:|---:|---|
| Public/private columns | 82 | 82 | Exact |
| Constraints | 55 | 55 | One intentional notification-check correction |
| Indexes | 41 | 41 | Exact |
| RLS policies | 30 | 30 | Exact |
| Triggers | 10 | 10 | Exact |
| Functions | 49 | 49 | Definitions match |
| Types | 22 | 22 | Exact |
| Realtime publication tables | 7 | 7 | Exact |
| RLS-enabled tables | 9 | 9 | Exact |
| Event triggers | 7 | 7 | Exact |
| Table grants | 104 | 104 | Exact |
| Column grants | 552 | 552 | Exact |
| Storage buckets | 2 | 2 | Exact |
| Extensions | 6 | 6 | Exact |
| Scheduled cron jobs | 1 | 1 | Exact |

### The one intentional difference: notification constraint

Production currently allows only ten notification types. Several live trigger/reminder functions write additional types, including `invitation_response`, `join_request_received`, `join_request_cancelled`, `session_reminder`, `session_resumed`, and `status_changed`. The old constraint rejects those writes.

The final recovery migration allows the full set of types used by current and retained notification writers. This is an intentional correctness fix, not unexplained schema drift. It is the only remaining catalog difference in the replay comparison.

## Production rollout boundary

**No production DDL, production data, migration-ledger, branch merge, or deployment changes were made during this work.**

Before applying the branch to production:

1. Take a production database backup.
2. Verify the objects created by `20261122093000_restore_unrecorded_gathering_schema` are already present (the catalog comparison confirms they are).
3. Use Supabase migration repair to mark that earlier recovery migration as applied, rather than replaying it out of order.
4. Run `supabase migration list` and confirm the 44 recovered versions match the remote ledger.
5. Apply the four later migrations with `supabase db push`.
6. Re-run the catalog checks and verify the notification constraint now matches the intended 17-value contract.

Do not reset, squash, or rewrite the production migration ledger. Keep the archived legacy sources until the maintenance PR has been reviewed and merged.
