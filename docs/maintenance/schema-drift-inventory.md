# Supabase schema drift — final recovery findings

**Snapshot:** 2026-11-24  
**Production project:** `latpkjjrccxsnwdtttmx`  
**Clean replay project:** `cklbsprwmzsfzolzkebm`

This inventory records the current production-ledger reconstruction and the limits of the available replay evidence. The clean-room replay below validates an earlier 49-file snapshot only; the current 59-file chain requires a fresh replay before production migration rollout.

## Root cause

Production's migration ledger contains 54 applied records, but those records do not fully explain the live schema. Several schema objects and function definitions had been created or changed outside the recorded chain. Some historical source migrations were present in Git but absent from the live ledger. There were also duplicate timestamp prefixes in the historical source set.

The active migration directory now contains the 54 recovered ledger migrations plus five reviewed recovery migrations. Original unrecorded SQL sources remain archived under `docs/maintenance/legacy-migrations/`.

## Recovered omissions

- Invitation-link, join-request, and notification tables and their prerequisite columns.
- Recurrence columns, foreign key, and supporting index.
- Legacy database routines referenced by later privilege migrations.
- The final permanent-link schema and current gathering RPC signatures.
- The private `session-pdfs` Storage bucket.
- Current production function definitions and privilege boundaries.

## Correctness defect fixed in the migration chain

The production `session_notifications_type_check` constraint accepts only ten values, while current trigger and reminder functions write additional values. This means valid notification events can be rejected at insert time.

The recovery migration widens the constraint to include all current writer values. The live production catalog was checked on 2026-11-24 and now contains the 17-value notification constraint. This change does not rewrite notification rows.

## Historical clean replay and parity (earlier 49-file snapshot only)

A reset Supabase project was replayed using the actual branch migration files at the earlier 49-file snapshot. This does not validate the 10 later production-ledger migrations now present in the 59-file chain:

- 49/49 migrations in that earlier snapshot applied successfully; the 10 later production-ledger migrations have not been replayed in a clean room.
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
