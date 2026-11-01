import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, type AuthUser } from '../context/AuthContext.js';
import RequireAuth from '../components/RequireAuth.js';
import Login from '../pages/Login.js';
import { apiFetch } from '../lib/api.js';

// Historical filename retained for traceability. UI-01..04's development picker,
// public requester enumeration and localStorage identity switching were retired
// by Lab 3 authentication. Their meaningful identity/loading/failure/continuation
// guarantees now apply to the actual cookie-session login and role guards.
const requester: AuthUser = { id: 7, name: 'Authenticated requester', role: 'REQUESTER', mustChangePassword: false };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function LocationProbe() { const location = useLocation(); return <p data-testid="location">{location.pathname}{location.search}</p>; }
function ProtectedPage() {
  const { user } = useAuth();
  return <RequireAuth roles={['REQUESTER']}><p>Signed in as {user?.name}</p><button onClick={() => void apiFetch('/api/tickets')}>Reload protected tickets</button></RequireAuth>;
}
function setup(options: { user?: AuthUser | null; entry?: string; restore?: () => Promise<Response>; login?: (init: RequestInit) => Promise<Response> } = {}) {
  const fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    if (url === '/api/auth/me') return options.restore ? options.restore() : options.user ? json(options.user) : json({ error: { code: 'UNAUTHENTICATED' } }, 401);
    if (url === '/api/auth/login') return options.login ? options.login(init) : json(requester);
    if (url === '/api/tickets') return json({ error: { code: 'UNAUTHENTICATED' } }, 401);
    throw new Error(`Unexpected auth request ${url}`);
  });
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter initialEntries={[options.entry ?? '/login']}><AuthProvider><LocationProbe /><Routes>
    <Route path="/login" element={<Login />} /><Route path="/tickets" element={<ProtectedPage />} />
    <Route path="/admin" element={<RequireAuth roles={['ADMINISTRATOR']}><p>Private administration</p></RequireAuth>} />
    <Route path="/change-password" element={<p>Password change destination</p>} /><Route path="/forbidden" element={<p>Forbidden destination</p>} />
    <Route path="/" element={<p>Home destination</p>} />
  </Routes></AuthProvider></MemoryRouter>);
  return { fetch };
}
async function credentials(email = 'requester@test.invalid', password = 'SyntheticPassword!1') {
  fireEvent.change(await screen.findByLabelText('Email address'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password', { exact: true }), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In', exact: true }));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('UI-01 real session restoration replaces development requester selection', () => {
  it('renders the real login form and account-help links for an absent session', async () => {
    setup(); await screen.findByRole('heading', { name: 'Sign in to your account' });
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
    expect(screen.getByRole('link', { name: 'Need an account?' })).toHaveAttribute('href', '/sign-up');
    expect(screen.queryByText(/Authentication coming|not a login screen|Select Development Requester/i)).not.toBeInTheDocument();
  });
  it('shows loading while the authenticated session is being restored', async () => {
    let finish!: (response: Response) => void;
    setup({ restore: () => new Promise(resolve => { finish = resolve; }) });
    expect(screen.getByRole('status')).toHaveTextContent('Restoring your session...');
    expect(screen.queryByLabelText('Email address')).not.toBeInTheDocument();
    finish(json({ error: { code: 'UNAUTHENTICATED' } }, 401)); await screen.findByLabelText('Email address');
  });
  it('restores only the server session and does not enumerate or auto-select requester accounts', async () => {
    const { fetch } = setup({ user: requester, entry: '/login?redirectAfterLogin=%2Ftickets' });
    await screen.findByText(`Signed in as ${requester.name}`);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(fetch.mock.calls.every(([url]) => url === '/api/auth/me')).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/api/auth/me', expect.objectContaining({ credentials: 'same-origin' }));
  });
  it('does not accept forged development identity storage in place of a session', async () => {
    localStorage.setItem('devRequesterId', '7'); localStorage.setItem('devRequesterName', requester.name);
    setup({ entry: '/tickets?status=OPEN' }); await screen.findByRole('heading', { name: 'Sign in to your account' });
    expect(screen.queryByText(`Signed in as ${requester.name}`)).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('redirectAfterLogin=%2Ftickets%3Fstatus%3DOPEN');
  });
});

