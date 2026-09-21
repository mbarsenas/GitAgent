# Repository ownership cutover

`Repository.userId` is enforced in the application today, but remains nullable in the database until legacy data is explicitly reconciled.

1. Run `npm run db:backfill-repository-owners` in the production environment. It exits non-zero and lists every unowned repository; it never infers an owner.
2. Prepare a reviewed JSON map of **every** returned repository ID to its owner user ID. Keep the map outside source control.
3. Validate without writes: `npm run db:backfill-repository-owners -- --map ownership-map.json`.
4. Apply: `npm run db:backfill-repository-owners -- --map ownership-map.json --apply`.
5. Re-run the report command and retain the zero-unowned result with the change record.
6. Only then create and deploy the separate `NOT NULL` migration. It must use `ON DELETE RESTRICT` for `Repository_userId_fkey`, not `SET NULL`.

The backfill emits a `repository.ownership.backfilled` audit event for each applied mapping.
