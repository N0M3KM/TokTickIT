import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type UserRole = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR';

export interface AuthUser {
  id: number;
  name: string;
  email?: string;
  role: UserRole;
  mustChangePassword: boolean;
}

interface ApiError {
  error?: { code?: string; message?: string; fields?: Record<string, string> };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readApiError(response: Response): Promise<ApiError> {
  try { return await response.json() as ApiError; } catch { return {}; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (response.ok && active) setUser(await response.json() as AuthUser);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    void restoreSession();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const expired = () => setUser(null);
    const changeRequired = () => setUser((current) => current ? { ...current, mustChangePassword: true } : null);
    window.addEventListener('session-expired', expired);
    window.addEventListener('password-change-required', changeRequired);
    return () => {
      window.removeEventListener('session-expired', expired);
      window.removeEventListener('password-change-required', changeRequired);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const body = await readApiError(response);
      throw Object.assign(new Error(body.error?.message ?? 'Unable to sign in.'), { code: body.error?.code });
    }
    setUser(await response.json() as AuthUser);
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    if (!response.ok) {
      const body = await readApiError(response);
      throw Object.assign(new Error(body.error?.message ?? 'Unable to change password.'), { code: body.error?.code, fields: body.error?.fields });
    }
    setUser((current) => current ? { ...current, mustChangePassword: false } : current);
  }, []);

  const logout = useCallback(async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    if (!response.ok && response.status !== 401) throw new Error('Could not sign out. Please try again.');
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, changePassword, logout }), [user, loading, login, changePassword, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
