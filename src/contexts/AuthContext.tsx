/** @jsxImportSource react */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Sign-in is a 4-digit PIN checked on the server (api/auth.mjs). The browser
// never sees the PIN or its hash and keeps no sign-in state of its own: the
// session is an httpOnly cookie, and this context only asks the server
// whether it is valid.

export type LoginResult = { ok: boolean; error?: string };

interface AuthContextType {
  isAuthenticated: boolean;
  isChecking: boolean;
  login: (pin: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_URL = '/api/auth';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // The old build kept a "signed in" flag in localStorage. Remove it.
    try {
      localStorage.removeItem('musewave_auth_session');
      localStorage.removeItem('musewave_auth_session_user');
    } catch {
      /* storage blocked: nothing to clean */
    }

    let cancelled = false;
    fetch(AUTH_URL, { credentials: 'same-origin', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { signedIn: false }))
      .then((d: { signedIn?: boolean }) => {
        if (!cancelled) setIsAuthenticated(d?.signedIn === true);
      })
      .catch(() => {
        if (!cancelled) setIsAuthenticated(false);
      })
      .finally(() => {
        if (!cancelled) setIsChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (pin: string): Promise<LoginResult> => {
    if (!/^\d{4}$/.test(pin)) {
      return { ok: false, error: 'Type your 4-digit PIN, numbers only.' };
    }
    try {
      const r = await fetch(AUTH_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const d = (await r.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (r.ok && d?.ok) {
        setIsAuthenticated(true);
        return { ok: true };
      }
      return { ok: false, error: d?.error || 'Sign-in is unavailable right now. Please try again in a minute.' };
    } catch {
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
  }, []);

  const logout = useCallback(async () => {
    setIsAuthenticated(false);
    try {
      await fetch(AUTH_URL, { method: 'DELETE', credentials: 'same-origin' });
    } catch {
      /* the cookie expires on its own */
    }
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, isChecking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
