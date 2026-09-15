import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useAuth, type UserRole } from '../context/AuthContext.js';

type User = { id: number; name: string; email: string; role: UserRole; isActive: boolean; mustChangePassword: boolean };
type Draft = { name: string; email: string; role: UserRole; isActive: boolean };
type PasswordResponse = { initialPassword?: string; error?: { message?: string } };
const blankDraft: Draft = { name: '', email: '', role: 'REQUESTER', isActive: true };

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editing, setEditing] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (role) params.set('role', role);
      const response = await fetch(`/api/users?${params}`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Could not load users. Please try again.');
      setUsers(await response.json() as User[]);
    } catch (reason) { setError((reason as Error).message); }
    finally { setLoading(false); }
  }, [role, search]);

  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);
  function startCreate() { setEditing(null); setDraft(blankDraft); setError(''); setGeneratedPassword(''); }
  function startEdit(user: User) { setEditing(user); setDraft({ name: user.name, email: user.email, role: user.role, isActive: user.isActive }); setError(''); setGeneratedPassword(''); }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setGeneratedPassword('');
    try {
      const response = await fetch(editing ? `/api/users/${editing.id}` : '/api/users', {
        method: editing ? 'PATCH' : 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
      });
      const body = await response.json().catch(() => ({})) as PasswordResponse;
      if (!response.ok) throw new Error(body.error?.message ?? 'Could not save user.');
      if (editing) startCreate(); else setGeneratedPassword(body.initialPassword ?? '');
      await load();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  async function resetPassword() {
    if (!editing) return;
    setSaving(true); setError(''); setGeneratedPassword('');
    try {
      const response = await fetch(`/api/users/${editing.id}/set-password`, { method: 'POST', credentials: 'same-origin' });
      const body = await response.json().catch(() => ({})) as PasswordResponse;
      if (!response.ok) throw new Error(body.error?.message ?? 'Could not reset the password.');
      setGeneratedPassword(body.initialPassword ?? ''); await load();
    } catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }

  const editingOwnAccount = editing?.id === currentUser?.id;
  return <section>
    <header style={headerStyle}><div><h1 style={{ margin: 0 }}>Users</h1><p style={muted}>Manage TokTickIT user accounts.</p></div><button onClick={startCreate} style={primaryButton}>+ Create User</button></header>
    <div style={filterStyle}><input aria-label="Search users" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} style={inputStyle} /><select aria-label="Filter role" value={role} onChange={(e) => setRole(e.target.value)} style={inputStyle}><option value="">All roles</option><option value="REQUESTER">Requester</option><option value="IT_STAFF">IT Staff</option><option value="ADMINISTRATOR">Administrator</option></select></div>
    {error && <p role="alert" style={errorStyle}>{error}</p>}{generatedPassword && <PasswordNotice password={generatedPassword} onDismiss={() => setGeneratedPassword('')} />}
    <div style={layoutStyle}><UserTable users={users} loading={loading} onEdit={startEdit} /><form onSubmit={save} style={panelStyle}>
      <h2 style={{ marginTop: 0 }}>{editing ? `Edit ${editing.name}` : 'Create User'}</h2>
      <FormFields draft={draft} setDraft={setDraft} disableActive={Boolean(editingOwnAccount)} />
      {editingOwnAccount && <p style={muted}>You cannot deactivate your own account.</p>}
      <div style={actionsStyle}><button disabled={saving} type="submit" style={primaryButton}>{saving ? 'Saving...' : editing ? 'Save User' : 'Create User'}</button>{editing && <button disabled={saving} type="button" onClick={() => void resetPassword()} style={secondaryButton}>Generate Reset Password</button>}</div>
    </form></div>
  </section>;
}

function UserTable({ users, loading, onEdit }: { users: User[]; loading: boolean; onEdit: (user: User) => void }) {
  if (loading) return <p role="status">Loading users...</p>;
  return <table style={tableStyle}><thead><tr><th style={cellStyle}>Name</th><th style={cellStyle}>Email</th><th style={cellStyle}>Role</th><th style={cellStyle}>Status</th><th style={cellStyle}>Action</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td style={cellStyle}>{user.name}</td><td style={cellStyle}>{user.email}</td><td style={cellStyle}>{roleLabel(user.role)}</td><td style={cellStyle}>{user.isActive ? 'Active' : 'Inactive'}</td><td style={cellStyle}><button onClick={() => onEdit(user)} style={secondaryButton}>Edit</button></td></tr>)}</tbody></table>;
}
function FormFields({ draft, setDraft, disableActive }: { draft: Draft; setDraft: (value: Draft) => void; disableActive: boolean }) { return <><Field label="Full name"><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} /></Field><Field label="Email address"><input required type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} style={inputStyle} /></Field><Field label="Role"><select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as UserRole })} style={inputStyle}><option value="REQUESTER">Requester</option><option value="IT_STAFF">IT Staff</option><option value="ADMINISTRATOR">Administrator</option></select></Field><Field label="Active"><label><input type="checkbox" checked={draft.isActive} disabled={disableActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Active</label></Field></>; }
function PasswordNotice({ password, onDismiss }: { password: string; onDismiss: () => void }) { return <div role="status" style={passwordStyle}><strong>Temporary password — copy it now:</strong><code style={{ marginLeft: 8 }}>{password}</code><p style={{ margin: '8px 0' }}>It is shown once and cannot be recovered. The user must change it at first login.</p><button onClick={onDismiss} style={secondaryButton}>I copied it</button></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={fieldStyle}>{label}<span style={{ display: 'block', marginTop: 4, fontWeight: 400 }}>{children}</span></label>; }
function roleLabel(role: UserRole) { return role === 'IT_STAFF' ? 'IT Staff' : role === 'ADMINISTRATOR' ? 'Administrator' : 'Requester'; }
const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'start', flexWrap: 'wrap' }; const filterStyle: React.CSSProperties = { display: 'flex', gap: 8, margin: '16px 0', flexWrap: 'wrap' }; const layoutStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 380px)', gap: 20, alignItems: 'start' }; const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', background: '#fff' }; const cellStyle: React.CSSProperties = { padding: 10, borderBottom: '1px solid var(--color-border)', textAlign: 'left' }; const panelStyle: React.CSSProperties = { padding: 18, background: '#fff', border: '1px solid var(--color-border)', borderRadius: 6 }; const fieldStyle: React.CSSProperties = { display: 'block', marginBottom: 12, fontWeight: 600 }; const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', height: 40, border: '1px solid var(--color-editable-border)', borderRadius: 6, padding: '0 8px' }; const actionsStyle: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' }; const primaryButton: React.CSSProperties = { minHeight: 36, border: 0, borderRadius: 6, padding: '0 12px', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }; const secondaryButton: React.CSSProperties = { minHeight: 32, border: '1px solid var(--color-primary)', borderRadius: 6, padding: '0 10px', background: '#fff', color: 'var(--color-primary)', cursor: 'pointer' }; const errorStyle: React.CSSProperties = { color: 'var(--color-error)', background: 'var(--color-error-bg)', padding: 10 }; const passwordStyle: React.CSSProperties = { color: 'var(--color-success-text)', background: 'var(--color-success-bg)', padding: 12, marginBottom: 16 }; const muted: React.CSSProperties = { color: 'var(--color-text-secondary)', margin: '4px 0' };
