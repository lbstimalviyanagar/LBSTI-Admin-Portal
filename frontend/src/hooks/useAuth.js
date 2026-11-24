import { useState, useEffect, useCallback } from 'react';
import api, { hasToken } from '../services/api';

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const checkAuth = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!hasToken()) {
        setUser(null);
        return;
      }
      const res = await api.getMe();
      if (res && res.user) {
        setUser(res.user);
      } else {
        api.logout();
        setUser(null);
      }
    } catch (err) {
      if (err.code === 401 || err.code === 403) {
        api.logout();
        setUser(null);
      } else {
        console.error("Session verification failed:", err);
        setError(err.message || "Unable to verify your session. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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

  return { user, setUser, loading, error, retryAuth: checkAuth, login, logout };
}

export default useAuth;
