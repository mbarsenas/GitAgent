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
      'Repository and usage limits will be published before launch',
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
      'Shared team administration is planned',
      'Roles, limits, and billing terms will be published before launch',
    ],
  },
];

export default function PricingPage() {
  return (
    <main className="pricing-page">
      <header className="pricing-nav">
        <a href="/" className="pricing-brand">Git<span>Agent</span></a>
        <nav>
          <a href="/">Home</a>
          <a href="/pricing" aria-current="page">Pricing</a>
          <a href="/signin">Sign in</a>
          <a href="/signup" className="pricing-nav-cta">Create account</a>
        </nav>
      </header>

      <section className="pricing-hero">
        <p className="pricing-kicker">GITAGENTFLOW · PRICING</p>
        <h1>Pricing for governed AI coding.</h1>
        <p>Preview access is free while it is open. Pro and Team prices below are planned launch prices; paid subscriptions and checkout are not available yet.</p>
      </section>

      <section className="pricing-grid pricing-plans" aria-label="GitAgent plans">
        {plans.map((plan) => (
          <article key={plan.name} className="pricing-card">
            <div>
              <p className="pricing-plan">{plan.name}</p>
              <p className="pricing-status">{plan.status}</p>
              <div className="pricing-price"><strong>{plan.price}</strong><span>{plan.cadence}</span></div>
              <p className="pricing-description">{plan.description}</p>
              <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
            </div>
            <a className="pricing-cta" href="/signup">
              {plan.name === 'Preview' ? 'Create a preview account' : 'Join the preview'}
              <span>→</span>
            </a>
          </article>
        ))}
      </section>

      <section className="pricing-note">
        <h2>Paid plans are not on sale yet</h2>
        <p>No GitAgent subscription charges are currently processed. We’ll publish final plan limits and terms before checkout opens. Charges from your model provider, if applicable, are separate.</p>
      </section>
    </main>
  );
}
