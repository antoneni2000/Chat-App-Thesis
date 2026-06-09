import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSoftNavigate } from '../auth/useSoftNavigate';
import GoogleSignInButton from '../auth/GoogleSignInButton';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const softNavigate = useSoftNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(identifier, password);
      navigate('/chat');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg page-fade">
      <div style={splitWrapperStyle}>
        <div style={heroPaneStyle} className="auth-hero">
          <span style={brandText}>Aviel</span>
          <div style={taglineWrap}>
            <span style={taglineWord}>Comunică.</span>
            <span style={taglineWord}>Elaborează.</span>
            <span style={taglineWord}>Evoluează.</span>
          </div>
        </div>

        <div style={formPaneStyle}>
          <form onSubmit={handleSubmit} className="card-soft card-fade" style={cardStyle}>
            <h2 style={titleStyle}>Bine ai revenit!</h2>
            <p style={subtitleStyle}>Comunică și colaborează fără întreruperi.</p>

            <div className="field">
              <label htmlFor="identifier">Email sau username</label>
              <input id="identifier" value={identifier}
                onChange={(e) => setIdentifier(e.target.value)} required
                placeholder="email@exemplu.com sau username" autoFocus />
            </div>

            <div className="field">
              <label htmlFor="pwd">Parola</label>
              <input id="pwd" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)} required
                placeholder="••••••••" />
            </div>

            {error && <div style={errorStyle}>{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 22 }}>
              {loading ? 'Se conecteaza...' : 'Intra in cont'}
            </button>

            <div style={dividerWrap}>
              <div style={dividerLine} />
              <span style={dividerText}>sau</span>
              <div style={dividerLine} />
            </div>

            <GoogleSignInButton onError={(msg) => setError(msg)} />

            <p style={footerText}>
              Nu ai cont inca? <a href="/register" className="link-soft" onClick={(e) => { e.preventDefault(); softNavigate('/register'); }}>Creeaza unul</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

const splitWrapperStyle = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 32,
  padding: '40px 24px',
  position: 'relative',
  zIndex: 1,
};

const heroPaneStyle = {
  flex: '0 0 420px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
};

const formPaneStyle = {
  flex: '0 0 420px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const taglineWrap = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
};

const taglineWord = {
  fontSize: 22,
  fontWeight: 500,
  color: 'var(--text-dark)',
  letterSpacing: 0.2,
  fontFamily: '"Playfair Display", Georgia, serif',
  fontStyle: 'italic',
  opacity: 0.85,
};

const cardStyle = {
  padding: '40px 36px',
  width: 400,
  maxWidth: '100%',
  display: 'flex',
  flexDirection: 'column',
  backdropFilter: 'blur(8px)',
};

const brandText = { fontSize: 96, fontWeight: 400, letterSpacing: 0, color: 'var(--text-dark)', fontFamily: '"Monsieur La Doulaise", cursive', lineHeight: 1 };

const titleStyle = {
  margin: 0, fontSize: 26, fontWeight: 700,
  color: 'var(--text-dark)', textAlign: 'center', letterSpacing: -0.5,
};

const subtitleStyle = {
  margin: '6px 0 14px', fontSize: 14,
  color: 'var(--text-muted)', textAlign: 'center',
};

const errorStyle = {
  marginTop: 14, padding: '10px 12px',
  background: 'var(--error-soft)', color: '#9f1239',
  borderRadius: 'var(--radius-sm)', fontSize: 13,
  border: '1px solid #fecdd3',
};

const dividerWrap = {
  display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 14px',
};

const dividerLine = {
  flex: 1, height: 1, background: 'var(--border)',
};

const dividerText = {
  fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
  letterSpacing: 1.5,
};

const footerText = {
  marginTop: 18, textAlign: 'center', fontSize: 13,
  color: 'var(--text-muted)',
};
