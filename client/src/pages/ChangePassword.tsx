import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

const rules = [
  ['At least 8 characters', (value: string) => value.length >= 8],
  ['One uppercase letter', (value: string) => /[A-Z]/.test(value)],
  ['One lowercase letter', (value: string) => /[a-z]/.test(value)],
  ['One number', (value: string) => /\d/.test(value)],
  ['One special character', (value: string) => /[^A-Za-z0-9]/.test(value)],
] as const;

export default function ChangePassword() {
  const { user, loading, changePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = rules.every(([, test]) => test(newPassword)) && newPassword === confirmPassword && newPassword !== currentPassword;

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (!loading && user && !user.mustChangePassword) return <Navigate to="/" replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) { setError('Meet every password rule, confirm the password, and choose a different password.'); return; }
    setBusy(true); setError('');
    try { await changePassword(currentPassword, newPassword, confirmPassword); navigate('/', { replace: true }); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  return <main style={pageStyle}><form onSubmit={submit} style={cardStyle} noValidate>
    <h1 style={{ fontSize: 24, margin: '0 0 8px' }}>Change Your Password</h1>
    <p style={subtle}>You must change your password to continue.</p>
    <PasswordInput id="current-password" label="Current (temporary) password" value={currentPassword} onChange={setCurrentPassword} />
    <PasswordInput id="new-password" label="New password" value={newPassword} onChange={setNewPassword} />
    <PasswordInput id="confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />
    <p style={{ fontWeight: 600, margin: '20px 0 6px' }}>Password must:</p>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>{rules.map(([label, test]) => <li key={label} style={{ color: test(newPassword) ? 'var(--color-success-text)' : 'var(--color-error)', marginTop: 4 }}>{test(newPassword) ? '✓' : '○'} {label}</li>)}</ul>
    {confirmPassword && confirmPassword !== newPassword && <p role="alert" style={errorStyle}>Passwords do not match.</p>}
    {error && <p role="alert" style={errorStyle}>{error}</p>}
    <button type="submit" disabled={busy || !valid} style={primaryButton}>{busy ? 'Saving...' : 'Continue'}</button>
  </form></main>;
}

function PasswordInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return <><label htmlFor={id} style={labelStyle}>{label}</label><input id={id} type="password" autoComplete="new-password" value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle} /></>;
}
const pageStyle: React.CSSProperties = { minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 };
const cardStyle: React.CSSProperties = { width: 'min(100%, 460px)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, boxShadow: '0 6px 20px var(--color-shadow)', padding: 32 };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 14, fontWeight: 600, marginTop: 16, marginBottom: 4 };
const inputStyle: React.CSSProperties = { boxSizing: 'border-box', width: '100%', height: 40, border: '1px solid var(--color-editable-border)', borderRadius: 6, padding: '0 10px', background: 'var(--color-editable-bg)' };
const primaryButton: React.CSSProperties = { marginTop: 22, width: '100%', height: 40, border: 'none', borderRadius: 6, background: 'var(--color-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' };
const errorStyle: React.CSSProperties = { color: 'var(--color-error)', background: 'var(--color-error-bg)', padding: 10, margin: '14px 0 0', borderRadius: 6 };
const subtle: React.CSSProperties = { color: 'var(--color-text-secondary)', margin: 0, fontSize: 14 };
