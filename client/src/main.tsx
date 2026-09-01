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
import MyTickets from './pages/MyTickets.js';
import CreateTicket from './pages/CreateTicket.js';
import TicketDetail from './pages/TicketDetail.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <RequesterProvider>
        <Routes>
          {/* Requester Selection — no shell, full-page */}
          <Route path="/select-requester" element={<RequesterSelector />} />

          {/* Root: redirect to /tickets (RequireRequester handles selector redirect if needed) */}
          <Route path="/" element={<Navigate to="/tickets" replace />} />

          {/* Protected routes — AppShell + RequireRequester */}
          <Route
            path="/tickets"
            element={
              <AppShell>
                <RequireRequester>
                  <MyTickets />
                </RequireRequester>
              </AppShell>
            }
          />
          <Route
            path="/tickets/new"
            element={
              <AppShell>
                <RequireRequester>
                  <CreateTicket />
                </RequireRequester>
              </AppShell>
            }
          />
          <Route
            path="/tickets/:id"
            element={
              <AppShell>
                <RequireRequester>
                  <TicketDetail />
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
