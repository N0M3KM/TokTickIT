import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/tokens.css';
import './App.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { RequesterProvider } from './context/RequesterContext.js';
import AppShell from './components/AppShell.js';
import RequireRequester from './components/RequireRequester.js';
import RequesterSelector from './pages/RequesterSelector.js';

// Placeholder pages for routes that belong to Issues #10+
// They are simple stubs so routing works end-to-end now.
function MyTicketsPlaceholder() {
  return <p style={{ color: 'var(--color-text-secondary)' }}>My Tickets — coming in Issue #10</p>;
}
function CreateTicketPlaceholder() {
  return <p style={{ color: 'var(--color-text-secondary)' }}>Create Ticket — coming in Issue #10</p>;
}
function TicketDetailPlaceholder() {
  return <p style={{ color: 'var(--color-text-secondary)' }}>Ticket Detail — coming in Issue #10</p>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RequesterProvider>
        <Routes>
          {/* Requester Selection — no shell, full-page */}
          <Route path="/select-requester" element={<RequesterSelector />} />

          {/* Root redirect: go to /tickets (RequireRequester will redirect to selector if needed) */}
          <Route path="/" element={<Navigate to="/tickets" replace />} />

          {/* Protected routes — wrapped in AppShell + RequireRequester */}
          <Route
            path="/tickets"
            element={
              <AppShell>
                <RequireRequester>
                  <MyTicketsPlaceholder />
                </RequireRequester>
              </AppShell>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <AppShell>
                <RequireRequester>
                  <CreateTicketPlaceholder />
                </RequireRequester>
              </AppShell>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <AppShell>
                <RequireRequester>
                  <TicketDetailPlaceholder />
                </RequireRequester>
              </AppShell>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/tickets" replace />} />
        </Routes>
      </RequesterProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
