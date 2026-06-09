import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSoftNavigate } from '../auth/useSoftNavigate';
import GoogleSignInButton from '../auth/GoogleSignInButton';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function checkCriteria(pwd) {
  return {
    length:  pwd.length >= 6,
    upper:   /[A-Z]/.test(pwd),
    lower:   /[a-z]/.test(pwd),
    digit:   /[0-9]/.test(pwd),
    special: /[!@#$%^&*()\-_+=[\]{}|;':",.<>?/\\]/.test(pwd),
  };
}

const CRITERIA = [
  { key: 'length',  label: 'Cel puțin 6 caractere' },
  { key: 'upper',   label: 'Cel puțin o literă mare (A-Z)' },
  { key: 'lower',   label: 'Cel puțin o literă mică (a-z)' },
  { key: 'digit',   label: 'Cel puțin un număr (0-9)' },
  { key: 'special', label: 'Cel puțin un caracter special (!@#$...)' },
];

function PasswordStrength({ password }) {
  if (!password) return null;
  const c = checkCriteria(password);
  const met = Object.values(c).filter(Boolean).length;
  const barColor = met < 2 ? '#f87171' : met < 3 ? '#fb923c' : met < 4 ? '#facc15' : met < 5 ? '#86efac' : '#22c55e';
  const textColor = met >= 3 ? '#15803d' : '#b45309';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ height: 4, borderRadius: 2, background: '#ebe7f2', overflow: 'hidden', marginBottom: 6 }}>
        <div style={{ height: '100%', width: `${(met / 5) * 100}%`, background: barColor, transition: 'width 0.3s ease, background 0.3s ease', borderRadius: 2 }} />
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 12, color: textColor, fontWeight: 600 }}>
        {met >= 3 ? `${met}/5 criterii îndeplinite` : `${met}/5 criterii (minim 3 necesare)`}
      </p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {CRITERIA.map(({ key, label }) => (
          <li key={key} style={{ fontSize: 12, color: c[key] ? '#15803d' : '#8b85a3', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, minWidth: 12 }}>{c[key] ? '✓' : '○'}</span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const softNavigate = useSoftNavigate();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValidEmail(email)) {
      setError('Introduceți o adresă de email validă (ex: nume@domeniu.com).');
      return;
    }
    const met = Object.values(checkCriteria(password)).filter(Boolean).length;
    if (met < 3) {
      setError('Parola trebuie să îndeplinească cel puțin 3 din 5 criterii de complexitate.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Parolele nu coincid.');
      return;
    }
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
    <div className="auth-bg page-fade">
      <div style={splitWrapperStyle}>
        <div style={heroPaneStyle} className="auth-hero">
          <span style={brandText}>Aviel</span>
          <div style={taglineWrap}>
            <span style={taglineWord}>Conexiuni</span>
            <span style={taglineWord}>care contează.</span>
          </div>
        </div>

        <div style={formPaneStyle}>
        <form onSubmit={handleSubmit} className="card-soft card-fade" style={cardStyle}>
          <h2 style={titleStyle}>Creeaza-ti contul</h2>
          <p style={subtitleStyle}>Alătură-te comunității Aviel în câțiva pași!</p>

          <div className="field">
            <label htmlFor="u">Username</label>
            <input id="u" value={username}
              onChange={(e) => setUsername(e.target.value)}
              required minLength={3} placeholder="ana_popescu" autoFocus />
          </div>

          <div className="field">
            <label htmlFor="dn">Nume afisat</label>
            <input id="dn" value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Ana Popescu" />
          </div>

          <div className="field">
            <label htmlFor="e">Email</label>
            <input id="e" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} required
              placeholder="ana@exemplu.com" />
            {email && (
              <span style={{ fontSize: 12, marginTop: 5, display: 'block', fontWeight: 600,
                color: isValidEmail(email) ? '#15803d' : '#f87171' }}>
                {isValidEmail(email) ? '✓ Adresă de email validă' : '✗ Format invalid (ex: nume@domeniu.com)'}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="p">Parolă</label>
            <input id="p" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} required
              placeholder="••••••••" />
            <PasswordStrength password={password} />
          </div>

          <div className="field">
            <label htmlFor="cp">Confirmă parola</label>
            <input id="cp" type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} required
              placeholder="••••••••" />
            {confirmPassword && (
              <span style={{ fontSize: 12, marginTop: 5, display: 'block', fontWeight: 600,
                color: password === confirmPassword ? '#15803d' : '#f87171' }}>
                {password === confirmPassword ? '✓ Parolele coincid' : '✗ Parolele nu coincid'}
              </span>
            )}
          </div>

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: 22 }}>
            {loading ? 'Se creeaza contul...' : 'Inregistreaza-te'}
          </button>

          <div style={dividerWrap}>
            <div style={dividerLine} />
            <span style={dividerText}>sau</span>
            <div style={dividerLine} />
          </div>

          <GoogleSignInButton onError={(msg) => setError(msg)} />

          <p style={footerText}>
            Ai deja cont? <a href="/login" className="link-soft" onClick={(e) => { e.preventDefault(); softNavigate('/login'); }}>Conecteaza-te</a>
          </p>
        </form>
        </div>
      </div>
    </div>
  );
}

const splitWrapperStyle = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  gap: 32, padding: '40px 24px', position: 'relative', zIndex: 1,
};

const heroPaneStyle = {
  flex: '0 0 420px', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 24,
};

const formPaneStyle = {
  flex: '0 0 420px', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const taglineWrap = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 };
const taglineWord = {
  fontSize: 22, fontWeight: 500, color: 'var(--text-dark)', letterSpacing: 0.2,
  fontFamily: '"Playfair Display", Georgia, serif', fontStyle: 'italic', opacity: 0.85,
};

const cardStyle = {
  padding: '40px 36px', width: 420, maxWidth: '100%',
  display: 'flex', flexDirection: 'column', backdropFilter: 'blur(8px)',
};

const brandText = { fontSize: 96, fontWeight: 400, letterSpacing: 0, color: 'var(--text-dark)', fontFamily: '"Monsieur La Doulaise", cursive', lineHeight: 1 };
const titleStyle = { margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-dark)', textAlign: 'center', letterSpacing: -0.5 };
const subtitleStyle = { margin: '6px 0 14px', fontSize: 14, color: 'var(--text-muted)', textAlign: 'center' };
const errorStyle = { marginTop: 14, padding: '10px 12px', background: 'var(--error-soft)', color: '#9f1239',
  borderRadius: 'var(--radius-sm)', fontSize: 13, border: '1px solid #fecdd3' };
const dividerWrap = { display: 'flex', alignItems: 'center', gap: 12, margin: '22px 0 14px' };
const dividerLine = { flex: 1, height: 1, background: 'var(--border)' };
const dividerText = { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1.5 };
const footerText = { marginTop: 18, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' };
