import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('TokTickIT Lab 1 page', () => {
  it('renders the TokTickIT heading', () => { render(<App />); expect(screen.getByRole('heading', { name: /TokTickIT IT Service Desk/i })).toBeInTheDocument(); });
  it('changes from loading to the category list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) }).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 1, name: 'Account and Access' }] }));
    render(<App />); fireEvent.click(screen.getByRole('button', { name: /check system/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    await waitFor(() => expect(screen.getByText('Account and Access')).toBeInTheDocument());
  });
  it('shows a useful error when the API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error())); render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /check system/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect to TokTickIT API.');
  });
});

