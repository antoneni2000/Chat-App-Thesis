import { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

// "Context" în React = un loc unde poți stoca date accesibile din orice componentă,
// fără să le pasezi prin props la fiecare nivel.
const AuthContext = createContext(null);

// "Provider" = componenta care înconjoară toată aplicația și oferă datele.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // La prima încărcare, verificăm dacă avem deja un token (rămas din sesiunea anterioară).
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    // dacă avem token, întrebăm backend-ul cine suntem
    client
      .get('/users/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await client.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser({ id: data.userId, username: data.username, email: data.email, displayName: data.displayName });
  };

  const register = async (username, email, password, displayName) => {
    const { data } = await client.post('/auth/register', { username, email, password, displayName });
    localStorage.setItem('token', data.token);
    setUser({ id: data.userId, username: data.username, email: data.email, displayName: data.displayName });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// "Hook custom" = funcție utilitară prin care componentele citesc contextul.
export function useAuth() {
  return useContext(AuthContext);
}
