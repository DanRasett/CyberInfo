import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { loginToSmartShell, logoutFromSmartShell, SmartShellCredentials } from './smartshell';
import { AUTH_TOKEN_KEY, storage, USER_KEY } from './storage';

type AuthContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  user: unknown;
  signIn: (credentials: SmartShellCredentials) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [isReady, setReady] = useState(false);
  const [isAuthenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<unknown>(null);

  useEffect(() => {
    const hydrate = async () => {
      const [token, savedUser] = await Promise.all([storage.get<string>(AUTH_TOKEN_KEY), storage.get(USER_KEY)]);
      setAuthenticated(Boolean(token));
      setUser(savedUser);
      setReady(true);
    };

    hydrate();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isReady,
      isAuthenticated,
      user,
      async signIn(credentials) {
        const nextUser = await loginToSmartShell(credentials);
        await storage.set(USER_KEY, nextUser);
        setUser(nextUser);
        setAuthenticated(true);
      },
      async signOut() {
        await logoutFromSmartShell();
        await storage.remove(USER_KEY);
        setUser(null);
        setAuthenticated(false);
      },
    }),
    [isAuthenticated, isReady, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
};
