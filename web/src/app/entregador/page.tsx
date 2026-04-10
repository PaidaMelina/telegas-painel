'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api, API_URL } from '@/lib/api';

// ─── Push helpers ─────────────────────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

async function registerPush(token: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const res = await fetch(`${API_URL}/entregador/vapid-key`);
    if (!res.ok) return;
    const { publicKey } = await res.json();
    if (!publicKey) return;
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
    await fetch(`${API_URL}/entregador/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription }),
    });
  } catch (e) {
    console.warn('Push registration failed:', e);
  }
}

// ─── Fonts & global styles ────────────────────────────────────────────────────

function useFonts() {
  useEffect(() => {
    document.documentElement.style.background = '#0d1424';
    document.body.style.background = '#0d1424';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflowX = 'hidden';

    if (document.getElementById('entregador-fonts')) return;
    const link = document.createElement('link');
    link.id = 'entregador-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.id = 'entregador-styles';
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      html, body { background: #0d1424 !important; margin: 0; padding: 0; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(16px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.4; transform: scale(0.7); }
      }
      @keyframes successPop {
        0%   { opacity: 0; transform: scale(0.85); }
        60%  { transform: scale(1.04); }
        100% { opacity: 1; transform: scale(1); }
      }
      @keyframes checkDraw {
        from { stroke-dashoffset: 60; }
        to   { stroke-dashoffset: 0; }
      }
      .card-enter { animation: fadeSlideUp 0.3s cubic-bezier(0.22,1,0.36,1) both; }
      .card-enter:nth-child(1) { animation-delay: 0ms; }
      .card-enter:nth-child(2) { animation-delay: 60ms; }
      .card-enter:nth-child(3) { animation-delay: 120ms; }
      .card-enter:nth-child(4) { animation-delay: 180ms; }
      .tg-input { -webkit-appearance: none; appearance: none; }
      .tg-input:focus {
        border-color: #2557e7 !important;
        box-shadow: 0 0 0 3px rgba(37,87,231,0.18) !important;
        outline: none !important;
      }
      .tg-btn:active { transform: scale(0.97); }
      .tg-live-dot { animation: pulseDot 2s ease-in-out infinite; }
      .success-pop { animation: successPop 0.45s cubic-bezier(0.22,1,0.36,1) both; }
    `;
    document.head.appendChild(style);
  }, []);
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Pedido = {
  id: number;
  status: 'atribuido' | 'saiu_para_entrega';
  nomeCliente: string | null;
  telefoneCliente: string;
  endereco: string;
  bairro: string | null;
  total: number;
  produtos: { produto?: string; nome?: string; qtd: number; preco: number }[];
  trocoPara: number | null;
  formaPagamento: string | null;
  atribuidoEm: string | null;
  lat?: number;
  lng?: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────


function formatPhone(tel: string): string {
  const t = tel.replace(/\D/g, '').replace(/^55/, '');
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return tel;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function formatElapsed(seconds: number): string {
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

const F = { sora: "'Sora', sans-serif", mono: "'JetBrains Mono', monospace" };
const C = {
  bg: '#0d1424',
  surface: '#111c2e',
  surface2: '#162032',
  border: 'rgba(255,255,255,0.07)',
  borderActive: 'rgba(37,87,231,0.35)',
  text: 'rgba(255,255,255,0.92)',
  secondary: 'rgba(255,255,255,0.55)',
  muted: 'rgba(255,255,255,0.25)',
  accent: '#2557e7',
  accentDim: 'rgba(37,87,231,0.10)',
  accentBorder: 'rgba(37,87,231,0.30)',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.08)',
  greenBorder: 'rgba(34,197,94,0.25)',
  orange: '#f97316',
  orangeDim: 'rgba(249,115,22,0.08)',
  orangeBorder: 'rgba(249,115,22,0.25)',
  blue: '#38bdf8',
  blueDim: 'rgba(56,189,248,0.08)',
  blueBorder: 'rgba(56,189,248,0.25)',
  red: '#f87171',
};

// ─── LiveTimer ────────────────────────────────────────────────────────────────

function LiveTimer({ startDate, status }: { startDate: string; status: 'atribuido' | 'saiu_para_entrega' }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(startDate).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [startDate]);

  const isPending = status === 'atribuido';
  const color = isPending ? C.orange : C.blue;
  const label = isPending ? '⏱ Aguardando' : '🚀 Em rota';

  return (
    <span style={{
      color,
      fontFamily: F.mono,
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: '0.04em',
    }}>
      {label} {formatElapsed(elapsed)}
    </span>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({
  onLogin,
  installPrompt,
  onInstall,
}: {
  onLogin: (token: string, nome: string) => void;
  installPrompt: any;
  onInstall: () => void;
}) {
  useFonts();
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.entregadorLogin(telefone, senha);
      onLogin(data.token, data.entregador.nome);
    } catch (err: any) {
      setError(err.message || 'Telefone ou senha incorretos');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.bg,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: F.sora,
      padding: `max(env(safe-area-inset-top), 24px) env(safe-area-inset-right) max(env(safe-area-inset-bottom), 24px) env(safe-area-inset-left)`,
      overflow: 'auto',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 500, height: 500, pointerEvents: 'none',
        background: 'radial-gradient(ellipse, rgba(37,87,231,0.07) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: 360, position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: C.accentDim,
            border: `1.5px solid ${C.accentBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 0 40px rgba(37,87,231,0.15)',
          }}>
            <span style={{ fontSize: 32 }}>🔥</span>
          </div>
          <div style={{
            fontSize: 26, fontWeight: 800, color: C.text,
            fontFamily: F.sora, letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>TELEGÁS</div>
          <div style={{
            fontSize: 10, color: C.accent, marginTop: 6,
            fontFamily: F.mono, letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>ÁREA DO ENTREGADOR</div>
        </div>

        {/* Form card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: '24px 20px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: 'block', color: C.muted, fontSize: 10, fontWeight: 700,
                fontFamily: F.mono, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
              }}>Telefone</label>
              <input
                className="tg-input"
                type="tel" value={telefone} required autoComplete="tel"
                onChange={e => setTelefone(e.target.value)}
                placeholder="(53) 99999-9999"
                style={{
                  width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '13px 14px', color: C.text,
                  fontSize: 15, fontFamily: F.sora, transition: 'all 0.15s',
                }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: 'block', color: C.muted, fontSize: 10, fontWeight: 700,
                fontFamily: F.mono, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8,
              }}>Senha</label>
              <input
                className="tg-input"
                type="password" value={senha} required autoComplete="current-password"
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '13px 14px', color: C.text,
                  fontSize: 15, fontFamily: F.sora, transition: 'all 0.15s',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 8, padding: '11px 14px', marginBottom: 14,
                color: C.red, fontSize: 13, fontFamily: F.sora, lineHeight: 1.5,
              }}>{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="tg-btn"
              style={{
                width: '100%', padding: '15px',
                background: loading ? C.surface2 : C.accent,
                color: '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 14, fontWeight: 700, fontFamily: F.sora,
                letterSpacing: '0.06em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(37,87,231,0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 0.2s',
                minHeight: 52,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <span style={{
                  width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.8s linear infinite',
                }} />
              ) : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Install banner */}
        {installPrompt && (
          <button onClick={onInstall} className="tg-btn" style={{
            width: '100%', marginTop: 12, padding: '13px 16px',
            background: C.accentDim, border: `1px solid ${C.accentBorder}`,
            borderRadius: 8, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>📲</span>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 13, fontFamily: F.sora }}>
                Instalar app
              </div>
              <div style={{ color: C.muted, fontSize: 11, fontFamily: F.mono, marginTop: 2, letterSpacing: '0.04em' }}>
                Receber notificações de pedidos
              </div>
            </div>
            <span style={{ color: C.accent, fontSize: 14, fontWeight: 700, fontFamily: F.mono }}>↓</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Pedido Card ─────────────────────────────────────────────────────────────

function PedidoCard({
  pedido, onAceitar, onEntregar, onRecusar, loading,
}: {
  pedido: Pedido;
  onAceitar: () => void;
  onEntregar: () => void;
  onRecusar: () => void;
  loading: boolean;
}) {
  const isPending = pedido.status === 'atribuido';
  const accent = isPending ? C.orange : C.blue;
  const accentDim = isPending ? C.orangeDim : C.blueDim;
  const accentBorder = isPending ? C.orangeBorder : C.blueBorder;

  function openMaps() {
    let url: string;
    if (pedido.lat != null && pedido.lng != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${pedido.lat},${pedido.lng}`;
    } else {
      const addr = [pedido.endereco, pedido.bairro].filter(Boolean).join(', ');
      url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
    }
    window.open(url, '_blank');
  }

  return (
    <div className="card-enter" style={{
      background: C.surface,
      borderRadius: 10,
      overflow: 'hidden',
      marginBottom: 10,
      border: `1px solid ${C.border}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
    }}>
      {/* Status header */}
      <div style={{
        background: accentDim,
        borderBottom: `1px solid ${accentBorder}`,
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%', background: accent,
            flexShrink: 0, boxShadow: `0 0 6px ${accent}`,
          }} />
          {pedido.atribuidoEm ? (
            <LiveTimer startDate={pedido.atribuidoEm} status={pedido.status} />
          ) : (
            <span style={{ color: accent, fontSize: 11, fontFamily: F.mono, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {isPending ? 'AGUARDANDO ACEITE' : 'EM ROTA'}
            </span>
          )}
        </div>
        <span style={{
          color: C.muted, fontSize: 11, fontFamily: F.mono, fontWeight: 700,
          background: C.surface2, padding: '3px 8px', borderRadius: 5, flexShrink: 0,
          letterSpacing: '0.06em',
        }}>
          #{String(pedido.id).padStart(4, '0')}
        </span>
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        {/* Client + Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 17, fontWeight: 700, color: C.text,
              fontFamily: F.sora, lineHeight: 1.2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {pedido.nomeCliente || formatPhone(pedido.telefoneCliente)}
            </div>
            {pedido.nomeCliente && (
              <div style={{ color: C.muted, fontSize: 11, fontFamily: F.mono, marginTop: 3, letterSpacing: '0.04em' }}>
                {formatPhone(pedido.telefoneCliente)}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 14 }}>
            <div style={{
              fontSize: 20, fontWeight: 700, color: C.text,
              fontFamily: F.mono, lineHeight: 1,
            }}>
              R${pedido.total.toFixed(2).replace('.', ',')}
            </div>
            <div style={{ color: C.muted, fontSize: 9, fontFamily: F.mono, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Total
            </div>
          </div>
        </div>

        {/* Address */}
        <div style={{
          background: C.bg,
          borderLeft: `2px solid ${accent}`,
          borderRadius: '0 8px 8px 0',
          padding: '9px 12px',
          marginBottom: 10,
        }}>
          <div style={{ color: C.muted, fontSize: 9, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>
            📍 ENDEREÇO
          </div>
          <div style={{ color: C.secondary, fontSize: 13, fontFamily: F.sora, fontWeight: 500, lineHeight: 1.5 }}>
            {pedido.endereco}{pedido.bairro ? `, ${pedido.bairro}` : ''}
          </div>
        </div>

        {/* Products */}
        <div style={{
          background: C.bg, borderRadius: 8,
          padding: '9px 12px', marginBottom: 10,
          border: `1px solid ${C.border}`,
        }}>
          {pedido.produtos?.map((p, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: i > 0 ? 7 : 0,
              marginTop: i > 0 ? 7 : 0,
              borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{ color: C.secondary, fontSize: 13, fontFamily: F.sora }}>
                <span style={{ color: C.muted, fontFamily: F.mono, fontSize: 11, marginRight: 6, letterSpacing: '0.04em' }}>{p.qtd}×</span>
                {p.nome || p.produto}
              </span>
              <span style={{ color: C.text, fontSize: 12, fontFamily: F.mono, fontWeight: 600 }}>
                R${(p.preco * p.qtd).toFixed(2).replace('.', ',')}
              </span>
            </div>
          ))}
        </div>

        {/* Payment badges */}
        {(pedido.formaPagamento || pedido.trocoPara) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {pedido.formaPagamento && (
              <span style={{
                background: C.surface2, border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '4px 10px',
                color: C.secondary, fontSize: 11, fontFamily: F.mono,
                letterSpacing: '0.04em',
              }}>
                💳 {pedido.formaPagamento}
              </span>
            )}
            {pedido.trocoPara && (
              <span style={{
                background: C.orangeDim, border: `1px solid ${C.orangeBorder}`,
                borderRadius: 6, padding: '4px 10px',
                color: C.orange, fontSize: 11, fontFamily: F.mono, fontWeight: 700,
                letterSpacing: '0.04em',
              }}>
                💵 TROCO P/ R${pedido.trocoPara.toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Como chegar */}
        <button
          onClick={openMaps}
          className="tg-btn"
          style={{
            width: '100%', minHeight: 44, padding: '12px',
            background: 'transparent',
            border: `1px solid ${C.accentBorder}`,
            borderRadius: 8, color: C.accent,
            fontSize: 13, fontWeight: 700, fontFamily: F.sora,
            letterSpacing: '0.06em',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 16 }}>📍</span> COMO CHEGAR
        </button>

        {/* Accept / refuse / deliver */}
        {isPending ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onRecusar} disabled={loading}
              className="tg-btn"
              style={{
                flex: 1, minHeight: 52, padding: '14px 10px',
                background: 'transparent',
                border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.secondary,
                fontSize: 13, fontWeight: 600, fontFamily: F.sora,
                letterSpacing: '0.04em',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
            >
              Recusar
            </button>
            <button
              onClick={onAceitar} disabled={loading}
              className="tg-btn"
              style={{
                flex: 2.5, minHeight: 52, padding: '14px 14px',
                background: loading ? C.surface2 : C.green,
                border: 'none', borderRadius: 8,
                color: '#fff',
                fontSize: 13, fontWeight: 700, fontFamily: F.sora,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? <span style={{ width: 17, height: 17, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <><span style={{ fontSize: 15 }}>✓</span> Aceitar</>
              }
            </button>
          </div>
        ) : (
          <button
            onClick={onEntregar} disabled={loading}
            className="tg-btn"
            style={{
              width: '100%', minHeight: 54, padding: '15px',
              background: loading ? C.surface2 : C.green,
              border: 'none', borderRadius: 8,
              color: '#fff',
              fontSize: 14, fontWeight: 700, fontFamily: F.sora,
              letterSpacing: '0.08em', textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(34,197,94,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              transition: 'all 0.15s',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? <span style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : <><span style={{ fontSize: 17 }}>✓</span> Confirmar Entrega</>
            }
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Success Overlay ──────────────────────────────────────────────────────────

function SuccessOverlay({ nomeCliente, totalTime, onClose }: { nomeCliente: string; totalTime: string; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(7,12,20,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      backdropFilter: 'blur(8px)',
    }}>
      <div className="success-pop" style={{
        background: C.surface,
        border: `1px solid ${C.greenBorder}`,
        borderRadius: 16,
        padding: '40px 32px',
        textAlign: 'center',
        maxWidth: 320,
        width: '100%',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 60px rgba(34,197,94,0.08)',
      }}>
        {/* Check circle */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(34,197,94,0.12)',
          border: `2px solid ${C.greenBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 40,
          boxShadow: '0 0 40px rgba(34,197,94,0.2)',
        }}>
          ✓
        </div>

        <div style={{
          fontSize: 26, fontWeight: 800, color: C.green,
          fontFamily: F.sora, letterSpacing: '0.06em', textTransform: 'uppercase',
          marginBottom: 8,
        }}>
          Entregue!
        </div>

        <div style={{
          fontSize: 15, color: C.secondary, fontFamily: F.sora, marginBottom: 20,
        }}>
          {nomeCliente}
        </div>

        <div style={{
          background: C.bg, border: `1px solid ${C.border}`,
          borderRadius: 8, padding: '12px 20px', marginBottom: 28,
          display: 'inline-block',
        }}>
          <div style={{ color: C.muted, fontSize: 9, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>
            TEMPO TOTAL
          </div>
          <div style={{ color: C.text, fontSize: 22, fontFamily: F.mono, fontWeight: 700 }}>
            {totalTime}
          </div>
        </div>

        <button
          onClick={onClose}
          className="tg-btn"
          style={{
            width: '100%', padding: '14px',
            background: C.green, border: 'none', borderRadius: 8,
            color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: F.sora,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
          }}
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function EntregadorPage() {
  useFonts();

  const [token, setToken] = useState<string | null>(null);
  const [nome, setNome] = useState('');
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loadingAction, setLoadingAction] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [successPedido, setSuccessPedido] = useState<{ id: number; nomeCliente: string; totalTime: string } | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // Capture install prompt
  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler as any);
    window.addEventListener('appinstalled', () => { setInstalled(true); setInstallPrompt(null); });
    return () => window.removeEventListener('beforeinstallprompt', handler as any);
  }, []);

  // Restore session
  useEffect(() => {
    const t = localStorage.getItem('entregador_token');
    const n = localStorage.getItem('entregador_nome');
    if (t) { setToken(t); setNome(n || ''); registerPush(t); }
  }, []);

  const fetchPedidos = useCallback(async (t: string) => {
    setRefreshing(true);
    try {
      const data = await api.getMeusPedidos(t);
      setPedidos(data);
      setLastUpdate(new Date());
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Não autorizado')) handleLogout();
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchPedidos(token);
    const iv = setInterval(() => fetchPedidos(token), 30000);
    return () => clearInterval(iv);
  }, [token, fetchPedidos]);

  function handleLogin(newToken: string, entregadorNome: string) {
    localStorage.setItem('entregador_token', newToken);
    localStorage.setItem('entregador_nome', entregadorNome);
    setToken(newToken);
    setNome(entregadorNome);
    registerPush(newToken);
  }

  function handleLogout() {
    localStorage.removeItem('entregador_token');
    localStorage.removeItem('entregador_nome');
    setToken(null); setNome(''); setPedidos([]);
  }

  async function handleInstall() {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') { setInstalled(true); setInstallPrompt(null); }
  }

  async function handleAceitar(id: number) {
    if (!token) return;
    setLoadingAction(id);
    try { await api.aceitarPedido(id, token); await fetchPedidos(token); }
    catch (err: any) { alert(err.message); }
    finally { setLoadingAction(null); }
  }

  async function handleEntregar(id: number) {
    if (!token) return;
    setLoadingAction(id);
    const pedido = pedidos.find(p => p.id === id);
    try {
      await api.entregarPedido(id, token);
      // Calculate elapsed time
      let totalTime = '';
      if (pedido?.atribuidoEm) {
        const seconds = Math.floor((Date.now() - new Date(pedido.atribuidoEm).getTime()) / 1000);
        totalTime = formatElapsed(seconds);
      }
      const nomeCliente = pedido?.nomeCliente || (pedido ? formatPhone(pedido.telefoneCliente) : '');
      setSuccessPedido({ id, nomeCliente, totalTime });
      // Auto-dismiss after 8s
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setSuccessPedido(null), 8000);
      await fetchPedidos(token);
    } catch (err: any) { alert(err.message); }
    finally { setLoadingAction(null); }
  }

  async function handleRecusar(id: number) {
    if (!token) return;
    setLoadingAction(id);
    try { await api.recusarPedido(id, token); await fetchPedidos(token); }
    catch (err: any) { alert(err.message); }
    finally { setLoadingAction(null); }
  }

  if (!token) {
    return <LoginScreen onLogin={handleLogin} installPrompt={installPrompt} onInstall={handleInstall} />;
  }

  const pendentes = pedidos.filter(p => p.status === 'atribuido').length;
  const emRota = pedidos.filter(p => p.status === 'saiu_para_entrega').length;

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: F.sora,
      overflow: 'hidden',
    }}>
      {/* Success overlay */}
      {successPedido && (
        <SuccessOverlay
          nomeCliente={successPedido.nomeCliente}
          totalTime={successPedido.totalTime}
          onClose={() => { setSuccessPedido(null); if (successTimerRef.current) clearTimeout(successTimerRef.current); }}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        paddingTop: `max(env(safe-area-inset-top), 14px)`,
        paddingLeft: `max(env(safe-area-inset-left), 16px)`,
        paddingRight: `max(env(safe-area-inset-right), 16px)`,
        paddingBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Avatar */}
          <div style={{
            width: 38, height: 38, borderRadius: 8, flexShrink: 0,
            background: C.accentDim,
            border: `1px solid ${C.accentBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 16px rgba(37,87,231,0.15)',
          }}>
            <span style={{ color: C.accent, fontWeight: 800, fontSize: 13, fontFamily: F.sora }}>
              {initials(nome)}
            </span>
          </div>

          {/* Name + time */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: C.text, fontWeight: 700, fontSize: 14,
              fontFamily: F.sora, lineHeight: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{nome}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
              <span className="tg-live-dot" style={{
                width: 6, height: 6, borderRadius: '50%', background: C.green,
                display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ color: C.muted, fontSize: 10, fontFamily: F.mono, letterSpacing: '0.04em' }}>
                {lastUpdate
                  ? lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : 'conectando…'}
              </span>
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={() => token && fetchPedidos(token)}
            disabled={refreshing}
            style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: C.surface2, border: `1px solid ${C.border}`,
              color: refreshing ? C.green : C.muted, fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
              transition: 'color 0.15s',
            }}
          >↻</button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              background: C.surface2, border: `1px solid ${C.border}`,
              color: C.muted, fontSize: 11, fontFamily: F.mono, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', letterSpacing: '0.04em',
            }}
          >✕</button>
        </div>
      </div>

      {/* ── Install banner ───────────────────────────────────────────────── */}
      {installPrompt && !installed && (
        <div style={{ flexShrink: 0 }}>
          <button onClick={handleInstall} style={{
            width: '100%', padding: '11px 16px',
            background: C.accentDim,
            borderBottom: `1px solid ${C.accentBorder}`,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 16 }}>📲</span>
            <span style={{ color: C.text, fontSize: 12, fontWeight: 600, fontFamily: F.sora, flex: 1, textAlign: 'left' }}>
              Instalar como app para receber notificações
            </span>
            <span style={{
              background: C.accent, color: '#fff', borderRadius: 6,
              padding: '4px 10px', fontSize: 11, fontWeight: 700, fontFamily: F.mono,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Instalar</span>
          </button>
        </div>
      )}

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      {pedidos.length > 0 && (
        <div style={{
          flexShrink: 0,
          display: 'flex',
          background: C.bg,
          borderBottom: `1px solid ${C.border}`,
        }}>
          {[
            { label: 'PENDENTES', value: pendentes, color: C.orange },
            { label: 'EM ROTA', value: emRota, color: C.blue },
            { label: 'TOTAL', value: pedidos.length, color: C.green },
          ].map((s, i) => (
            <div key={s.label} style={{
              flex: 1, padding: '10px 6px', textAlign: 'center',
              borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ color: s.color, fontWeight: 800, fontSize: 22, fontFamily: F.sora, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ color: C.muted, fontSize: 9, fontFamily: F.mono, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch' as any,
        paddingLeft: `max(env(safe-area-inset-left), 12px)`,
        paddingRight: `max(env(safe-area-inset-right), 12px)`,
        paddingTop: 12,
        paddingBottom: `max(env(safe-area-inset-bottom), 20px)`,
      }}>
        {pedidos.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            minHeight: '60%', padding: '40px 20px',
            animation: 'fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ fontSize: 60, marginBottom: 20, opacity: 0.5 }}>🏁</div>
            <div style={{
              color: C.text, fontSize: 20, fontWeight: 800,
              fontFamily: F.sora, letterSpacing: '0.04em', textTransform: 'uppercase',
              marginBottom: 10,
            }}>
              Tudo livre!
            </div>
            <div style={{
              color: C.muted, fontSize: 13, fontFamily: F.sora,
              lineHeight: 1.6, textAlign: 'center', maxWidth: 220,
            }}>
              Novos pedidos aparecem aqui automaticamente.
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              marginTop: 24, padding: '9px 18px',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 100,
            }}>
              <span className={refreshing ? 'tg-live-dot' : ''} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: refreshing ? C.green : C.muted,
                display: 'inline-block', flexShrink: 0,
                transition: 'all 0.3s',
              }} />
              <span style={{ color: C.muted, fontSize: 11, fontFamily: F.mono, letterSpacing: '0.06em' }}>
                {refreshing ? 'Atualizando…' : 'Aguardando pedidos'}
              </span>
            </div>
          </div>
        ) : (
          pedidos.map(p => (
            <PedidoCard
              key={p.id} pedido={p}
              loading={loadingAction === p.id}
              onAceitar={() => handleAceitar(p.id)}
              onEntregar={() => handleEntregar(p.id)}
              onRecusar={() => handleRecusar(p.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
