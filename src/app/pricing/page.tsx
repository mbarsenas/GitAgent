const plans = [
  {
    name: 'Starter',
    price: '$0',
    cadence: 'forever',
    description: 'For individual developers evaluating governed AI workflows.',
    cta: 'Create free account',
    href: '/signup',
    featured: false,
    features: [
      '1 GitHub installation',
      '1 repository',
      'Governed task execution',
      'Human merge gate',
      'Basic audit history',
    ],
  },
  {
    name: 'Professional',
    price: '$29',
    cadence: 'per month',
    description: 'For developers and small teams using AI agents in production repositories.',
    cta: 'Start Professional',
    href: '/signup?plan=professional',
    featured: true,
    features: [
      'Up to 10 repositories',
      'Multiple governed agents',
      'AI Policy Builder',
      'Independent review identities',
      'Full audit evidence',
      'Priority support',
    ],
  },
  {
    name: 'Team',
    price: '$79',
    cadence: 'per month',
    description: 'For engineering teams that need shared policy, approvals, and broader repository coverage.',
    cta: 'Start Team',
    href: '/signup?plan=team',
    featured: false,
    features: [
      'Up to 50 repositories',
      'Team workspaces',
      'Role-based approvals',
      'Advanced governance policies',
      'Extended audit retention',
      'Priority support',
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
          <a href="/signin">Sign in</a>
          <a href="/signup" className="pricing-nav-cta">Create account</a>
        </nav>
      </header>

      <section className="pricing-hero">
        <p className="pricing-kicker">GITAGENTFLOW · PRICING</p>
        <h1>Governed AI development without enterprise complexity.</h1>
        <p>Start free, then upgrade when you need more repositories, policy controls, team approvals, and audit coverage.</p>
      </section>

      <section className="pricing-grid">
        {plans.map((plan) => (
          <article key={plan.name} className={`pricing-card${plan.featured ? ' featured' : ''}`}>
            {plan.featured ? <span className="pricing-badge">MOST POPULAR</span> : null}
            <div>
              <p className="pricing-plan">{plan.name}</p>
              <div className="pricing-price"><strong>{plan.price}</strong><span>{plan.cadence}</span></div>
              <p className="pricing-description">{plan.description}</p>
            </div>
            <ul>
              {plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}
            </ul>
            <a className="pricing-cta" href={plan.href}>{plan.cta} <span>→</span></a>
          </article>
        ))}
      </section>

      <section className="pricing-note">
        <h2>Every plan keeps the human in control.</h2>
        <p>GitAgent is designed around explicit capabilities, isolated execution, review separation, human merge decisions, and auditable evidence.</p>
      </section>
    </main>
  );
}
