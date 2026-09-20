import { Link } from 'react-router-dom';

export default function AccountHelp({ createAccount = false }: { createAccount?: boolean }) {
  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand">TokTickIT <span>IT Service Desk</span></div>
    <h1>{createAccount ? 'Need an account?' : 'Forgot your password?'}</h1>
    <p>{createAccount ? 'Your administrator creates your account and assigns the access you need.' : 'Contact your administrator to request a new temporary password.'}</p>
    <ol className="help-steps">
      <li>Contact your organization’s IT administrator with your name and work email.</li>
      <li>Receive a temporary password directly from the administrator.</li>
      <li>Sign in, then choose your own password before accessing tickets.</li>
    </ol>
    <p className="auth-hint">For account security, passwords cannot be retrieved and reset emails are not sent.</p>
    <Link className="btn btn-primary w-100" to="/login">Back to Sign In</Link>
  </section></main>;
}
