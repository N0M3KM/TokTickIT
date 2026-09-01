import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext.js';

/**
 * AppShell — persistent top navigation bar for all Lab 2 screens.
 * ui-spec.md §6 (Application Shell)
 *
 * - Header background: --color-primary (#006B3C)
 * - Shows TokTickIT logo, nav links, and requester identity area
 * - Responsive: hamburger menu below 768 px (STYLE-01)
 * - Active page highlighted with white underline (--color-secondary)
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { selectedRequesterName, clearRequester } = useRequester();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function handleChangeRequester() {
    clearRequester();
    setMenuOpen(false);
    navigate('/select-requester', { replace: true });
  }

  // Initials avatar: first letter of each word, max 2
  const initials = selectedRequesterName
    ? selectedRequesterName
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '';

  return (
    <>
      <header
        className="tkt-header"
        data-testid="app-shell-header"
        style={{
          backgroundColor: 'var(--color-primary)',
          color: '#fff',
          height: 'var(--header-height)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--space-lg)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          boxShadow: '0 2px 4px var(--color-shadow)',
        }}
      >
        {/* Logo */}
        <NavLink
          to={selectedRequesterName ? '/tickets' : '/select-requester'}
          style={{ color: '#fff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginRight: 'var(--space-xl)' }}
          aria-label="TokTickIT home"
        >
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px' }}>TokTickIT</span>
        </NavLink>

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          className="tkt-nav-desktop"
          style={{ display: 'flex', gap: 'var(--space-md)', flex: 1 }}
        >
          <NavLink
            to="/tickets"
            style={({ isActive }) => navLinkStyle(isActive)}
            aria-current={undefined}
          >
            My Tickets
          </NavLink>
          <NavLink
            to="/tickets/new"
            style={({ isActive }) => navLinkStyle(isActive)}
          >
            + Create Ticket
          </NavLink>
        </nav>

        {/* Requester identity area */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          {selectedRequesterName ? (
            <>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-pale-green)',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                  fontSize: 12,
                }}
                aria-hidden="true"
              >
                {initials}
              </span>
              <span
                data-testid="requester-name-display"
                className="tkt-requester-name"
                style={{ fontSize: 14, fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {selectedRequesterName}
              </span>
              <button
                onClick={handleChangeRequester}
                data-testid="change-requester-btn"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.5)',
                  color: '#fff',
                  borderRadius: 'var(--border-radius-badge)',
                  padding: '4px 10px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
                aria-label="Change development requester"
              >
                Change Requester
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/select-requester')}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.5)',
                color: '#fff',
                borderRadius: 'var(--border-radius-badge)',
                padding: '4px 12px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Select Requester
            </button>
          )}

          {/* Hamburger (mobile) */}
          <button
            className="tkt-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="tkt-mobile-nav"
            style={{
              display: 'none',          // shown via media query in tokens.css
              background: 'transparent',
              border: 'none',
              color: '#fff',
              fontSize: 22,
              cursor: 'pointer',
              padding: 'var(--space-xs)',
            }}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <nav
          id="tkt-mobile-nav"
          aria-label="Mobile navigation"
          style={{
            backgroundColor: 'var(--color-primary)',
            borderTop: '1px solid rgba(255,255,255,0.15)',
            padding: 'var(--space-sm) var(--space-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
          }}
        >
          <NavLink to="/tickets"     onClick={() => setMenuOpen(false)} style={({ isActive }) => mobileNavLinkStyle(isActive)}>My Tickets</NavLink>
          <NavLink to="/tickets/new" onClick={() => setMenuOpen(false)} style={({ isActive }) => mobileNavLinkStyle(isActive)}>+ Create Ticket</NavLink>
          {selectedRequesterName && (
            <button
              onClick={handleChangeRequester}
              style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.85)', textAlign: 'left', padding: 'var(--space-xs) 0', cursor: 'pointer', fontSize: 14 }}
            >
              Change Requester
            </button>
          )}
        </nav>
      )}

      {/* Page content */}
      <main style={{ maxWidth: 'var(--max-content-width)', margin: '0 auto', padding: 'var(--space-xl) var(--space-lg)' }}>
        {children}
      </main>

      {/* Responsive styles injected as a style tag for simplicity */}
      <style>{`
        @media (max-width: 767px) {
          .tkt-nav-desktop { display: none !important; }
          .tkt-hamburger   { display: flex !important; }
          .tkt-requester-name { display: none; }
        }
      `}</style>
    </>
  );
}

function navLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    color: '#fff',
    textDecoration: 'none',
    padding: '4px 0',
    borderBottom: isActive ? '2px solid #fff' : '2px solid transparent',
    fontWeight: isActive ? 600 : 400,
    fontSize: 14,
    transition: 'border-color 0.15s',
  };
}

function mobileNavLinkStyle(isActive: boolean): React.CSSProperties {
  return {
    color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
    textDecoration: 'none',
    fontWeight: isActive ? 600 : 400,
    fontSize: 14,
    padding: 'var(--space-xs) 0',
  };
}
