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
        <h1>Clear pricing, when plans are ready.</h1>
        <p>GitAgent is in preview. Paid plans and prices have not been announced yet. Create an account to try the current product.</p>
      </section>

      <section className="pricing-current" aria-labelledby="preview-title">
        <article className="pricing-card">
          <div>
            <p className="pricing-plan">CURRENT ACCESS</p>
            <h2 id="preview-title">Preview</h2>
            <p className="pricing-description">Use the available GitAgent control plane while we finish defining paid plans.</p>
            <ul>
              <li>Governed coding tasks for connected repositories</li>
              <li>Execution-scoped workspaces and branch boundaries</li>
              <li>Separate implementation and review identities</li>
              <li>Human approval for sensitive transitions</li>
              <li>Audit history for governed actions</li>
            </ul>
          </div>
          <a className="pricing-cta" href="/signup">Create an account <span>→</span></a>
        </article>
      </section>

      <section className="pricing-note">
        <h2>No surprise charges</h2>
        <p>There are no paid subscriptions available through GitAgent today. We’ll publish plan details before introducing paid access. Model-provider charges, if any, are handled by your configured provider.</p>
      </section>
    </main>
  );
}
