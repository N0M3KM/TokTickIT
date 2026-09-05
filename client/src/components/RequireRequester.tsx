import { Navigate } from 'react-router-dom';
import { useRequester } from '../context/RequesterContext.js';

/**
 * Route guard — redirects to the Requester Selection screen
 * when no requester is selected (FR-04, AC-02).
 *
 * Usage:
 *   <Route path="/tickets" element={<RequireRequester><MyTickets /></RequireRequester>} />
 */
export default function RequireRequester({ children }: { children: React.ReactNode }) {
  const { selectedRequesterId } = useRequester();

  if (!selectedRequesterId) {
    return <Navigate to="/select-requester" replace />;
  }

  return <>{children}</>;
}
