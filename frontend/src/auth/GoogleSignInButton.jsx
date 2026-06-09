import { useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

let gisInitializedForClientId = null;
let latestCallback = null;

/**
 * Buton Google Sign-In folosind Google Identity Services (GIS).
 * Userul apasa, se loghează cu Google, primim un ID Token, îl trimitem la backend.
 */
export default function GoogleSignInButton({ onError }) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const buttonRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || clientId.startsWith('YOUR_')) {
      return;
    }

    let cancelled = false;

    latestCallback = async (response) => {
      try {
        await loginWithGoogle(response.credential);
        navigate('/chat');
      } catch (err) {
        onError?.(err.response?.data?.error || 'Google login failed');
      }
    };

    const init = () => {
      if (cancelled || !window.google?.accounts?.id) return;

      if (gisInitializedForClientId !== clientId) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => latestCallback?.(response),
        });
        gisInitializedForClientId = clientId;
      }

      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
          shape: 'rectangular',
        });
      }
    };

    // Așteaptă să se încarce scriptul GIS (din index.html)
    if (window.google?.accounts?.id) {
      init();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          init();
        }
      }, 100);
      // timeout după 5s
      setTimeout(() => clearInterval(interval), 5000);
      return () => { cancelled = true; clearInterval(interval); };
    }
  }, [clientId]);

  if (!clientId || clientId.startsWith('YOUR_')) {
    return (
      <div style={{
        padding: 12, background: '#fef3c7', border: '1px solid #f59e0b',
        borderRadius: 8, fontSize: 12, color: '#92400e',
      }}>
        ⚠️ Google Sign-In nu e configurat. Setează <code>VITE_GOOGLE_CLIENT_ID</code> în <code>frontend/.env</code>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
      <div ref={buttonRef}></div>
    </div>
  );
}
