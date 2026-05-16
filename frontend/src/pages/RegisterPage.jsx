import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(username, email, password, displayName || username);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <h1 style={styles.title}>Chat App</h1>
        <h2 style={styles.subtitle}>Înregistrare</h2>

        <label style={styles.label}>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} style={styles.input} placeholder="ana_popescu" />

        <label style={styles.label}>Display name (numele care va aparea in chats)</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={styles.input} placeholder="Ana Popescu" />

        <label style={styles.label}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={styles.input} placeholder="ana@example.com" />

        <label style={styles.label}>Parolă (minim 6 caractere)</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} style={styles.input} placeholder="••••••••" />

        {error && <div style={styles.error}>{error}</div>}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Se creează contul...' : 'Înregistrează-te'}
        </button>

        <p style={styles.linkText}>
          Ai deja cont? <Link to="/login" style={styles.link}>Login</Link>
        </p>
      </form>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fb' },
  card: { background: '#fff', padding: 40, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: 360, display: 'flex', flexDirection: 'column' },
  title: { margin: 0, fontSize: 28, color: '#2563eb', textAlign: 'center' },
  subtitle: { margin: '8px 0 24px', fontSize: 18, fontWeight: 500, textAlign: 'center', color: '#666' },
  label: { fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6, marginTop: 12 },
  input: { padding: '10px 12px', fontSize: 14, border: '1px solid #ddd', borderRadius: 8, outline: 'none' },
  button: { marginTop: 20, padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer' },
  error: { marginTop: 12, padding: 10, background: '#fee', color: '#c00', borderRadius: 6, fontSize: 13 },
  linkText: { marginTop: 16, textAlign: 'center', fontSize: 14, color: '#666' },
  link: { color: '#2563eb', textDecoration: 'none', fontWeight: 500 },
};
