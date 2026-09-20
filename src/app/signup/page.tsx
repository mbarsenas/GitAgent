export default function SignUpPage() {
  return (
    <main className="auth-page">
      <a className="auth-brand" href="/"><span>G</span><strong>GitAgent</strong></a>
      <section className="auth-card">
        <p className="marketing-kicker">CREATE YOUR GITAGENT ACCOUNT</p>
        <h1>Govern your first AI agent.</h1>
        <p>Create your account with GitHub. After sign-up, GitAgent will guide you through connecting the repositories you want governed.</p>
        <a className="auth-github" href="/api/auth/github">Create account with GitHub <span>→</span></a>
        <small>By continuing, you create a GitAgent account using your verified GitHub identity. Installing the GitAgent GitHub App is a separate step.</small>
        <p className="auth-switch">Already have an account? <a href="/signin">Sign in</a></p>
      </section>
    </main>
  );
}
