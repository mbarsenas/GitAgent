export default function SignInPage() {
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/"><span>G</span><strong>GitAgent</strong></a>
      <section className="auth-card">
        <p className="marketing-kicker">GITAGENTFLOW</p>
        <h1>Welcome back.</h1>
        <p>Sign in with GitHub to access your governed development control plane.</p>
        <a className="auth-github" href="/api/auth/github">Continue with GitHub <span>→</span></a>
        <small>GitHub verifies your identity. Repository access is authorized separately through the GitAgent GitHub App.</small>
      </section>
    </main>
  );
}
