import { requireCurrentUser } from '@/lib/auth/current-user';
import { getBillingSummary } from '@/lib/billing/entitlements';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const planLabels = { free: 'Preview', pro: 'Pro', team: 'Team' } as const;

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ checkout?: string; error?: string }> }) {
  let user;
  try { user = await requireCurrentUser(); } catch { redirect('/signin'); }
  const [billing, query] = await Promise.all([getBillingSummary(user.userId), searchParams]);
  const subscription = billing.subscription;

  return (
    <main className="pricing-page">
      <header className="pricing-nav"><a href="/console" className="pricing-brand">Git<span>Agent</span></a><nav><a href="/console">Control plane</a><a href="/pricing">Pricing</a><a href="/api/auth/signout">Sign out</a></nav></header>
      <section className="billing-card">
        <p className="pricing-kicker">GITAGENT · ACCOUNT BILLING</p>
        <h1>Your plan</h1>
        {query.checkout === 'success' ? <p className="billing-notice">Checkout completed. Stripe is confirming your subscription; this page will update when the billing webhook arrives.</p> : null}
        {query.error === 'subscription_exists' ? <p className="billing-notice">You already have a subscription in progress. Use the billing portal to manage it.</p> : null}
        {query.error === 'portal_unavailable' ? <p className="billing-notice">The billing portal is temporarily unavailable. Try again shortly.</p> : null}
        <div className="billing-plan-row"><span>Current plan</span><strong>{planLabels[billing.plan]}</strong></div>
        <div className="billing-plan-row"><span>Connected repositories</span><strong>{billing.repositoryCount} / {billing.repositoryLimit}</strong></div>
        {subscription ? <>
          <div className="billing-plan-row"><span>Subscription status</span><strong>{subscription.status.replaceAll('_', ' ')}</strong></div>
          {subscription.currentPeriodEnd ? <div className="billing-plan-row"><span>Current period ends</span><strong>{subscription.currentPeriodEnd.toLocaleDateString()}</strong></div> : null}
          {subscription.cancelAtPeriodEnd ? <p className="billing-notice">Your subscription is scheduled to end at the close of this billing period.</p> : null}
        </> : <p className="billing-copy">You’re on Preview. Upgrade when you need more connected repositories. Paid access is available when checkout is configured.</p>}
        {billing.subscription?.stripeCustomerId ? <form action="/api/billing/portal" method="post"><button className="pricing-cta" type="submit">Manage subscription and invoices <span>→</span></button></form> : <a className="pricing-cta" href="/pricing">View plans <span>→</span></a>}
      </section>
    </main>
  );
}
