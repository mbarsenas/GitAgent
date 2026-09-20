export default function SignInPage() {
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/"><span>G</span><strong>GitAgent</strong></a>
      <section className="auth-card">
        <p className="marketing-kicker">GITAGENTFLOW</p>
        <h1>Welcome back.</h1>
        <p>Sign in with GitHub to access your governed development control plane.</p>
        <div className="auth-providers">
          <a className="auth-github" href="/api/auth/github"><b className="provider-mark">GH</b><strong>Continue with GitHub</strong><span>→</span></a>
          <a className="auth-google" href="/api/auth/google"><b className="provider-mark">G</b><strong>Continue with Google</strong><span>→</span></a>
        </div>
        <small>GitHub verifies your identity. Repository access is authorized separately through the GitAgent GitHub App.</small>
      </section>
    </main>
  );
}
