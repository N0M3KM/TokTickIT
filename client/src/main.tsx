import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/tokens.css';
import './App.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, type UserRole, useAuth } from './context/AuthContext.js';
import AppShell from './components/AppShell.js';
import RequireAuth from './components/RequireAuth.js';
import Login from './pages/Login.js';
import ChangePassword from './pages/ChangePassword.js';
import MyTickets from './pages/MyTickets.js';
import CreateTicket from './pages/CreateTicket.js';
import TicketDetail from './pages/TicketDetail.js';
import StaffTicketQueue from './pages/StaffTicketQueue.js';

function Home() {
  const { user } = useAuth();
  if (user?.role === 'REQUESTER') return <Navigate to="/tickets" replace />;
  return <Forbidden />;
}

function Protected({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  return <RequireAuth roles={roles}><AppShell>{children}</AppShell></RequireAuth>;
}

function Forbidden() {
  const navigate = useNavigate();
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}><section style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: 32, textAlign: 'center' }}><h1>403 — Access denied</h1><p>You do not have permission to view this page.</p><button onClick={() => navigate('/')} style={{ border: 'none', borderRadius: 6, padding: '10px 16px', background: 'var(--color-primary)', color: '#fff' }}>Return to Home</button></section></main>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/change-password" element={<ChangePassword />} />
    <Route path="/" element={<RequireAuth><Home /></RequireAuth>} />
    <Route path="/tickets" element={<Protected roles={['REQUESTER']}><MyTickets /></Protected>} />
    <Route path="/tickets/new" element={<Protected roles={['REQUESTER']}><CreateTicket /></Protected>} />
    <Route path="/tickets/:id" element={<Protected roles={['REQUESTER']}><TicketDetail /></Protected>} />
    <Route path="/queue" element={<Protected roles={['IT_STAFF', 'ADMINISTRATOR']}><StaffTicketQueue /></Protected>} />
    <Route path="/forbidden" element={<Forbidden />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes></AuthProvider></BrowserRouter></React.StrictMode>,
);
