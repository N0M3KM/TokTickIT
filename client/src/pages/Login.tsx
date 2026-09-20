import { useState } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { safeReturnPath } from '../lib/api.js';

export default function Login() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get('redirectAfterLogin') || (location.state as { from?: string } | null)?.from);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <main className="auth-page"><p role="status">Restoring your session...</p></main>;
  if (user) return <Navigate replace to={user.mustChangePassword ? '/change-password?redirectAfterLogin=' + encodeURIComponent(returnTo) : returnTo} />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setBusy(true); setError('');
    try { await login(email.trim(), password); }
    catch (reason) { setError(reason instanceof TypeError ? 'Cannot connect to the service. Please try again.' : (reason as Error).message); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand">TokTickIT <span>IT Service Desk</span></div>
    <h1>Sign in to your account</h1>
    <p className="auth-hint">Access your tickets and keep support moving.</p>
    <form onSubmit={submit} noValidate>
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" autoComplete="username" required disabled={busy} value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">Password</label>
      <div className="password-control"><input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required disabled={busy} value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" className="btn btn-outline-primary" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button>
      </div>
      {error && <p role="alert" className="alert alert-danger mt-3">{error}</p>}
      <button className="btn btn-primary w-100 mt-4" disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign In'}</button>
    </form>
    <div className="auth-actions"><Link to="/forgot-password">Forgot password?</Link><Link to="/sign-up">Need an account?</Link></div>
  </section></main>;
}
