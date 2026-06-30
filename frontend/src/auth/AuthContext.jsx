import { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    client
        .get('/users/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          sessionStorage.removeItem('token');
        })
        .finally(() => setLoading(false));
  }, []);

  const login = async (identifier, password) => {
    const { data } = await client.post('/auth/login', { identifier, password });
    const cleanToken = data.token.replace(/['\"]+/g, '');
    sessionStorage.setItem('token', cleanToken);
    // remove the setTimeout, set user after token is stored
    setUser({ id: data.userId, username: data.username, email: data.email, displayName: data.displayName, avatarUrl: data.avatarUrl });
  };

  const register = async (username, email, password, displayName) => {
    const { data } = await client.post('/auth/register', { username, email, password, displayName });
    const cleanToken = data.token.replace(/['"]+/g, '');
    sessionStorage.setItem('token', cleanToken);
    setUser({ id: data.userId, username: data.username, email: data.email, displayName: data.displayName, avatarUrl: data.avatarUrl });
  };

  const loginWithGoogle = async (googleIdToken) => {
    const { data } = await client.post('/auth/google', { idToken: googleIdToken });
    const cleanToken = data.token.replace(/['"]+/g, '');
    sessionStorage.setItem('token', cleanToken);
    setUser({ id: data.userId, username: data.username, email: data.email, displayName: data.displayName, avatarUrl: data.avatarUrl });
  };

  const logout = () => {
    sessionStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (patch) => setUser((prev) => ({ ...prev, ...patch }));

  return (
      <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, updateUser }}>
        {children}
      </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}