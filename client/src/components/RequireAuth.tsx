import { Navigate, useLocation } from 'react-router-dom';
import { type UserRole, useAuth } from '../context/AuthContext.js';

export default function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: UserRole[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Loading your session...</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}
