'use client';

import { useState, useEffect, useCallback } from 'react';
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
    // Fix white bars — force background on every container
    document.documentElement.style.background = '#070a0d';
    document.body.style.background = '#070a0d';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.overflowX = 'hidden';

    if (document.getElementById('entregador-fonts')) return;
    const link = document.createElement('link');
    link.id = 'entregador-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.id = 'entregador-styles';
    style.textContent = `
      *, *::before, *::after { box-sizing: border-box; }
      html, body { background: #070a0d !important; margin: 0; padding: 0; }
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(20px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulseDot {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.4; transform: scale(0.7); }
      }
      @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
        50%       { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
      }
      @keyframes shimmerBg {
        0%   { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .card-enter { animation: fadeSlideUp 0.35s cubic-bezier(0.22,1,0.36,1) both; }
      .card-enter:nth-child(1) { animation-delay: 0ms; }
      .card-enter:nth-child(2) { animation-delay: 70ms; }
      .card-enter:nth-child(3) { animation-delay: 140ms; }
      .card-enter:nth-child(4) { animation-delay: 210ms; }
      .tg-input { -webkit-appearance: none; appearance: none; }
      .tg-input:focus {
        border-color: #22c55e !important;
        box-shadow: 0 0 0 4px rgba(34,197,94,0.12) !important;
        outline: none !important;
      }
      .tg-btn-primary:active { transform: scale(0.97); }
      .tg-btn-ghost:active   { opacity: 0.7; }
      .tg-live-dot { animation: pulseDot 2s ease-in-out infinite; }
      .tg-pulse-btn { animation: pulseGlow 2.5s ease-in-out infinite; }
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
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tempoDesde(data: string | null): string {
  if (!data) return '';
  const diff = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff < 60) return `${diff}m`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function formatPhone(tel: string): string {
  const t = tel.replace(/\D/g, '').replace(/^55/, '');
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return tel;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

const F = { outfit: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace" };
const C = {
  bg: '#070a0d',
  surface: '#0d1117',
  surface2: '#111820',
  border: '#1c2128',
  border2: '#21262d',
  text: '#e6edf3',
  muted: '#8b949e',
  dim: '#4b5563',
  green: '#22c55e',
  greenDim: 'rgba(34,197,94,0.08)',
  greenBorder: 'rgba(34,197,94,0.2)',
  orange: '#f97316',
  orangeDim: 'rgba(249,115,22,0.08)',
  orangeBorder: 'rgba(249,115,22,0.2)',
  blue: '#38bdf8',
  blueDim: 'rgba(56,189,248,0.08)',
  blueBorder: 'rgba(56,189,248,0.2)',
  red: '#f87171',
};

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
      fontFamily: F.outfit,
      padding: `max(env(safe-area-inset-top), 24px) env(safe-area-inset-right) max(env(safe-area-inset-bottom), 24px) env(safe-area-inset-left)`,
      overflow: 'auto',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 400, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center bottom, rgba(34,197,94,0.06) 0%, transparent 70%)',
      }} />

      <div style={{ width: '100%', maxWidth: 360, position: 'relative', zIndex: 1 }}>
        {/* Brand mark */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 80, height: 80, borderRadius: 24,
            background: 'linear-gradient(145deg, #0d1a12 0%, #0a1a10 100%)',
            border: `1.5px solid ${C.greenBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            fontSize: 36,
            boxShadow: '0 0 0 1px rgba(34,197,94,0.04), 0 20px 48px rgba(0,0,0,0.6), 0 0 32px rgba(34,197,94,0.1)',
          }}>🔥</div>
          <div style={{
            fontSize: 28, fontWeight: 900, color: C.text,
            letterSpacing: '-0.01em', fontFamily: F.outfit, lineHeight: 1,
          }}>TELEGÁS</div>
          <div style={{
            fontSize: 11, color: C.green, marginTop: 7,
            fontFamily: F.mono, letterSpacing: '0.2em', textTransform: 'uppercase',
          }}>Área do Entregador</div>
        </div>

        {/* Form card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 24,
          padding: '28px 24px 24px',
          boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block', color: C.dim, fontSize: 10, fontWeight: 700,
                fontFamily: F.mono, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8,
              }}>Telefone</label>
              <input
                className="tg-input"
                type="tel" value={telefone} required autoComplete="tel"
                onChange={e => setTelefone(e.target.value)}
                placeholder="(53) 99999-9999"
                style={{
                  width: '100%', background: C.bg, border: `1.5px solid ${C.border2}`,
                  borderRadius: 14, padding: '15px 16px', color: C.text,
                  fontSize: 16, fontFamily: F.outfit, transition: 'all 0.15s',
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{
                display: 'block', color: C.dim, fontSize: 10, fontWeight: 700,
                fontFamily: F.mono, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8,
              }}>Senha</label>
              <input
                className="tg-input"
                type="password" value={senha} required autoComplete="current-password"
                onChange={e => setSenha(e.target.value)}
                placeholder="••••••••"
                style={{
                  width: '100%', background: C.bg, border: `1.5px solid ${C.border2}`,
                  borderRadius: 14, padding: '15px 16px', color: C.text,
                  fontSize: 16, fontFamily: F.outfit, transition: 'all 0.15s',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.18)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 16,
                color: C.red, fontSize: 13, fontFamily: F.outfit, lineHeight: 1.5,
              }}>{error}</div>
            )}

            <button
              type="submit" disabled={loading}
              className="tg-btn-primary"
              style={{
                width: '100%', padding: '16px',
                background: loading ? C.surface2 : `linear-gradient(135deg, ${C.green}, #16a34a)`,
                color: loading ? C.green : '#fff',
                border: 'none', borderRadius: 16,
                fontSize: 16, fontWeight: 700, fontFamily: F.outfit,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(34,197,94,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                transition: 'all 0.2s',
                minHeight: 56,
              }}
            >
              {loading ? (
                <span style={{
                  width: 20, height: 20, border: '2.5px solid rgba(34,197,94,0.3)',
                  borderTopColor: C.green, borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.8s linear infinite',
                }} />
              ) : <>Entrar <span style={{ fontSize: 18 }}>→</span></>}
            </button>
          </form>
        </div>

        {/* Install banner */}
        {installPrompt && (
          <button onClick={onInstall} className="tg-btn-ghost" style={{
            width: '100%', marginTop: 16, padding: '14px 20px',
            background: 'rgba(34,197,94,0.05)', border: `1px solid ${C.greenBorder}`,
            borderRadius: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12, background: C.green,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, flexShrink: 0,
            }}>📲</div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{ color: C.text, fontWeight: 700, fontSize: 14, fontFamily: F.outfit }}>
                Instalar app
              </div>
              <div style={{ color: C.dim, fontSize: 11, fontFamily: F.mono, marginTop: 2 }}>
                Receber notificações de pedidos
              </div>
            </div>
            <div style={{ color: C.green, fontSize: 20, fontWeight: 700 }}>↓</div>
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

  return (
    <div className="card-enter" style={{
      background: C.surface,
      borderRadius: 20,
      overflow: 'hidden',
      marginBottom: 12,
      boxShadow: '0 2px 16px rgba(0,0,0,0.3)',
      border: `1px solid ${C.border}`,
    }}>
      {/* Status strip + header */}
      <div style={{
        background: accentDim,
        borderBottom: `1px solid ${accentBorder}`,
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: accent,
            boxShadow: `0 0 8px ${accent}`,
            flexShrink: 0,
          }} />
          <span style={{
            color: accent, fontSize: 11, fontWeight: 700,
            fontFamily: F.mono, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {isPending ? 'Aguardando aceite' : 'Em rota de entrega'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {pedido.atribuidoEm && (
            <span style={{ color: C.dim, fontSize: 11, fontFamily: F.mono }}>
              {tempoDesde(pedido.atribuidoEm)}
            </span>
          )}
          <span style={{
            color: C.dim, fontSize: 11, fontFamily: F.mono,
            background: C.surface2, padding: '3px 8px', borderRadius: 6,
          }}>
            #{String(pedido.id).padStart(4, '0')}
          </span>
        </div>
      </div>

      <div style={{ padding: '16px 18px 0' }}>
        {/* Client + Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 19, fontWeight: 800, color: C.text,
              fontFamily: F.outfit, letterSpacing: '-0.02em', lineHeight: 1.2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {pedido.nomeCliente || formatPhone(pedido.telefoneCliente)}
            </div>
            {pedido.nomeCliente && (
              <div style={{ color: C.dim, fontSize: 12, fontFamily: F.mono, marginTop: 3 }}>
                {formatPhone(pedido.telefoneCliente)}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
            <div style={{
              fontSize: 22, fontWeight: 900, color: C.text,
              fontFamily: F.outfit, letterSpacing: '-0.03em', lineHeight: 1,
            }}>
              R${pedido.total.toFixed(2).replace('.', ',')}
            </div>
            <div style={{ color: C.dim, fontSize: 9, fontFamily: F.mono, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Total
            </div>
          </div>
        </div>

        {/* Address */}
        <div style={{
          background: C.bg,
          borderLeft: `3px solid ${accent}`,
          borderRadius: '0 12px 12px 0',
          padding: '10px 14px',
          marginBottom: 12,
        }}>
          <div style={{ color: C.dim, fontSize: 10, fontFamily: F.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            📍 Endereço
          </div>
          <div style={{ color: '#c9d1d9', fontSize: 14, fontFamily: F.outfit, fontWeight: 500, lineHeight: 1.5 }}>
            {pedido.endereco}{pedido.bairro ? `, ${pedido.bairro}` : ''}
          </div>
        </div>

        {/* Products */}
        <div style={{
          background: C.bg, borderRadius: 12,
          padding: '10px 14px', marginBottom: 12,
        }}>
          {pedido.produtos?.map((p, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              paddingTop: i > 0 ? 6 : 0,
              marginTop: i > 0 ? 6 : 0,
              borderTop: i > 0 ? `1px solid ${C.border}` : 'none',
            }}>
              <span style={{ color: C.muted, fontSize: 13, fontFamily: F.outfit }}>
                <span style={{ color: C.dim, fontFamily: F.mono, fontSize: 12, marginRight: 4 }}>{p.qtd}×</span>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {pedido.formaPagamento && (
              <span style={{
                background: C.surface2, border: `1px solid ${C.border2}`,
                borderRadius: 10, padding: '5px 12px',
                color: C.muted, fontSize: 12, fontFamily: F.outfit,
              }}>
                💳 {pedido.formaPagamento}
              </span>
            )}
            {pedido.trocoPara && (
              <span style={{
                background: C.orangeDim, border: `1px solid ${C.orangeBorder}`,
                borderRadius: 10, padding: '5px 12px',
                color: '#fb923c', fontSize: 12, fontFamily: F.outfit, fontWeight: 600,
              }}>
                💵 Troco p/ R${pedido.trocoPara.toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ padding: '0 18px 18px', display: 'flex', gap: 10 }}>
        {isPending ? (
          <>
            <button
              onClick={onRecusar} disabled={loading}
              className="tg-btn-ghost"
              style={{
                flex: 1, minHeight: 52, padding: '14px 12px',
                background: 'transparent',
                border: `1.5px solid ${C.border2}`,
                borderRadius: 14, color: C.muted,
                fontSize: 14, fontWeight: 600, fontFamily: F.outfit,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
            >
              Recusar
            </button>
            <button
              onClick={onAceitar} disabled={loading}
              className="tg-btn-primary"
              style={{
                flex: 2.5, minHeight: 52, padding: '14px 16px',
                background: loading ? C.surface2 : `linear-gradient(135deg, ${C.green}, #16a34a)`,
                border: 'none', borderRadius: 14,
                color: loading ? C.green : '#fff',
                fontSize: 15, fontWeight: 700, fontFamily: F.outfit,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 16px rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.15s',
              }}
            >
              {loading
                ? <span style={{ width: 18, height: 18, border: '2.5px solid rgba(34,197,94,0.3)', borderTopColor: C.green, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                : <><span style={{ fontSize: 16 }}>✓</span> Aceitar entrega</>
              }
            </button>
          </>
        ) : (
          <button
            onClick={onEntregar} disabled={loading}
            className={`tg-btn-primary ${loading ? '' : 'tg-pulse-btn'}`}
            style={{
              flex: 1, minHeight: 56, padding: '16px',
              background: loading ? C.surface2 : `linear-gradient(135deg, ${C.green}, #16a34a)`,
              border: 'none', borderRadius: 14,
              color: loading ? C.green : '#fff',
              fontSize: 16, fontWeight: 700, fontFamily: F.outfit,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              letterSpacing: '0.01em',
            }}
          >
            {loading
              ? <span style={{ width: 20, height: 20, border: '2.5px solid rgba(34,197,94,0.3)', borderTopColor: C.green, borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
              : <><span style={{ fontSize: 18 }}>✓</span> Confirmar entrega</>
            }
          </button>
        )}
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
    try { await api.entregarPedido(id, token); await fetchPedidos(token); }
    catch (err: any) { alert(err.message); }
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
  const avatarColors = ['#22c55e', '#38bdf8', '#f97316', '#a78bfa'];
  const avatarColor = avatarColors[nome.charCodeAt(0) % avatarColors.length];

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: F.outfit,
      overflow: 'hidden',
    }}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0,
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        paddingTop: `max(env(safe-area-inset-top), 16px)`,
        paddingLeft: `max(env(safe-area-inset-left), 18px)`,
        paddingRight: `max(env(safe-area-inset-right), 18px)`,
        paddingBottom: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width: 42, height: 42, borderRadius: 14, flexShrink: 0,
            background: `linear-gradient(135deg, ${avatarColor}22, ${avatarColor}11)`,
            border: `2px solid ${avatarColor}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: avatarColor, fontWeight: 800, fontSize: 14, fontFamily: F.outfit }}>
              {initials(nome)}
            </span>
          </div>

          {/* Name + time */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: C.text, fontWeight: 700, fontSize: 16,
              fontFamily: F.outfit, lineHeight: 1, letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{nome}</div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5, marginTop: 4,
            }}>
              <span className="tg-live-dot" style={{
                width: 7, height: 7, borderRadius: '50%', background: C.green,
                display: 'inline-block', flexShrink: 0,
                boxShadow: `0 0 6px ${C.green}`,
              }} />
              <span style={{ color: C.dim, fontSize: 11, fontFamily: F.mono }}>
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
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: C.surface2, border: `1px solid ${C.border2}`,
              color: refreshing ? C.green : C.muted, fontSize: 18,
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
              width: 40, height: 40, borderRadius: 12, flexShrink: 0,
              background: C.surface2, border: `1px solid ${C.border2}`,
              color: C.dim, fontSize: 13, fontFamily: F.mono, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >✕</button>
        </div>
      </div>

      {/* ── Install banner ───────────────────────────────────────────────── */}
      {installPrompt && !installed && (
        <div style={{ flexShrink: 0 }}>
          <button onClick={handleInstall} style={{
            width: '100%', padding: '12px 18px',
            background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.06))',
            borderBottom: `1px solid ${C.greenBorder}`,
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: 18 }}>📲</span>
            <span style={{ color: C.text, fontSize: 13, fontWeight: 600, fontFamily: F.outfit, flex: 1, textAlign: 'left' }}>
              Instalar como app para receber notificações
            </span>
            <span style={{
              background: C.green, color: '#fff', borderRadius: 8,
              padding: '5px 12px', fontSize: 12, fontWeight: 700, fontFamily: F.outfit,
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
            { label: 'Pendentes', value: pendentes, color: C.orange },
            { label: 'Em rota', value: emRota, color: C.blue },
            { label: 'Total', value: pedidos.length, color: C.green },
          ].map((s, i) => (
            <div key={s.label} style={{
              flex: 1, padding: '12px 8px', textAlign: 'center',
              borderRight: i < 2 ? `1px solid ${C.border}` : 'none',
            }}>
              <div style={{ color: s.color, fontWeight: 900, fontSize: 24, fontFamily: F.outfit, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ color: C.dim, fontSize: 9, fontFamily: F.mono, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
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
        paddingLeft: `max(env(safe-area-inset-left), 14px)`,
        paddingRight: `max(env(safe-area-inset-right), 14px)`,
        paddingTop: 14,
        paddingBottom: `max(env(safe-area-inset-bottom), 24px)`,
      }}>
        {pedidos.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            minHeight: '60%', padding: '40px 20px',
            animation: 'fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both',
          }}>
            <div style={{ fontSize: 72, marginBottom: 24, filter: 'drop-shadow(0 4px 16px rgba(0,0,0,0.4))' }}>
              🏁
            </div>
            <div style={{
              color: C.text, fontSize: 22, fontWeight: 800,
              fontFamily: F.outfit, letterSpacing: '-0.02em', marginBottom: 10,
            }}>
              Tudo livre!
            </div>
            <div style={{
              color: C.dim, fontSize: 14, fontFamily: F.outfit,
              lineHeight: 1.6, textAlign: 'center', maxWidth: 240,
            }}>
              Novos pedidos aparecem aqui.{'\n'}
              Atualização automática a cada 30s.
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              marginTop: 28, padding: '10px 20px',
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 100,
            }}>
              <span className={refreshing ? 'tg-live-dot' : ''} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: refreshing ? C.green : C.dim,
                display: 'inline-block', flexShrink: 0,
                boxShadow: refreshing ? `0 0 8px ${C.green}` : 'none',
                transition: 'all 0.3s',
              }} />
              <span style={{ color: C.dim, fontSize: 12, fontFamily: F.mono }}>
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