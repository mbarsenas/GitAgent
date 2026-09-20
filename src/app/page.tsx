const features = [
  ['01', 'Isolated execution', 'Agents work inside execution-scoped branches and workspaces instead of receiving uncontrolled repository access.'],
  ['02', 'Independent review', 'Implementation and review identities stay separate, preventing an agent from approving its own work.'],
  ['03', 'Human merge gate', 'Sensitive transitions remain human decisions. AI can move work forward without owning the final merge.'],
  ['04', 'AI policy builder', 'Describe the boundaries in plain English. GitAgent drafts an enforceable policy for human review.'],
  ['05', 'Capability controls', 'Repository reads, branch writes, tests, pull requests, and protected actions are explicitly governed.'],
  ['06', 'Audit evidence', 'Sponsorship, execution, denials, approvals, reviews, and policy changes are retained as evidence.'],
];

export default function MarketingHome() {
  return (
    <main className="marketing-site">
      <div className="marketing-grid" aria-hidden="true" />
      <header className="marketing-nav">
        <a className="marketing-brand" href="/">
          <span>G</span><strong>GitAgent</strong>
        </a>
        <nav>
          <a href="#workflow">Workflow</a>
          <a href="#governance">Governance</a>
          <a href="/signin">Sign in</a>
          <a className="marketing-console" href="/signup">Create account</a>
        </nav>
      </header>

      <section className="marketing-hero">
        <div className="marketing-copy">
          <p className="marketing-kicker">✣ GITAGENTFLOW · GOVERNED AI DEVELOPMENT</p>
          <h1>The GitHub agent<br />with a <em>human<br />at merge.</em></h1>
          <p className="marketing-lede">GitAgent turns approved work into isolated, reviewable pull requests—so AI can move the code forward without becoming the owner of your repository.</p>
          <div className="marketing-actions">
            <a className="marketing-primary" href="/signup">Start with GitHub <span>→</span></a>
            <a className="marketing-secondary" href="#workflow">See the workflow</a>
          </div>
          <div className="marketing-proof">
            <span>✓ Isolated branches</span><span>✓ Independent review</span><span>✓ Human merge gate</span>
          </div>
        </div>

        <div className="marketing-visual" aria-label="GitAgent governed execution preview">
          <div className="visual-glow" />
          <div className="visual-window">
            <div className="visual-bar"><span>● ● ●</span><strong>gitagent / task-184</strong><b>● running</b></div>
            <div className="visual-body">
              <div className="visual-badge-row"><span className="visual-icon">⌘</span><div><strong>Repository boundary</strong><small>acme/platform · scoped write</small></div><b>Verified</b></div>
              <div className="visual-flow"><span>ISSUE APPROVED</span><i /><span>ISOLATED BRANCH</span><i /><span>REVIEW REQUIRED</span></div>
              <div className="visual-code"><span>src/billing/refund.ts</span><strong>+18 −4</strong><code>+ requireApproval(refund, policy){'\n'}+ recordEvidence(action, decision)</code></div>
              <div className="visual-review"><div><strong>Ready for your review</strong><small>policy check · 1 test suite · 0 secrets exposed</small></div><button>Review PR →</button></div>
            </div>
          </div>
          <span className="floating-chip chip-one">⌘ Isolated execution</span>
          <span className="floating-chip chip-two">♢ Evidence retained</span>
        </div>
      </section>

      <section className="marketing-statement" id="workflow">
        <p>THE CONTROL PLANE BETWEEN</p>
        <h2>“Let the agent code” and<br /><em>“let the agent own the repo.”</em></h2>
        <p>GitAgent creates a governed path from human intent to AI implementation, independent review, and a final human decision.</p>
      </section>

      <section className="marketing-features" id="governance">
        {features.map(([n,title,copy]) => (
          <article key={n}><span>{n}</span><h3>{title}</h3><p>{copy}</p></article>
        ))}
      </section>

      <section className="marketing-final">
        <p>GOVERNANCE WITHOUT THE BOTTLENECK</p>
        <h2>Give agents enough authority to work.<br /><em>Keep the authority that matters.</em></h2>
        <a className="marketing-primary" href="/signup">Create your account <span>→</span></a>
      </section>

      <footer className="marketing-footer"><strong>GitAgent</strong><span>GitAgentFlow.com · Governed AI development</span><a href="/signin">Sign in →</a></footer>
    </main>
  );
}
