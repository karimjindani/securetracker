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
  | { status: 'loading'; user?: undefined; login: () => void; logout: () => void; apiFetch: typeof fetch }
  | { status: 'anonymous'; user?: undefined; login: () => void; logout: () => void; apiFetch: typeof fetch }
  | {
      status: 'authenticated';
      user: AuthenticatedUser;
      login: () => void;
      logout: () => void;
      apiFetch: typeof fetch;
    };

const AuthContext = createContext<AuthState | undefined>(undefined);

const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL ?? 'http://localhost:18080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM ?? 'securetracker',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID ?? 'securetracker-web'
});

let keycloakInitPromise: Promise<boolean> | undefined;

function initializeKeycloak() {
  keycloakInitPromise ??= keycloak.init({ onLoad: 'check-sso', pkceMethod: 'S256' });
  return keycloakInitPromise;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState['status']>('loading');
  const [user, setUser] = useState<AuthenticatedUser | undefined>();

  useEffect(() => {
    let mounted = true;
    initializeKeycloak()
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
      void keycloak.login({ redirectUri: window.location.href });
    };
    const logout = () => {
      void keycloak.logout({ redirectUri: window.location.origin });
    };
    const apiFetch: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      if (keycloak.token) headers.set('Authorization', `Bearer ${keycloak.token}`);
      return fetch(input, { ...init, headers });
    };
    if (state === 'authenticated' && user) return { status: state, user, login, logout, apiFetch };
    return { status: state, login, logout, apiFetch } as AuthState;
  }, [state, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
