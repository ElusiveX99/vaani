# Supabase schema drift — final recovery findings

**Snapshot:** 2026-11-24  
**Production project:** `latpkjjrccxsnwdtttmx`  
**Clean replay project:** `cklbsprwmzsfzolzkebm`

This report supersedes the earlier diagnostic-only inventory. The earlier report correctly identified missing schema history but was based on an incomplete replay. The final replay was rebuilt from a reset project using the actual active SQL files.

## Root cause

Production's migration ledger contains 44 applied records, but those records do not fully explain the live schema. Several schema objects and function definitions had been created or changed outside the recorded chain. Some historical source migrations were present in Git but absent from the live ledger. There were also duplicate timestamp prefixes in the historical source set.

The active migration directory now contains the 44 recovered ledger migrations plus five reviewed recovery migrations. Original unrecorded SQL sources remain archived under `docs/maintenance/legacy-migrations/`.

## Recovered omissions

- Invitation-link, join-request, and notification tables and their prerequisite columns.
- Recurrence columns, foreign key, and supporting index.
- Legacy database routines referenced by later privilege migrations.
- The final permanent-link schema and current gathering RPC signatures.
- The private `session-pdfs` Storage bucket.
- Current production function definitions and privilege boundaries.

## Correctness defect fixed in the migration chain

The production `session_notifications_type_check` constraint accepts only ten values, while current trigger and reminder functions write additional values. This means valid notification events can be rejected at insert time.

The recovery migration widens the constraint to include all current writer values. This is the only intentional difference between the clean replay and the current production catalog. The migration is additive at the schema level and does not rewrite notification rows.

## Final clean replay and parity

A reset Supabase project was replayed using the actual branch migration files:

- 49/49 active migrations applied successfully.
- 82/82 columns matched.
- 41/41 indexes matched.
- 30/30 RLS policies matched.
- 10/10 triggers matched.
- 49/49 function signatures and definitions matched.
- 22/22 types matched.
- Realtime publication, RLS flags, event triggers, table grants, column grants, Storage buckets, extensions, and cron schedule matched.
- Only the notification type constraint differs, intentionally, as described above.

## Safety

No production DDL, data, migration-ledger, merge, or deployment action was performed. The isolated replay project was used only for validation. Production rollout requires a backup and the documented migration-repair step for the earlier recovery migration.
