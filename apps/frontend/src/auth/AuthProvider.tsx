import Keycloak from 'keycloak-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { OrganizationType, Role } from '@securetracker/shared';

interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  organizationName: string;
  organizationType: OrganizationType;
}

type AuthState =
  | { status: 'loading'; user?: undefined; login: () => void; logout: () => void }
  | { status: 'anonymous'; user?: undefined; login: () => void; logout: () => void }
  | { status: 'authenticated'; user: AuthenticatedUser; login: () => void; logout: () => void };

const AuthContext = createContext<AuthState | undefined>(undefined);

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'securetracker',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'securetracker-web'
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthenticatedUser | undefined>();

  useEffect(() => {
    let mounted = true;
    keycloak
      .init({ onLoad: 'check-sso', pkceMethod: 'S256' })
      .then(async (authenticated) => {
        if (!mounted) return;
        if (!authenticated || !keycloak.token) {
          setState('anonymous');
          return;
        }
        const response = await fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}/me`, {
          headers: { Authorization: `Bearer ${keycloak.token}` }
        });
        if (!response.ok) {
          setState('anonymous');
          return;
        }
        setUser(await response.json());
        setState('authenticated');
      })
      .catch(() => {
        if (mounted) setState('anonymous');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthState>(() => {
    const login = () => {
      void keycloak.login();
    };
    const logout = () => {
      void keycloak.logout({ redirectUri: window.location.origin });
    };
    if (state === 'authenticated' && user) return { status: state, user, login, logout };
    return { status: state, login, logout } as AuthState;
  }, [state, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
