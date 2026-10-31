import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, type AuthUser } from '../context/AuthContext.js';
import RequireAuth from '../components/RequireAuth.js';
import AppShell from '../components/AppShell.js';

// UI-05/06 migration: server-authenticated identity and Sign Out supersede the
// development requester picker. LocalStorage must never select another account.
const requester: AuthUser = { id: 1, name: 'Somchai Jaidee', role: 'REQUESTER', mustChangePassword: false };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function setup(user: AuthUser | null = requester, logout?: () => Promise<Response>) {
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/auth/me') return user ? json(user) : json({ error: { code: 'UNAUTHENTICATED' } }, 401);
    if (url === '/api/auth/logout') return logout ? logout() : json({ ok: true });
    throw new Error(`Unexpected request ${url} ${init?.method ?? 'GET'}`);
  });
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter initialEntries={['/tickets']}><AuthProvider><Routes>
    <Route path="/tickets" element={<RequireAuth><AppShell><div data-testid="page-content">Page content</div></AppShell></RequireAuth>} />
    <Route path="/login" element={<div>Login destination</div>} />
    <Route path="/change-password" element={<div>Change password destination</div>} />
  </Routes></AuthProvider></MemoryRouter>);
  return { fetch };
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

describe('UI-05 authenticated application shell', () => {
  it('displays the server-authenticated requester name and role', async () => {
    setup(); await screen.findByText(requester.name);
    expect(screen.getByText('Requester', { exact: true })).toBeInTheDocument();
  });
  it('offers Sign Out instead of changing requester identity', async () => {
    setup(); expect(await screen.findByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
    expect(screen.queryByText(/Change Requester|Select Requester/i)).not.toBeInTheDocument();
  });
  it('exposes the brand home link', async () => {
    setup(); expect(await screen.findByRole('link', { name: 'TokTickIT', exact: true })).toHaveAttribute('href', '/');
  });
  it('links requester Dashboard, My Tickets and Create Ticket', async () => {
    setup(); const nav = await screen.findByRole('navigation', { name: 'Main navigation' });
    expect(within(nav).getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('href', '/dashboard');
    expect(within(nav).getByRole('link', { name: 'My Tickets', exact: true })).toHaveAttribute('href', '/tickets');
    expect(within(nav).getByRole('link', { name: 'Create Ticket', exact: true })).toHaveAttribute('href', '/tickets/new');
  });
  it('marks the current navigation item and renders protected children', async () => {
    setup(); expect(await screen.findByTestId('page-content')).toHaveTextContent('Page content');
    expect(screen.getByRole('link', { name: 'My Tickets', exact: true })).toHaveAttribute('aria-current', 'page');
  });
  it('keeps Change Password available', async () => {
    setup(); expect(await screen.findByRole('link', { name: 'Change Password' })).toHaveAttribute('href', '/change-password');
  });
  it('does not expose staff/admin navigation to a requester', async () => {
    setup(); await screen.findByText(requester.name);
    expect(screen.queryByRole('link', { name: 'Ticket Queue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'User Management' })).not.toBeInTheDocument();
  });
  it('gives staff a queue without requester-only creation or administrator links', async () => {
    setup({ ...requester, id: 2, name: 'Staff A', role: 'IT_STAFF' });
    expect(await screen.findByRole('link', { name: 'Ticket Queue' })).toHaveAttribute('href', '/queue');
    expect(screen.queryByRole('link', { name: 'Create Ticket' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'User Management' })).not.toBeInTheDocument();
  });
  it('retains administrator user management and queue navigation', async () => {
    setup({ ...requester, id: 3, name: 'Admin A', role: 'ADMINISTRATOR' });
    expect(await screen.findByRole('link', { name: 'User Management' })).toHaveAttribute('href', '/admin/users');
    expect(screen.getByRole('link', { name: 'Ticket Queue' })).toHaveAttribute('href', '/queue');
    expect(screen.queryByRole('link', { name: 'Create Ticket' })).not.toBeInTheDocument();
  });
});

describe('UI-06 session sign-out replaces development identity switching', () => {
  it('invalidates the cookie session through logout and removes protected identity/content', async () => {
    const { fetch } = setup(); fireEvent.click(await screen.findByRole('button', { name: 'Sign Out' }));
    await screen.findByText('Login destination');
    expect(fetch).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST', credentials: 'same-origin' }));
    expect(screen.queryByText(requester.name)).not.toBeInTheDocument(); expect(screen.queryByTestId('page-content')).not.toBeInTheDocument();
  });
  it('disables duplicate sign-out while the request is pending', async () => {
    let finish!: (response: Response) => void;
    const { fetch } = setup(requester, () => new Promise(resolve => { finish = resolve; }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign Out' }));
    expect(screen.getByRole('button', { name: 'Signing out...' })).toBeDisabled();
    expect(fetch.mock.calls.filter(([url]) => url === '/api/auth/logout')).toHaveLength(1);
    finish(json({ ok: true })); await screen.findByText('Login destination');
  });
  it('retains authenticated identity and offers retry after logout failure', async () => {
    setup(requester, async () => json({ error: { code: 'INTERNAL_ERROR' } }, 500));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign Out' }));
    await screen.findByRole('alert'); expect(screen.getByText(requester.name)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeEnabled();
  });
  it('ignores forged development identity storage when restoring a real session', async () => {
    localStorage.setItem('devRequesterId', '999'); localStorage.setItem('devRequesterName', 'Forged identity');
    setup(); await screen.findByText(requester.name); expect(screen.queryByText('Forged identity')).not.toBeInTheDocument();
  });
});

describe('STYLE-01 and unauthenticated shell guards', () => {
  it('uses primary green and semantic header/main landmarks with a skip link', async () => {
    setup(); const header = await screen.findByRole('banner');
    expect(header.getAttribute('style')).toContain('var(--color-primary)');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content');
  });
  it('redirects an absent session instead of offering an identity picker', async () => {
    setup(null); await screen.findByText('Login destination');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument(); expect(screen.queryByTestId('page-content')).not.toBeInTheDocument();
    expect(screen.queryByText(/Select Requester/i)).not.toBeInTheDocument();
  });
  it('enforces mandatory password change before showing protected content', async () => {
    setup({ ...requester, mustChangePassword: true }); await screen.findByText('Change password destination');
    expect(screen.queryByTestId('page-content')).not.toBeInTheDocument();
  });
});
