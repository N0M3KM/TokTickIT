import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ChangePassword from '../pages/ChangePassword.js';

const auth = vi.hoisted(() => ({
  user: { id: 1, role: 'REQUESTER', mustChangePassword: true },
  loading: false, changePassword: vi.fn(), logout: vi.fn(),
}));
vi.mock('../context/AuthContext.js', () => ({ useAuth: () => auth }));
beforeEach(() => { vi.resetAllMocks(); auth.user.mustChangePassword = true; });
afterEach(cleanup);
function show() {
  render(<MemoryRouter initialEntries={['/change-password?redirectAfterLogin=%2Ftickets%2Fnew']}><Routes>
    <Route path="/change-password" element={<ChangePassword />} /><Route path="/tickets/new" element={<h1>Create Ticket</h1>} />
  </Routes></MemoryRouter>);
}
function fill(current = 'Change@123', next = 'Personal@123') {
  fireEvent.change(screen.getByLabelText('Current password', { exact: true }), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('New password', { exact: true }), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Confirm new password', { exact: true }), { target: { value: next } });
}
describe('Change Password UI', () => {
  it('requires the current password, every rule, and confirmation before enabling save', () => {
    show();
    expect(screen.getByRole('button', { name: 'Save Password and Continue' })).toBeDisabled();
    fill('Change@123', 'weak');
    expect(screen.getByRole('button', { name: 'Save Password and Continue' })).toBeDisabled();
    fill();
    expect(screen.getByRole('button', { name: 'Save Password and Continue' })).toBeEnabled();
    expect(screen.getByText('✓ One uppercase letter')).toBeVisible();
  });
  it('shows inline same-password and confirmation errors', () => {
    show(); fill('Change@123', 'Change@123');
    expect(screen.getByRole('alert')).toHaveTextContent('must differ');
    fill();
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Mismatch@123' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(screen.getByRole('button', { name: 'Save Password and Continue' })).toBeDisabled();
  });
  it('toggles password visibility without changing the value', () => {
    show(); fill();
    fireEvent.click(screen.getByRole('button', { name: 'Show new password' }));
    expect(screen.getByLabelText('New password', { exact: true })).toHaveAttribute('type', 'text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide new password' }));
    expect(screen.getByLabelText('New password', { exact: true })).toHaveAttribute('type', 'password');
  });
  it('keeps inputs disabled while saving and returns to the requested page after success', async () => {
    let finish!: () => void;
    auth.changePassword.mockReturnValue(new Promise<void>((resolve) => { finish = resolve; }));
    show(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Save Password and Continue' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByLabelText('Current password')).toBeDisabled();
    expect(auth.changePassword).toHaveBeenCalledWith('Change@123', 'Personal@123', 'Personal@123');
    finish();
    await screen.findByRole('heading', { name: 'Create Ticket' });
  });
  it('shows server validation errors and enables retry', async () => {
    auth.changePassword.mockRejectedValue(new Error('Current password is incorrect.'));
    show(); fill(); fireEvent.click(screen.getByRole('button', { name: 'Save Password and Continue' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Current password is incorrect.'));
    expect(screen.getByRole('button', { name: 'Save Password and Continue' })).toBeEnabled();
  });
  it('allows sign-out during mandatory password change', async () => {
    auth.logout.mockResolvedValue(undefined); show();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    await waitFor(() => expect(auth.logout).toHaveBeenCalledOnce());
  });
  it('allows cancellation for a voluntary password change', () => {
    auth.user.mustChangePassword = false; show();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });
});
