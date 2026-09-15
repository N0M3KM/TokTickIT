import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { type UserRole, useAuth } from '../context/AuthContext.js';

const roleLabels: Record<UserRole, string> = { REQUESTER: 'Requester', IT_STAFF: 'IT Staff', ADMINISTRATOR: 'Admin' };
const roleColours: Record<UserRole, React.CSSProperties> = {
  REQUESTER: { background: '#E0F2FE', color: '#0369A1' }, IT_STAFF: { background: '#EDE9FE', color: '#5B21B6' }, ADMINISTRATOR: { background: '#FEF3C7', color: '#92400E' },
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const links = user.role === 'REQUESTER' ? [{ to: '/tickets', label: 'My Tickets' }, { to: '/tickets/new', label: '+ Create Ticket' }] : user.role === 'IT_STAFF' ? [{ to: '/queue', label: 'My Queue' }, { to: '/tickets/new', label: '+ Create Ticket' }] : [{ to: '/admin/users', label: 'Admin' }];
  async function signOut() { await logout(); navigate('/login', { replace: true }); }
  return <><header className="tkt-header" style={headerStyle}>
    <NavLink to="/" style={{ color: '#fff', fontWeight: 700, fontSize: 21, textDecoration: 'none', marginRight: 28 }}>TokTickIT</NavLink>
    <nav aria-label="Main navigation" style={{ display: 'flex', gap: 16, flex: 1 }}>{links.map((link) => <NavLink key={link.to} to={link.to} style={({ isActive }) => ({ color: '#fff', textDecoration: 'none', borderBottom: isActive ? '2px solid #fff' : '2px solid transparent', padding: '4px 0' })}>{link.label}</NavLink>)}</nav>
    <div style={{ position: 'relative', display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ ...roleColours[user.role], borderRadius: 4, fontSize: 12, fontWeight: 600, padding: '3px 7px' }}>{roleLabels[user.role]}</span><button onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Open user menu" style={userButton}>{user.name} ▾</button>
      {open && <div role="menu" style={menuStyle}><button onClick={() => { setOpen(false); navigate('/change-password'); }} style={menuButton}>Change Password</button><button onClick={() => void signOut()} style={menuButton}>Logout</button></div>}</div>
  </header><main style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>{children}</main></>;
}
const headerStyle: React.CSSProperties = { background: 'var(--color-primary)', color: '#fff', minHeight: 'var(--header-height)', display: 'flex', alignItems: 'center', padding: '0 var(--space-lg)', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 4px var(--color-shadow)' };
const userButton: React.CSSProperties = { border: '1px solid rgba(255,255,255,.5)', borderRadius: 4, background: 'transparent', color: '#fff', padding: '5px 9px', cursor: 'pointer' };
const menuStyle: React.CSSProperties = { position: 'absolute', right: 0, top: 38, minWidth: 160, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6, boxShadow: '0 4px 10px var(--color-shadow)', padding: 4 };
const menuButton: React.CSSProperties = { width: '100%', border: 0, background: '#fff', color: 'var(--color-text-primary)', textAlign: 'left', padding: '9px 10px', cursor: 'pointer' };
