# Neon to VPS PostgreSQL cutover

GitAgent production currently uses the Neon database behind `DATABASE_URL`. The VPS PostgreSQL instance used by the WickedOps agent bus is a separate database; do not point GitAgent at it or overwrite its tables. Create a dedicated `gitagent` database and least-privilege application role first.

## Prerequisites

1. Verify the VPS target database, role, PostgreSQL version, TLS certificate, inbound access from Vercel, backups, free space, and a tested restore. Keep the target connection string in the secret manager, never in the repository or shell history.
2. Use direct (unpooled) source and target URLs for `pg_dump` and `pg_restore`. Keep the Neon project and its connection available for rollback. Prepare a secure application connection path from Vercel to the VPS with TLS and appropriate pooling.
3. Freeze new GitAgent tasks and merges for the cutover window. Wait until no execution is `RUNNING` and record source row counts, migration versions, and the latest audit event ID/time. Do not let both databases accept GitAgent writes concurrently.

## Rehearsal and cutover

1. Restore a current custom-format Neon dump into an empty, dedicated VPS staging database using `pg_dump --format=custom --no-owner --no-acl` and `pg_restore --no-owner --no-acl --single-transaction`. Validate Prisma migration history, constraints, row counts for every GitAgent table, and representative ownership, approval, and audit chains.
2. Repeat the dump and restore after the write freeze into an empty production target. Compare row counts and final audit event against the frozen source. Keep the dump encrypted and access controlled.
3. Update only the GitAgent Vercel production `DATABASE_URL` to the tested VPS application URL and redeploy an approved commit. Run read-only health checks, sign-in, repository listing, execution history, and a controlled governed task. Verify its new row appears only on the VPS.
4. Unfreeze writes after verification. Retain Neon read-only and the cutover backup until the observation window ends.

## Rollback

If verification fails before unfreezing, restore the previous Vercel `DATABASE_URL` and redeploy; Neon has received no new writes. If VPS writes occurred, freeze again and reconcile those records before switching back. Never simply repoint to an older Neon snapshot after divergent writes.
