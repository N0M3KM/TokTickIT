import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RequesterProvider } from '../context/RequesterContext.js';
import RequesterSelector from '../pages/RequesterSelector.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function renderSelector() {
  return render(
    <MemoryRouter initialEntries={['/select-requester']}>
      <RequesterProvider>
        <RequesterSelector />
      </RequesterProvider>
    </MemoryRouter>,
  );
}

const activeRequesters = [
  { id: 1, name: 'Araya Phongphan',  email: 'araya.p@example.com'     },
  { id: 2, name: 'Nattaporn Srisuk', email: 'nattaporn.s@example.com' },
  { id: 3, name: 'Somchai Jaidee',   email: 'somchai.j@example.com'   },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// UI-01 — renders selector when no requester in localStorage (AC-02)
// ---------------------------------------------------------------------------
describe('UI-01 — selector rendered when no requester selected', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => activeRequesters }),
    );
  });

  it('shows the "Select Development Requester" heading', async () => {
    renderSelector();
    expect(
      await screen.findByRole('heading', { name: /select development requester/i }),
    ).toBeInTheDocument();
  });

  it('shows the Lab 3 notice text', async () => {
    renderSelector();
    expect(
      await screen.findByText(/authentication coming in lab 3/i),
    ).toBeInTheDocument();
  });

  it('shows the "This is not a login screen" explanation', async () => {
    renderSelector();
    expect(await screen.findByText(/this is not a login screen/i)).toBeInTheDocument();
  });

  it('shows a Continue button', async () => {
    renderSelector();
    expect(await screen.findByTestId('continue-btn')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-02 — dropdown shows mocked active requesters (AC-19, BR-04)
// ---------------------------------------------------------------------------
describe('UI-02 — dropdown shows active requesters from API', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => activeRequesters }),
    );
  });

  it('renders a dropdown after requesters load', async () => {
    renderSelector();
    expect(await screen.findByTestId('requester-dropdown')).toBeInTheDocument();
  });

  it('dropdown contains all active requester names', async () => {
    renderSelector();
    const dropdown = await screen.findByTestId('requester-dropdown');
    for (const r of activeRequesters) {
      expect(dropdown).toHaveTextContent(r.name);
    }
  });

  it('auto-selects the first requester', async () => {
    renderSelector();
    const dropdown = (await screen.findByTestId('requester-dropdown')) as HTMLSelectElement;
    expect(Number(dropdown.value)).toBe(activeRequesters[0].id);
  });

  it('Continue button is enabled when a requester is selected', async () => {
    renderSelector();
    const btn = await screen.findByTestId('continue-btn');
    expect(btn).not.toBeDisabled();
  });

  it('shows the "only active requesters" info note', async () => {
    renderSelector();
    expect(
      await screen.findByText(/only active development requesters are shown/i),
    ).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-03 — API failure shows error message and retry button (AC-20)
// ---------------------------------------------------------------------------
describe('UI-03 — API failure shows safe error state with retry', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
  });

  it('shows error state container', async () => {
    renderSelector();
    expect(await screen.findByTestId('selector-error')).toBeInTheDocument();
  });

  it('shows "Could not load requesters" text', async () => {
    renderSelector();
    expect(await screen.findByText(/could not load requesters/i)).toBeInTheDocument();
  });

  it('shows a Retry button', async () => {
    renderSelector();
    expect(await screen.findByTestId('retry-btn')).toBeInTheDocument();
  });

  it('Continue button is disabled in error state', async () => {
    renderSelector();
    // Wait for error state to render
    await screen.findByTestId('selector-error');
    const btn = screen.getByTestId('continue-btn');
    expect(btn).toBeDisabled();
  });

  it('Retry button re-triggers fetch', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ ok: true, json: async () => activeRequesters });
    vi.stubGlobal('fetch', fetchMock);

    renderSelector();
    const retryBtn = await screen.findByTestId('retry-btn');
    fireEvent.click(retryBtn);

    // After retry, dropdown should appear
    expect(await screen.findByTestId('requester-dropdown')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// UI-04 — empty response shows empty state; Continue disabled (BR-04, BR-05)
// ---------------------------------------------------------------------------
describe('UI-04 — empty active requester list shows empty state', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
  });

  it('shows the empty state container', async () => {
    renderSelector();
    expect(await screen.findByTestId('selector-empty')).toBeInTheDocument();
  });

  it('shows "No active requesters found" text', async () => {
    renderSelector();
    expect(
      await screen.findByText(/no active requesters found/i),
    ).toBeInTheDocument();
  });

  it('does not render the dropdown', async () => {
    renderSelector();
    await screen.findByTestId('selector-empty');
    expect(screen.queryByTestId('requester-dropdown')).not.toBeInTheDocument();
  });

  it('Continue button is disabled when list is empty', async () => {
    renderSelector();
    await screen.findByTestId('selector-empty');
    expect(screen.getByTestId('continue-btn')).toBeDisabled();
  });
});
