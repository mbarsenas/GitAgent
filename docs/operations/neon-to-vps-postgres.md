# Neon to VPS PostgreSQL cutover

GitAgent production currently uses the Neon database behind `DATABASE_URL`. Its `neondb` source also contains five `sable_*` tables. Export only the ten GitAgent tables listed below; a whole-database dump would move unrelated Sable data. The VPS PostgreSQL instance used by the WickedOps agent bus is a separate database; do not point GitAgent at it or overwrite its tables. Create a dedicated `gitagent` database and least-privilege application role first.

The source inventory on 2026-09-26 was: `Agent` 53, `Approval` 3, `AuditEvent` 272, `CapabilityGrant` 100, `Execution` 18, `ExecutionWorkspace` 16, `Repository` 26, `Task` 18, `User` 3, and `_prisma_migrations` 2. These counts are a baseline, not a substitute for fresh counts after the write freeze. Both Prisma migrations were applied: `20260917003000_execution_workspaces_and_approval_provenance` and `20260920_user_github_installation`. A manual Neon source snapshot was taken as `snap-hidden-wildflower-b5mr8w0y`; it is a source recovery point, not a portable VPS dump.

## Prerequisites

1. Verify the VPS target database, role, PostgreSQL version, TLS certificate, inbound access from Vercel, backups, free space, and a tested restore. Keep the target connection string in the secret manager, never in the repository or shell history.
2. Use direct (unpooled) source and target URLs for `pg_dump` and `pg_restore`. Keep the Neon project and its connection available for rollback. Prepare a secure application connection path from Vercel to the VPS with TLS and appropriate pooling.
3. Freeze new GitAgent tasks and merges for the cutover window. Wait until no execution is `RUNNING` and record source row counts, migration versions, and the latest audit event ID/time. Do not let both databases accept GitAgent writes concurrently.

## Rehearsal and cutover

1. Create a custom-format dump with `pg_dump --format=custom --no-owner --no-acl` and explicit `--table` arguments for `public."User"`, `public."Repository"`, `public."Agent"`, `public."Task"`, `public."Execution"`, `public."ExecutionWorkspace"`, `public."Approval"`, `public."CapabilityGrant"`, `public."AuditEvent"`, and `public."_prisma_migrations"`. Quote each case-sensitive table pattern for the shell and verify the archive inventory with `pg_restore --list`; it must contain no `sable_*` objects. Restore into an empty, dedicated VPS staging database using `pg_restore --no-owner --no-acl --single-transaction`. Validate Prisma migration history, constraints, row counts for every GitAgent table, and representative ownership, approval, and audit chains. Check any required extensions and grants separately because a table-filtered dump does not include database-wide objects.
2. Repeat the dump and restore after the write freeze into an empty production target. Compare row counts and final audit event against the frozen source. Keep the dump encrypted and access controlled.
3. Update only the GitAgent Vercel production `DATABASE_URL` to the tested VPS application URL and redeploy an approved commit. Run read-only health checks, sign-in, repository listing, execution history, and a controlled governed task. Verify its new row appears only on the VPS.
4. Unfreeze writes after verification. Retain Neon read-only and the cutover backup until the observation window ends.

## Rollback

If verification fails before unfreezing, restore the previous Vercel `DATABASE_URL` and redeploy; Neon has received no new writes. If VPS writes occurred, freeze again and reconcile those records before switching back. Never simply repoint to an older Neon snapshot after divergent writes.
