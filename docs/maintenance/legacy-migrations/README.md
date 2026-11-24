# Original migration sources (archived)

These 24 SQL files are preserved byte-for-byte from the repository's original `main` branch at commit `00d6fa35f77390797cad00f3aa9c681432c0c333`.

They are **historical source artifacts, not active migrations**. They live outside `supabase/migrations/` so the Supabase CLI does not execute them alongside the 44 migration files reconstructed from the production ledger.

Why this archive exists:
- Several original migration files were not represented in the production migration ledger.
- Several original files used timestamps that collide with one another.
- Some original migration changes are reflected in the current production schema even though their migration versions are absent from the ledger.
- Replacing, renaming, or deleting these files without preserving their exact contents would destroy useful historical evidence.

Do not move these files back into the active migration directory without reconciling their version numbers and the production ledger. The active migration chain is being repaired separately using the actual applied migration records and schema evidence.
