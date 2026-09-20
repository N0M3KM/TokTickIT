import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { type UserRole, useAuth } from '../context/AuthContext.js';

const roleLabels: Record<UserRole, string> = { REQUESTER: 'Requester', IT_STAFF: 'IT Staff', ADMINISTRATOR: 'Administrator' };

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user) return null;
  const links = user.role === 'REQUESTER'
    ? [{ to: '/tickets', label: 'My Tickets' }, { to: '/tickets/new', label: 'Create Ticket' }]
    : user.role === 'IT_STAFF' ? [{ to: '/queue', label: 'Ticket Queue' }]
    : [{ to: '/admin/users', label: 'User Management' }, { to: '/queue', label: 'Ticket Queue' }];

  async function signOut() {
    setBusy(true); setError('');
    try { await logout(); }
    catch { setError('Could not sign out. Please try again.'); }
    finally { setBusy(false); }
  }

  return <>
    <header className="lab3-header" style={{ background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center' }}>
      <NavLink to="/" style={{ color: '#fff', fontWeight: 750, fontSize: 23, textDecoration: 'none' }}>TokTickIT</NavLink>
      <nav className="lab3-nav" aria-label="Main navigation">{links.map((link) => <NavLink key={link.to} end to={link.to} style={({ isActive }) => ({ color: '#fff', textDecoration: 'none', padding: '6px 0', borderBottom: isActive ? '2px solid white' : '2px solid transparent' })}>{link.label}</NavLink>)}</nav>
      <div className="lab3-identity">
        <span className={`badge role-${user.role.toLowerCase()}`}>{roleLabels[user.role]}</span><span className="user-name">{user.name}</span>
        <NavLink to="/change-password" style={{ color: '#fff', fontSize: 13 }}>Change Password</NavLink>
        <button className="btn btn-sm btn-outline-light" disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out...' : 'Sign Out'}</button>
      </div>
    </header>
    <main style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto', padding: '24px 16px' }}>
      {error && <p className="alert alert-danger" role="alert">{error}</p>}{children}
    </main>
  </>;
}
