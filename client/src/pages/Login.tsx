import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={user.mustChangePassword ? '/change-password' : '/'} replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) { setError('Email and password are required.'); return; }
    setBusy(true); setError('');
    try {
      await login(email, password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from || '/', { replace: true });
    } catch (reason) {
      const code = (reason as { code?: string }).code;
      setError(code === 'ACCOUNT_INACTIVE'
        ? 'This account is not active. Please contact your administrator.'
        : 'Invalid email or password. Please try again.');
    } finally { setBusy(false); }
  }

  return <main style={pageStyle}><form onSubmit={submit} style={cardStyle} noValidate>
    <div style={brandStyle}>TokTickIT</div>
    <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Sign in to your account</h1>
    <p style={subtle}>IT Service Desk</p>
    <label htmlFor="email" style={labelStyle}>Email address</label>
    <input id="email" type="email" autoComplete="email" aria-required="true" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
    <label htmlFor="password" style={labelStyle}>Password</label>
    <div style={{ display: 'flex', gap: 8 }}><input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" aria-required="true" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
      <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={secondaryButton}>{showPassword ? 'Hide' : 'Show'}</button></div>
    {error && <p role="alert" style={errorStyle}>{error}</p>}
    <button type="submit" disabled={busy} style={primaryButton}>{busy ? 'Signing in...' : 'Sign In'}</button>
    <p style={{ ...subtle, marginTop: 16 }}>Password reset is not available in Lab 3. Please contact an administrator.</p>
  </form></main>;
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 };
const cardStyle: React.CSSProperties = { width: 'min(100%, 420px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, boxShadow: '0 6px 20px var(--color-shadow)', padding: 32 };
const brandStyle: React.CSSProperties = { color: 'var(--color-primary)', fontSize: 23, fontWeight: 700, marginBottom: 24 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 4 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', height: 40, border: '1px solid var(--color-editable-border)', borderRadius: 6, padding: '0 10px', background: 'var(--color-editable-bg)' };
const primaryButton: React.CSSProperties = { marginTop: 20, width: '100%', height: 40, border: 'none', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' };
const secondaryButton: React.CSSProperties = { minWidth: 56, height: 40, border: '1px solid var(--color-primary)', borderRadius: 6, background: '#fff', color: 'var(--color-primary)', cursor: 'pointer' };
const errorStyle: React.CSSProperties = { color: 'var(--color-error)', background: 'var(--color-error-bg)', padding: 10, margin: '16px 0 0', borderRadius: 6 };
const subtle: React.CSSProperties = { color: 'var(--color-text-secondary)', margin: 0, fontSize: 13 };
