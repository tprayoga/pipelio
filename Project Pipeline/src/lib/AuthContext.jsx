import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '@/api/client';
import { canManageMasterData, canManageUsers, canRunSegmentation, seesAllData } from '@/lib/roles';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  // Token bisa kedaluwarsa kapan saja di tengah pemakaian. Klien memanggil
  // handler ini pada respons 401 mana pun, sehingga satu tempat saja yang
  // mengurus "sesi habis" alih-alih tiap halaman menanganinya sendiri.
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    async function restoreSession() {
      if (!getToken()) {
        setIsLoadingAuth(false);
        return;
      }
      try {
        setUser(await api.get('/auth/me'));
      } catch {
        // Token sudah tidak berlaku — klien sudah menghapusnya.
        setUser(null);
      } finally {
        setIsLoadingAuth(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const { access_token: accessToken } = await api.post('/auth/login', { email, password });
    setToken(accessToken);
    const profile = await api.get('/auth/me');
    setUser(profile);
    return profile;
  }, []);

  const changePassword = useCallback(
    (currentPassword, newPassword) =>
      api.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      }),
    []
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoadingAuth,
        role: user?.role ?? null,
        isAdmin: canManageUsers(user?.role),
        seesAllData: seesAllData(user?.role),
        canRunSegmentation: canRunSegmentation(user?.role),
        canManageMasterData: canManageMasterData(user?.role),
        login,
        logout,
        changePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