describe('UI-02 authenticated identity and permitted continuation', () => {
  it('requires both email and password before contacting login', async () => {
    const { fetch } = setup(); fireEvent.click(await screen.findByRole('button', { name: 'Sign In', exact: true }));
    expect(screen.getByRole('alert')).toHaveTextContent('Email and password are required.');
    expect(fetch.mock.calls.some(([url]) => url === '/api/auth/login')).toBe(false);
  });
  it('rejects malformed email rather than selecting a caller-chosen identity', async () => {
    const { fetch } = setup(); await credentials('invalid-email');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address.');
    expect(fetch.mock.calls.some(([url]) => url === '/api/auth/login')).toBe(false);
  });
  it('posts credentials with cookies, never requesterId, and restores a safe protected return path', async () => {
    const { fetch } = setup({ entry: '/login?redirectAfterLogin=%2Ftickets%3Fstatus%3DOPEN' }); await credentials();
    await screen.findByText(`Signed in as ${requester.name}`);
    const call = fetch.mock.calls.find(([url]) => url === '/api/auth/login')!;
    expect(call[1]).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(JSON.parse(call[1].body as string)).toEqual({ email: 'requester@test.invalid', password: 'SyntheticPassword!1' });
    expect(screen.getByTestId('location')).toHaveTextContent('/tickets?status=OPEN');
    expect(localStorage.getItem('devRequesterId')).toBeNull();
  });
  it('supports password visibility without changing credential values', async () => {
    setup(); fireEvent.change(await screen.findByLabelText('Password', { exact: true }), { target: { value: 'SyntheticPassword!1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Show password' })); expect(screen.getByLabelText('Password', { exact: true })).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' })); expect(screen.getByLabelText('Password', { exact: true })).toHaveValue('SyntheticPassword!1');
  });
  it.each(['https://evil.invalid', '//evil.invalid'])('rejects unsafe login return path %s', async redirectAfterLogin => {
    setup({ entry: `/login?${new URLSearchParams({ redirectAfterLogin })}` }); await credentials();
    await screen.findByText('Home destination'); expect(screen.getByTestId('location')).toHaveTextContent('/');
  });
  it('enforces administrator role guards after a legitimate requester login', async () => {
    setup({ user: requester, entry: '/admin' }); await screen.findByText('Forbidden destination');
    expect(screen.queryByText('Private administration')).not.toBeInTheDocument();
  });
});

describe('UI-03/04 safe login failure, retry and session expiration', () => {
  it('shows safe credential rejection and retains form values for a new attempt', async () => {
    setup({ login: async () => json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }, 401) });
    await credentials(); await screen.findByRole('alert'); expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(screen.getByLabelText('Email address')).toHaveValue('requester@test.invalid'); expect(screen.queryByText(`Signed in as ${requester.name}`)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In', exact: true })).toBeEnabled();
  });
  it('shows a network failure and retries login without requester enumeration', async () => {
    let fail = true;
    const { fetch } = setup({ login: async () => { if (fail) throw new TypeError('Network unavailable'); return json(requester); }, entry: '/login?redirectAfterLogin=%2Ftickets' });
    await credentials(); await screen.findByText('Cannot connect to the service. Please try again.');
    fail = false; fireEvent.click(screen.getByRole('button', { name: 'Sign In', exact: true }));
    await screen.findByText(`Signed in as ${requester.name}`);
    expect(fetch.mock.calls.filter(([url]) => url === '/api/auth/login')).toHaveLength(2);
    expect(fetch.mock.calls.some(([url]) => url === '/api/requesters')).toBe(false);
  });
  it('disables duplicate submit while authentication is pending', async () => {
    let finish!: (response: Response) => void;
    const { fetch } = setup({ login: () => new Promise(resolve => { finish = resolve; }) });
    await credentials(); expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled();
    expect(screen.getByLabelText('Email address')).toBeDisabled(); expect(screen.getByLabelText('Password', { exact: true })).toBeDisabled();
    expect(fetch.mock.calls.filter(([url]) => url === '/api/auth/login')).toHaveLength(1);
    finish(json(requester)); await screen.findByText('Home destination');
  });
  it('prioritizes mandatory password change after successful login', async () => {
    setup({ login: async () => json({ ...requester, mustChangePassword: true }), entry: '/login?redirectAfterLogin=%2Ftickets' });
    await credentials(); await screen.findByText('Password change destination');
    expect(screen.getByTestId('location')).toHaveTextContent('/change-password?redirectAfterLogin=%2Ftickets');
    expect(screen.queryByText(`Signed in as ${requester.name}`)).not.toBeInTheDocument();
  });
  it('treats failed restoration as unauthenticated and does not continue to private content', async () => {
    setup({ restore: async () => { throw new TypeError('Unavailable'); }, entry: '/tickets' });
    await screen.findByRole('heading', { name: 'Sign in to your account' });
    expect(screen.queryByText(`Signed in as ${requester.name}`)).not.toBeInTheDocument();
  });
  it('clears protected identity after an API session-expired response', async () => {
    setup({ user: requester, entry: '/tickets?status=OPEN' }); await screen.findByText(`Signed in as ${requester.name}`);
    fireEvent.click(screen.getByRole('button', { name: 'Reload protected tickets' }));
    await screen.findByRole('heading', { name: 'Sign in to your account' });
    expect(screen.queryByText(`Signed in as ${requester.name}`)).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('redirectAfterLogin=%2Ftickets%3Fstatus%3DOPEN'));
  });
});
