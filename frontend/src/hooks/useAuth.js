import { useState, useEffect, useCallback } from 'react';
import api, { hasToken } from '../services/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      if (hasToken()) {
        try {
          const res = await api.getMe();
          if (res && res.user) {
            setUser(res.user);
          }
        } catch (err) {
          api.logout();
          setUser(null);
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password);
    if (res && res.user) {
      setUser(res.user);
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    api.logout();
    setUser(null);
  }, []);

  return { user, setUser, loading, login, logout };
}

export default useAuth;
