import { requireCurrentUser } from '@/lib/auth/current-user';
import { isPlanAvailable } from '@/lib/billing/stripe';

export const dynamic = 'force-dynamic';

const plans = [
  {
    name: 'Preview',
    price: '$0',
    cadence: 'while preview is open',
    status: 'AVAILABLE',
    description: 'Try the current GitAgent product.',
    features: [
      'Governed tasks for connected repositories',
      'Execution-scoped workspaces and branch boundaries',
      'Separate implementation and review identities',
      'Human approvals and audit history',
    ],
  },
  {
    name: 'Pro',
    price: '$29',
    cadence: 'per user / month',
    status: 'PLANNED LAUNCH PRICE',
    description: 'For individual developers and small teams.',
    features: [
      'Planned price: $29 per user each month',
      'Current preview capabilities included',
      'Up to 10 connected repositories per GitAgent account',
    ],
  },
  {
    name: 'Team',
    price: '$79',
    cadence: 'per workspace / month',
    status: 'PLANNED LAUNCH PRICE',
    description: 'For teams standardizing governed agent work.',
    features: [
      'Planned price: $79 per workspace each month',
      'Up to 50 connected repositories per GitAgent account',
      'One shared subscription for the GitAgent account',
    ],
  },
];

export default async function PricingPage() {
  let signedIn = false;
  try { await requireCurrentUser(); signedIn = true; } catch { /* Keep plan details public. */ }
  const [proAvailable, teamAvailable] = await Promise.all([isPlanAvailable('pro'), isPlanAvailable('team')]);
  return (
    <main className="pricing-page">
      <header className="pricing-nav">
        <a href="/" className="pricing-brand">Git<span>Agent</span></a>
        <nav>
          <a href="/">Home</a>
          <a href="/pricing" aria-current="page">Pricing</a>
          {signedIn ? <><a href="/console">Control plane</a><a href="/billing">Billing</a><a href="/api/auth/signout" className="pricing-nav-cta">Sign out</a></> : <><a href="/signin">Sign in</a><a href="/signup" className="pricing-nav-cta">Create account</a></>}
        </nav>
      </header>

      <section className="pricing-hero">
        <p className="pricing-kicker">GITAGENTFLOW · PRICING</p>
        <h1>Pricing for governed AI coding.</h1>
        <p>Preview access is free while it is open. Pro and Team prices are available after billing setup and checkout configuration are complete.</p>
      </section>

      <section className="pricing-grid pricing-plans" aria-label="GitAgent plans">
        {plans.map((plan) => (
          <article key={plan.name} className="pricing-card">
            <div>
              <p className="pricing-plan">{plan.name}</p>
              <p className="pricing-status">{plan.name === 'Preview' || (plan.name === 'Pro' ? proAvailable : plan.name === 'Team' ? teamAvailable : false) ? 'AVAILABLE' : 'PLANNED LAUNCH PRICE'}</p>
              <div className="pricing-price"><strong>{plan.price}</strong><span>{plan.cadence}</span></div>
              <p className="pricing-description">{plan.description}</p>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </div>
          {plan.name === 'Preview'
            ? <a className="pricing-cta" href={signedIn ? '/console' : '/signup'}>{signedIn ? 'Open control plane' : 'Create a preview account'} <span>→</span></a>
            : signedIn && (plan.name === 'Pro' ? proAvailable : teamAvailable)
              ? <form action="/api/billing/checkout" method="post"><input type="hidden" name="plan" value={plan.name.toLowerCase()} /><button className="pricing-cta" type="submit">Choose {plan.name} <span>→</span></button></form>
              : <a className="pricing-cta" href={signedIn ? '/billing' : '/signup'}>{signedIn ? 'Checkout not configured' : 'Create an account'} <span>→</span></a>}
          </article>
        ))}
      </section>

      <section className="pricing-note">
        <h2>Plan limits and billing</h2>
        <p>Pro includes up to 10 connected repositories; Team includes up to 50 per GitAgent account. Paid checkout opens only when Stripe credentials, active prices, and webhook delivery are configured. Model-provider charges, if applicable, are separate.</p>
      </section>
    </main>
  );
}
