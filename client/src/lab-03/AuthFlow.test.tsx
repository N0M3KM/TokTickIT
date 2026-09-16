import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext.js';
import RequireAuth from '../components/RequireAuth.js';
import Login from '../pages/Login.js';
import ChangePassword from '../pages/ChangePassword.js';
import AccountHelp from '../pages/AccountHelp.js';
import { apiFetch, safeReturnPath } from '../lib/api.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const user = { id: 1, name: 'Requester', role: 'REQUESTER', mustChangePassword: false };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function Location() { return <p data-testid="location">{useLocation().pathname + useLocation().search}</p>; }
function app(path = '/tickets/new') {
  render(<MemoryRouter initialEntries={[path]}><AuthProvider><Location /><Routes>
    <Route path="/tickets/new" element={<RequireAuth><h1>Create Ticket</h1></RequireAuth>} />
    <Route path="/login" element={<Login />} /><Route path="/change-password" element={<ChangePassword />} />
    <Route path="/forgot-password" element={<AccountHelp />} />
  </Routes></AuthProvider></MemoryRouter>);
}

describe('Lab 3 authentication navigation', () => {
  it('redirects unauthenticated ticket creation to sign-in with a return URL', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 401))); app();
    await screen.findByRole('heading', { name: 'Sign in to your account' });
    expect(screen.getByTestId('location')).toHaveTextContent('/login?redirectAfterLogin=%2Ftickets%2Fnew');
  });
  it('returns to ticket creation after login', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(json({}, 401)).mockResolvedValueOnce(json(user));
    vi.stubGlobal('fetch', fetcher); app();
    await screen.findByRole('heading', { name: 'Sign in to your account' });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Valid@123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await screen.findByRole('heading', { name: 'Create Ticket' });
    expect(fetcher).toHaveBeenLastCalledWith('/api/auth/login', expect.objectContaining({ credentials: 'same-origin' }));
  });
  it('restores a first-login session to mandatory password change', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ ...user, mustChangePassword: true }))); app();
    await screen.findByRole('heading', { name: 'Change Your Password' });
    expect(screen.queryByRole('heading', { name: 'Create Ticket' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeVisible();
  });
  it('ends the client session when a protected API returns 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json(user)).mockResolvedValue(json({}, 401))); app();
    await screen.findByRole('heading', { name: 'Create Ticket' });
    await apiFetch('/api/tickets');
    await screen.findByRole('heading', { name: 'Sign in to your account' });
  });
  it('shows connection failure and allows retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network'))); app('/login');
    await screen.findByRole('heading', { name: 'Sign in to your account' });
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Valid@123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Cannot connect'));
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });
  it('provides administrator-assisted recovery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({}, 401))); app('/forgot-password');
    expect(screen.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible();
    expect(screen.getByText(/Contact your administrator/)).toBeVisible();
  });
  it.each(['https://evil.example', '//evil.example', '/\\evil.example', '/login', '/change-password'])('rejects unsafe or cyclic return path %s', (path) => {
    expect(safeReturnPath(path)).toBe('/');
  });
});
