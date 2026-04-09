'use client';

import { useState, FormEvent, useEffect } from 'react';
import { auth } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [senhaFocus, setSenhaFocus] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (auth.isAuthenticated()) {
      window.location.href = '/';
    }
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setLoading(true);
    try {
      await auth.login(email, senha);
      window.location.href = '/';
    } catch (err: any) {
      setErro(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          width: 100%;
          background: #080808;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'IBM Plex Sans', sans-serif;
          position: relative;
          overflow: hidden;
        }

        /* Grid background */
        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(0, 200, 83, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 200, 83, 0.04) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%);
        }

        /* Glow orb */
        .login-root::after {
          content: '';
          position: absolute;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(0, 200, 83, 0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          padding: 48px 40px 40px;
          background: rgba(14, 14, 14, 0.95);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 4px;
          box-shadow:
            0 0 0 1px rgba(0,200,83,0.05),
            0 32px 64px rgba(0,0,0,0.6),
            inset 0 1px 0 rgba(255,255,255,0.04);
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        .login-card.visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Top accent bar */
        .login-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 40px;
          right: 40px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,200,83,0.5), transparent);
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .brand-icon {
          width: 36px;
          height: 36px;
          background: linear-gradient(135deg, rgba(0,200,83,0.15), rgba(0,200,83,0.05));
          border: 1px solid rgba(0,200,83,0.2);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .brand-name {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 20px;
          font-weight: 600;
          letter-spacing: 0.08em;
          color: #fff;
        }

        .brand-sub {
          font-size: 11px;
          color: #3a3a3a;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          font-family: 'IBM Plex Mono', monospace;
          margin-bottom: 36px;
          padding-left: 48px;
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,0.05);
          margin-bottom: 32px;
        }

        .field {
          margin-bottom: 20px;
        }

        .field-label {
          display: block;
          font-size: 10px;
          font-family: 'IBM Plex Mono', monospace;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #444;
          margin-bottom: 8px;
          transition: color 0.2s;
        }

        .field.focused .field-label {
          color: #00c853;
        }

        .input-wrap {
          position: relative;
        }

        .input-wrap::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: #00c853;
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.25s ease;
        }

        .field.focused .input-wrap::after {
          transform: scaleX(1);
        }

        .login-input {
          width: 100%;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-bottom-color: rgba(255,255,255,0.1);
          border-radius: 3px 3px 0 0;
          padding: 11px 14px;
          color: #e8e8e8;
          font-size: 14px;
          font-family: 'IBM Plex Sans', sans-serif;
          outline: none;
          transition: background 0.2s, border-color 0.2s;
          caret-color: #00c853;
        }

        .login-input:focus {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.1);
        }

        .login-input::placeholder {
          color: #2a2a2a;
        }

        .error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 59, 48, 0.06);
          border: 1px solid rgba(255, 59, 48, 0.2);
          border-radius: 3px;
          padding: 10px 14px;
          color: #ff6b6b;
          font-size: 12px;
          font-family: 'IBM Plex Mono', monospace;
          margin-bottom: 20px;
          animation: shake 0.3s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        .error-icon {
          width: 14px;
          height: 14px;
          border: 1px solid rgba(255, 59, 48, 0.5);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 9px;
          flex-shrink: 0;
          color: #ff6b6b;
          font-family: 'IBM Plex Mono', monospace;
        }

        .submit-btn {
          width: 100%;
          background: #00c853;
          border: none;
          border-radius: 3px;
          padding: 13px;
          color: #000;
          font-size: 13px;
          font-weight: 600;
          font-family: 'IBM Plex Mono', monospace;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: background 0.2s, transform 0.1s;
        }

        .submit-btn:hover:not(:disabled) {
          background: #00e85e;
        }

        .submit-btn:active:not(:disabled) {
          transform: scale(0.99);
        }

        .submit-btn:disabled {
          background: #1a3d28;
          color: #2a6640;
          cursor: not-allowed;
        }

        .submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%);
          transform: translateX(-100%);
        }

        .submit-btn.loading::after {
          animation: shimmer 1.2s ease infinite;
        }

        @keyframes shimmer {
          to { transform: translateX(100%); }
        }

        .footer-note {
          margin-top: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          background: #00c853;
          border-radius: 50%;
          animation: pulse 2s ease infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }

        .footer-text {
          font-size: 10px;
          font-family: 'IBM Plex Mono', monospace;
          color: #2a2a2a;
          letter-spacing: 0.1em;
        }

        .corner-tag {
          position: absolute;
          top: 12px;
          right: 14px;
          font-size: 9px;
          font-family: 'IBM Plex Mono', monospace;
          color: #1e3a28;
          letter-spacing: 0.1em;
        }
      `}</style>

      <div className="login-root">
        <div className={`login-card ${mounted ? 'visible' : ''}`}>
          <span className="corner-tag">v2.0</span>

          <div className="brand">
            <div className="brand-icon">🔥</div>
            <span className="brand-name">TELEGÁS</span>
          </div>
          <div className="brand-sub">Painel de Operações</div>

          <div className="divider" />

          <form onSubmit={handleSubmit} noValidate>
            <div className={`field ${emailFocus ? 'focused' : ''}`}>
              <label className="field-label">Email</label>
              <div className="input-wrap">
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  placeholder="usuario@empresa.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className={`field ${senhaFocus ? 'focused' : ''}`} style={{ marginBottom: 28 }}>
              <label className="field-label">Senha</label>
              <div className="input-wrap">
                <input
                  className="login-input"
                  type="password"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  onFocus={() => setSenhaFocus(true)}
                  onBlur={() => setSenhaFocus(false)}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {erro && (
              <div className="error-box">
                <div className="error-icon">!</div>
                {erro}
              </div>
            )}

            <button
              type="submit"
              className={`submit-btn ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Acessar Painel'}
            </button>
          </form>

          <div className="footer-note">
            <div className="status-dot" />
            <span className="footer-text">Sistema operacional · Jaguarão/RS</span>
          </div>
        </div>
      </div>
    </>
  );
}
