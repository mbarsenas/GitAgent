# GitAgent Development

## Prerequisites

- Node.js 20+
- npm
- Docker Desktop or Docker Engine with Compose

## Local setup

1. Clone the repository.
2. Check out the implementation branch you are working on.
3. Copy `.env.example` to `.env`.
4. Start PostgreSQL:

```bash
docker compose up -d postgres
```

5. Install dependencies:

```bash
npm install
```

6. Generate the Prisma client:

```bash
npm run db:generate
```

7. Create/apply a local migration:

```bash
npm run db:migrate -- --name init
```

8. Start the application:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Validation

Before opening or updating a pull request, run:

```bash
npm run typecheck
npm run build
```

Add lint/tests as the implementation evolves. A change is not complete until code, documentation, and the workflow record agree.

## Secrets

Never commit provider keys, Git backend tokens, production credentials, or generated `.env` files. `.env.example` contains names only and placeholder values.

## Issue #1 implementation slice

The first MVP slice establishes the control-plane foundation:

- Next.js + TypeScript application shell
- PostgreSQL/Prisma domain model
- explicit agents, tasks, executions, capability grants, approvals, budgets and audit events
- provider-neutral model interface
- provider-neutral Git service interface
- Docker-based local PostgreSQL
- initial operator dashboard

Subsequent slices should build through issues and pull requests rather than bypassing the repository workflow.
