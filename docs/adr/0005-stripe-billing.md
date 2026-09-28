# ADR 0005: Stripe subscription billing and account entitlements

- Status: Accepted
- Date: 2026-09-28

## Context

GitAgent publishes Preview, Pro, and Team plans. Stripe contains planned monthly prices, but the application previously had no checkout, subscription persistence, webhook processing, billing portal, or plan enforcement. GitAgent currently scopes repository ownership and sessions to a `User` account rather than a separate workspace model.

## Decision

Use Stripe Billing subscriptions with Stripe Checkout for purchase and the Stripe-hosted customer portal for self-service billing. A Stripe customer is linked to a GitAgent user. Persist subscription state and process signed webhook events idempotently; the application database, updated by webhooks, is authoritative for entitlements. Only `active` and `trialing` subscriptions grant paid access. Enforce the published repository limits at synchronization time: Preview 1, Pro 10, Team 50. In GitAgent's current account model, a Team workspace is the owning GitAgent user account.

Checkout fails closed unless the Stripe secret, webhook signing secret, and price IDs are configured, and the selected live price is active with the expected USD monthly amount. Tax automation is not enabled because the business's tax registrations were not established by this change.

## Consequences

The application needs a database migration and a public Stripe webhook endpoint configured for checkout completion and subscription lifecycle events. Vercel production builds apply pending Prisma migrations before building the new app version; previews and local builds do not migrate production. A plan change becomes effective after Stripe webhook delivery. Checkout remains unavailable until production secrets, webhook delivery, and active price records are configured. Existing model-provider charges remain separate from GitAgent subscriptions.

## Alternatives considered

- Grant plan access from the Checkout success redirect: rejected because redirects can be skipped and do not reflect later renewals or cancellations.
- Use Stripe-hosted pricing links without local subscription state: rejected because GitAgent must enforce repository limits in its own API.
- Build a separate workspace and roles model first: deferred; current ownership and authorization are user-scoped, so billing follows that existing boundary.
