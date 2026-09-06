import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RequesterProvider } from '../context/RequesterContext.js';
import AppShell from '../components/AppShell.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render AppShell with a pre-set requester in localStorage */
function renderWithRequester(name = 'Somchai Jaidee', id = 1) {
  localStorage.setItem('devRequesterId',   String(id));
  localStorage.setItem('devRequesterName', name);
  return render(
    <MemoryRouter initialEntries={['/tickets']}>
      <RequesterProvider>
        <AppShell>
          <div data-testid="page-content">Page content</div>
        </AppShell>
      </RequesterProvider>
    </MemoryRouter>,
  );
}

/** Render AppShell with NO requester selected */
function renderWithoutRequester() {
  localStorage.clear();
  return render(
    <MemoryRouter initialEntries={['/tickets']}>
      <RequesterProvider>
        <AppShell>
          <div data-testid="page-content">Page content</div>
        </AppShell>
      </RequesterProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// UI-05 — shell shows requester name + Change Requester button when selected
// ---------------------------------------------------------------------------
describe('UI-05 — shell shows requester identity when requester is selected', () => {
  it('displays the selected requester name', () => {
    renderWithRequester('Somchai Jaidee');
    expect(screen.getByTestId('requester-name-display')).toHaveTextContent('Somchai Jaidee');
  });

  it('displays the Change Requester button', () => {
    renderWithRequester();
    expect(screen.getByTestId('change-requester-btn')).toBeInTheDocument();
  });

  it('does not show "Select Requester" when a requester is set', () => {
    renderWithRequester();
    expect(screen.queryByText(/select requester/i)).not.toBeInTheDocument();
  });

  it('shows TokTickIT logo text', () => {
    renderWithRequester();
    expect(screen.getByRole('link', { name: /toktickit home/i })).toBeInTheDocument();
  });

  it('shows My Tickets nav link', () => {
    renderWithRequester();
    expect(screen.getByRole('link', { name: /my tickets/i })).toBeInTheDocument();
  });

  it('shows Create Ticket nav link', () => {
    renderWithRequester();
    expect(screen.getByRole('link', { name: /create ticket/i })).toBeInTheDocument();
  });

  it('renders children (page content)', () => {
    renderWithRequester();
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// UI-06 — clicking Change Requester clears localStorage and navigates to selector
// ---------------------------------------------------------------------------
describe('UI-06 — Change Requester clears state', () => {
  it('removes devRequesterId from localStorage when Change Requester is clicked', () => {
    renderWithRequester();
    fireEvent.click(screen.getByTestId('change-requester-btn'));
    expect(localStorage.getItem('devRequesterId')).toBeNull();
  });

  it('removes devRequesterName from localStorage when Change Requester is clicked', () => {
    renderWithRequester();
    fireEvent.click(screen.getByTestId('change-requester-btn'));
    expect(localStorage.getItem('devRequesterName')).toBeNull();
  });

  it('requester name disappears from shell after Change Requester is clicked', () => {
    renderWithRequester('Somchai Jaidee');
    fireEvent.click(screen.getByTestId('change-requester-btn'));
    expect(screen.queryByTestId('requester-name-display')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// STYLE-01 — header element has background-color #006B3C (ui-spec.md §2)
// ---------------------------------------------------------------------------
describe('STYLE-01 — header background is primary green #006B3C', () => {
  it('app-shell-header has background-color matching --color-primary', () => {
    renderWithRequester();
    const header = screen.getByTestId('app-shell-header');

    // The inline style sets backgroundColor to the CSS variable value.
    // In jsdom, CSS custom properties resolve to their literal string, so
    // we assert the inline style attribute contains the correct value or
    // variable reference — both are valid.
    const bg = header.style.backgroundColor;
    // Accept either the resolved hex or the var() reference
    const isCorrect =
      bg === '#006B3C' ||
      bg === 'rgb(0, 107, 60)' ||
      bg.includes('--color-primary') ||
      bg === 'var(--color-primary)';
    expect(isCorrect).toBe(true);
  });

  it('header is present in the DOM', () => {
    renderWithRequester();
    expect(screen.getByTestId('app-shell-header')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// No requester selected — "Select Requester" button shown
// ---------------------------------------------------------------------------
describe('shell with no requester selected', () => {
  it('shows Select Requester button when no requester set', () => {
    renderWithoutRequester();
    expect(screen.getByText(/select requester/i)).toBeInTheDocument();
  });

  it('does not show Change Requester button when no requester set', () => {
    renderWithoutRequester();
    expect(screen.queryByTestId('change-requester-btn')).not.toBeInTheDocument();
  });
});
