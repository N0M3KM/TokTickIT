import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('TokTickIT Lab 1 page', () => {
  it('renders the TokTickIT heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /TokTickIT/i })).toBeInTheDocument();
  });

  it('changes from loading to the full category list returned by the API', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [
        { id: 1, name: 'Account and Access' }, { id: 2, name: 'Hardware' },
        { id: 3, name: 'Software' }, { id: 4, name: 'Network' },
      ] }));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^check system$/i }));
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(await screen.findByText('Account and Access')).toBeInTheDocument();
    expect(screen.getByText('Hardware')).toBeInTheDocument();
    expect(screen.getByText('Software')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('shows a useful error when the API is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error()));
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^check system$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to connect to TokTickIT API.');
  });
});
