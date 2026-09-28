# Deployment

## Initial deployment topology

- Next.js application service.
- PostgreSQL database.
- Git backend service (Forgejo/Gitea-compatible).
- Agent control-plane service.
- Isolated agent worker pool.
- Artifact/audit storage.
- Reverse proxy/TLS termination.

## Environments

At minimum maintain local development, staging, and production environments. Production credentials, deployment permissions, and data are isolated from development.

## Deployment rules

- Build immutable artifacts from an approved commit.
- Run database migration checks before promotion.
- Validate staging before production.
- Require configured approval for production.
- Record commit SHA, artifact digest, actor/agent, approval, deployment result, and rollback reference.
- Avoid in-place manual production edits.

## Rollback

Every production release must have a documented rollback strategy for application code and database migrations.

## Stripe subscriptions

Before enabling paid checkout in production:

1. Apply the Prisma migration for `BillingSubscription` and `StripeWebhookEvent`.
2. Add these production environment variables in the deployment secret manager (never commit their values): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_TEAM`, and `NEXT_PUBLIC_APP_URL` (`https://www.gitagentflow.com`). Use a Stripe restricted API key with only the customer, price-read, subscription-read, Checkout Session, and Billing Portal permissions needed by this application.
3. Configure a live Stripe webhook endpoint at `https://www.gitagentflow.com/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, and `customer.subscription.created`, `customer.subscription.updated`, and `customer.subscription.deleted`. Save the endpoint's signing secret as `STRIPE_WEBHOOK_SECRET`.
4. Configure the Stripe customer portal to allow customers to view invoices and manage/cancel subscriptions. Set the environment price IDs to the Pro and Team recurring USD monthly prices.
5. Only after the migration, environment variables, webhook delivery, and portal are verified should the Pro and Team Stripe prices be activated. Checkout checks that each selected price is active and matches the published amount before opening a session.

The application grants paid entitlements from verified subscription webhooks, not the Checkout return URL. Webhook retries are deduplicated by Stripe event ID. Until all required values are present and the prices are active, the pricing page keeps paid checkout unavailable. A subscription grants Pro/Team repository limits of 10/50; Preview allows one connected repository. Model-provider charges remain outside GitAgent billing.
