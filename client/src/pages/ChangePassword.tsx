import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { safeReturnPath } from '../lib/api.js';

const rules = [
  ['At least 8 characters', (value: string) => value.length >= 8],
  ['One uppercase letter', (value: string) => /[A-Z]/.test(value)],
  ['One lowercase letter', (value: string) => /[a-z]/.test(value)],
  ['One number', (value: string) => /\d/.test(value)],
  ['One special character', (value: string) => /[^A-Za-z0-9]/.test(value)],
] as const;

export default function ChangePassword() {
  const { user, loading, changePassword, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnPath(params.get('redirectAfterLogin'));
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = Boolean(currentPassword) && rules.every(([, test]) => test(newPassword)) && newPassword === confirmPassword && newPassword !== currentPassword;

  if (loading) return <main className="auth-page"><p role="status">Restoring your session...</p></main>;
  if (!user) return <Navigate to="/login" replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) { setError('Meet every password rule, confirm the password, and choose a different password.'); return; }
    setBusy(true); setError('');
    try { await changePassword(currentPassword, newPassword, confirmPassword); navigate(returnTo, { replace: true }); }
    catch (reason) { setError((reason as Error).message); }
    finally { setBusy(false); }
  }

  async function signOut() {
    setBusy(true); setError('');
    try { await logout(); }
    catch { setError('Could not sign out. Please try again.'); }
    finally { setBusy(false); }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand">TokTickIT <span>Secure your account</span></div>
    <h1>Change Your Password</h1>
    <p className="auth-hint">{user.mustChangePassword ? 'Choose your own password to continue. Your temporary password must be replaced before you can access the application.' : 'Choose a new password for your account.'}</p>
    <form onSubmit={submit} noValidate>
      <PasswordInput id="current-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} disabled={busy} />
      <PasswordInput id="new-password" label="New password" value={newPassword} onChange={setNewPassword} disabled={busy} />
      {newPassword && newPassword === currentPassword && <p role="alert" className="text-danger">New password must differ from the current password.</p>}
      <PasswordInput id="confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} disabled={busy} />
      <ul className="list-unstyled mt-3">{rules.map(([label, test]) => <li key={label} style={{ color: test(newPassword) ? 'var(--color-success-text)' : 'var(--color-error)' }}>{test(newPassword) ? '✓' : '○'} {label}</li>)}</ul>
      {confirmPassword && confirmPassword !== newPassword && <p role="alert" className="text-danger">Passwords do not match.</p>}
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <button type="submit" className="btn btn-primary w-100" disabled={busy || !valid}>{busy ? 'Saving...' : 'Save Password and Continue'}</button>
    </form>
    <div className="auth-actions">{!user.mustChangePassword && <button className="btn btn-outline-primary" onClick={() => navigate('/')}>Cancel</button>}<button className="btn btn-outline-primary" disabled={busy} onClick={() => void signOut()}>Sign Out</button></div>
  </section></main>;
}

function PasswordInput({ id, label, value, onChange, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [visible, setVisible] = useState(false);
  return <><label htmlFor={id}>{label}</label><div className="password-control"><input id={id} type={visible ? 'text' : 'password'} autoComplete={id === 'current-password' ? 'current-password' : 'new-password'} required disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} /><button type="button" className="btn btn-outline-primary" aria-label={(visible ? 'Hide ' : 'Show ') + label.toLowerCase()} onClick={() => setVisible(!visible)}>{visible ? 'Hide' : 'Show'}</button></div></>;
}
