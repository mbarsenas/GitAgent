export default function SignedOutPage() {
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/"><span>G</span><strong>GitAgent</strong></a>
      <section className="auth-card">
        <p className="marketing-kicker">GITAGENTFLOW</p>
        <h1>You’re signed out.</h1>
        <p>Your GitAgent session has ended. You can return to the site or sign back in when you’re ready.</p>
        <div className="auth-providers">
          <a className="auth-github" href="/signin"><strong>Sign back in</strong><span>→</span></a>
          <a className="auth-google" href="/"><strong>Return to GitAgentFlow</strong><span>→</span></a>
        </div>
      </section>
    </main>
  );
}
