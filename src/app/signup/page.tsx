export default function SignUpPage() {
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/"><span>G</span><strong>GitAgent</strong></a>
      <section className="auth-card">
        <p className="marketing-kicker">CREATE YOUR GITAGENT ACCOUNT</p>
        <h1>Govern your first AI agent.</h1>
        <p>Create your account with GitHub. After sign-up, GitAgent will guide you through connecting the repositories you want governed.</p>
        <div className="auth-providers">
          <a className="auth-github" href="/api/auth/github"><b className="provider-mark">GH</b><strong>Create account with GitHub</strong><span>→</span></a>
          <a className="auth-google" href="/api/auth/google"><b className="provider-mark">G</b><strong>Continue with Google</strong><span>→</span></a>
        </div>
        <small>By continuing, you create a GitAgent account using a verified identity. Repository access is authorized separately through the GitAgent GitHub App.</small>
        <p className="auth-switch">Already have an account? <a href="/signin">Sign in</a></p>
      </section>
    </main>
  );
}
