'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

// ─── Inject Google Fonts ──────────────────────────────────────────────────────
function useFonts() {
  useEffect(() => {
    if (document.getElementById('entregador-fonts')) return;
    const link = document.createElement('link');
    link.id = 'entregador-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap';
    document.head.appendChild(link);

    const style = document.createElement('style');
    style.id = 'entregador-styles';
    style.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
      @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes pulse-ring {
        0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
        70% { box-shadow: 0 0 0 8px rgba(34,197,94,0); }
        100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
      }
      @keyframes shimmer {
        0% { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
      .entregador-card { animation: fadeUp 0.3s ease both; }
      .entregador-card:nth-child(1) { animation-delay: 0ms; }
      .entregador-card:nth-child(2) { animation-delay: 60ms; }
      .entregador-card:nth-child(3) { animation-delay: 120ms; }
      .btn-aceitar:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); transition: all 0.15s; }
      .btn-entregar:hover:not(:disabled) { filter: brightness(1.1); transform: translateY(-1px); transition: all 0.15s; }
      .btn-recusar:hover:not(:disabled) { border-color: #f87171 !important; color: #f87171 !important; }
      .input-entregador:focus { border-color: #22c55e !important; box-shadow: 0 0 0 3px rgba(34,197,94,0.12) !important; }
    `;
    document.head.appendChild(style);
    return () => {};
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
  if (diff < 60) return `${diff} min atrás`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}min atrás` : `${h}h atrás`;
}

function formatPhone(tel: string): string {
  const t = tel.replace(/\D/g, '').replace(/^55/, '');
  if (t.length === 11) return `(${t.slice(0, 2)}) ${t.slice(2, 7)}-${t.slice(7)}`;
  if (t.length === 10) return `(${t.slice(0, 2)}) ${t.slice(2, 6)}-${t.slice(6)}`;
  return tel;
}

const F = { outfit: "'Outfit', sans-serif", mono: "'JetBrains Mono', monospace" };

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string, nome: string) => void }) {
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
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#070a0d',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: F.outfit,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute',
        bottom: '-80px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '500px',
        height: '300px',
        background: 'radial-gradient(ellipse, rgba(34,197,94,0.07) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      }} />

      {/* Brand */}
      <div style={{ marginBottom: 36, textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: 'linear-gradient(135deg, #0d1a12, #0f2018)',
          border: '1px solid rgba(34,197,94,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
          fontSize: 28,
          boxShadow: '0 0 24px rgba(34,197,94,0.15)',
        }}>🔥</div>
        <h1 style={{
          color: '#f0fdf4',
          fontSize: 32,
          fontWeight: 800,
          margin: 0,
          letterSpacing: '-0.02em',
          fontFamily: F.outfit,
        }}>
          TELEGÁS
        </h1>
        <p style={{
          color: '#4ade80',
          fontSize: 11,
          margin: '6px 0 0',
          fontFamily: F.mono,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}>
          Área do Entregador
        </p>
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 380,
          background: '#0d1117',
          border: '1px solid #1c2128',
          borderRadius: 20,
          padding: '32px 28px',
          position: 'relative',
          zIndex: 1,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(34,197,94,0.05)',
        }}
      >
        <div style={{ marginBottom: 22 }}>
          <label style={{
            display: 'block',
            color: '#6b7280',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: F.mono,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Telefone
          </label>
          <input
            className="input-entregador"
            type="tel"
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder="(53) 99999-9999"
            required
            autoComplete="tel"
            style={{
              width: '100%',
              background: '#070a0d',
              border: '1px solid #21262d',
              borderRadius: 12,
              padding: '14px 16px',
              color: '#e6edf3',
              fontSize: 16,
              fontFamily: F.outfit,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
        </div>

        <div style={{ marginBottom: 28 }}>
          <label style={{
            display: 'block',
            color: '#6b7280',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: F.mono,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: 8,
          }}>
            Senha
          </label>
          <input
            className="input-entregador"
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            style={{
              width: '100%',
              background: '#070a0d',
              border: '1px solid #21262d',
              borderRadius: 12,
              padding: '14px 16px',
              color: '#e6edf3',
              fontSize: 16,
              fontFamily: F.outfit,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 10,
            padding: '12px 14px',
            color: '#fca5a5',
            fontSize: 13,
            fontFamily: F.outfit,
            marginBottom: 20,
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '15px',
            background: loading
              ? '#1a2a1e'
              : 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: loading ? '#4ade80' : '#fff',
            border: 'none',
            borderRadius: 12,
            fontSize: 15,
            fontWeight: 700,
            fontFamily: F.outfit,
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '0.02em',
            boxShadow: loading ? 'none' : '0 4px 16px rgba(34,197,94,0.3)',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {loading ? (
            <>
              <span style={{
                width: 16, height: 16,
                border: '2px solid rgba(74,222,128,0.3)',
                borderTopColor: '#4ade80',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }} />
              Entrando…
            </>
          ) : 'Entrar →'}
        </button>
      </form>

      <p style={{
        color: '#374151',
        fontSize: 11,
        fontFamily: F.mono,
        marginTop: 28,
        letterSpacing: '0.08em',
        position: 'relative', zIndex: 1,
      }}>
        TELEGÁS · JAGUARÃO/RS
      </p>
    </div>
  );
}

// ─── Pedido Card ─────────────────────────────────────────────────────────────

function PedidoCard({
  pedido,
  onAceitar,
  onEntregar,
  onRecusar,
  loading,
}: {
  pedido: Pedido;
  onAceitar: () => void;
  onEntregar: () => void;
  onRecusar: () => void;
  loading: boolean;
}) {
  const isAtribuido = pedido.status === 'atribuido';
  const statusColor = isAtribuido ? '#f97316' : '#38bdf8';
  const statusBg = isAtribuido ? 'rgba(249,115,22,0.08)' : 'rgba(56,189,248,0.08)';
  const statusBorder = isAtribuido ? 'rgba(249,115,22,0.2)' : 'rgba(56,189,248,0.2)';

  return (
    <div className="entregador-card" style={{
      background: '#0d1117',
      border: `1px solid ${isAtribuido ? 'rgba(249,115,22,0.15)' : 'rgba(56,189,248,0.15)'}`,
      borderTop: `3px solid ${statusColor}`,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* Card Header */}
      <div style={{
        padding: '16px 18px 14px',
        borderBottom: '1px solid #1c2128',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}>
        <div>
          {/* Status pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: statusBg,
            border: `1px solid ${statusBorder}`,
            borderRadius: 100,
            padding: '4px 10px 4px 8px',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 11 }}>{isAtribuido ? '⏳' : '🚀'}</span>
            <span style={{
              color: statusColor,
              fontSize: 10,
              fontWeight: 700,
              fontFamily: F.mono,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              {isAtribuido ? 'Aguardando' : 'Em rota'}
            </span>
          </div>
          <div style={{
            color: '#6b7280',
            fontSize: 11,
            fontFamily: F.mono,
          }}>
            #{String(pedido.id).padStart(4, '0')} · {tempoDesde(pedido.atribuidoEm)}
          </div>
        </div>

        {/* Total */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            color: '#e6edf3',
            fontWeight: 800,
            fontSize: 22,
            fontFamily: F.outfit,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            R${pedido.total.toFixed(2).replace('.', ',')}
          </div>
          <div style={{ color: '#4b5563', fontSize: 10, fontFamily: F.mono, marginTop: 3 }}>
            TOTAL
          </div>
        </div>
      </div>

      {/* Cliente + Endereço */}
      <div style={{ padding: '14px 18px 0' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{
            color: '#e6edf3',
            fontWeight: 700,
            fontSize: 17,
            fontFamily: F.outfit,
            marginBottom: 2,
          }}>
            {pedido.nomeCliente || formatPhone(pedido.telefoneCliente)}
          </div>
          {pedido.nomeCliente && (
            <div style={{ color: '#4b5563', fontSize: 12, fontFamily: F.mono }}>
              {formatPhone(pedido.telefoneCliente)}
            </div>
          )}
        </div>

        {/* Address box */}
        <div style={{
          background: '#070a0d',
          borderLeft: `3px solid ${statusColor}`,
          borderRadius: '0 8px 8px 0',
          padding: '10px 12px',
          marginBottom: 14,
        }}>
          <div style={{
            color: '#4b5563',
            fontSize: 10,
            fontFamily: F.mono,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            📍 Endereço
          </div>
          <div style={{
            color: '#c9d1d9',
            fontSize: 14,
            fontFamily: F.outfit,
            lineHeight: 1.5,
            fontWeight: 500,
          }}>
            {pedido.endereco}{pedido.bairro ? `, ${pedido.bairro}` : ''}
          </div>
        </div>

        {/* Produtos */}
        <div style={{
          background: '#070a0d',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 12,
        }}>
          {pedido.produtos?.map((p, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '3px 0',
              borderBottom: i < pedido.produtos.length - 1 ? '1px solid #1c2128' : 'none',
            }}>
              <span style={{ color: '#9ca3af', fontSize: 13, fontFamily: F.outfit }}>
                <span style={{ color: '#6b7280', fontFamily: F.mono, fontSize: 12 }}>{p.qtd}×</span>{' '}
                {p.nome || p.produto}
              </span>
              <span style={{ color: '#e6edf3', fontSize: 12, fontFamily: F.mono, fontWeight: 500 }}>
                R${(p.preco * p.qtd).toFixed(2).replace('.', ',')}
              </span>
            </div>
          ))}
        </div>

        {/* Pagamento + Troco */}
        {(pedido.formaPagamento || pedido.trocoPara) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
            {pedido.formaPagamento && (
              <span style={{
                background: '#161b22',
                border: '1px solid #21262d',
                borderRadius: 8,
                padding: '5px 10px',
                fontSize: 12,
                color: '#8b949e',
                fontFamily: F.outfit,
              }}>
                💳 {pedido.formaPagamento}
              </span>
            )}
            {pedido.trocoPara && (
              <span style={{
                background: 'rgba(249,115,22,0.06)',
                border: '1px solid rgba(249,115,22,0.2)',
                borderRadius: 8,
                padding: '5px 10px',
                fontSize: 12,
                color: '#fb923c',
                fontFamily: F.outfit,
                fontWeight: 600,
              }}>
                💵 Troco p/ R${pedido.trocoPara.toFixed(2).replace('.', ',')}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ padding: '0 18px 18px' }}>
        {isAtribuido ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn-recusar"
              onClick={onRecusar}
              disabled={loading}
              style={{
                flex: 1,
                padding: '13px 12px',
                background: 'transparent',
                border: '1px solid #21262d',
                borderRadius: 12,
                color: '#6b7280',
                fontSize: 14,
                fontWeight: 600,
                fontFamily: F.outfit,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.4 : 1,
                transition: 'all 0.15s',
              }}
            >
              Recusar
            </button>
            <button
              className="btn-aceitar"
              onClick={onAceitar}
              disabled={loading}
              style={{
                flex: 2,
                padding: '13px 12px',
                background: loading ? '#1a2a1e' : 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none',
                borderRadius: 12,
                color: loading ? '#4ade80' : '#fff',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: F.outfit,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 12px rgba(34,197,94,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {loading ? (
                <span style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(74,222,128,0.3)',
                  borderTopColor: '#4ade80',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }} />
              ) : '✓'} {loading ? '' : 'Aceitar entrega'}
            </button>
          </div>
        ) : (
          <button
            className="btn-entregar"
            onClick={onEntregar}
            disabled={loading}
            style={{
              width: '100%',
              padding: '15px',
              background: loading ? '#1a2a1e' : 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
              borderRadius: 12,
              color: loading ? '#4ade80' : '#fff',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: F.outfit,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.01em',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(34,197,94,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              animation: loading ? 'none' : 'pulse-ring 2s ease-in-out infinite',
            }}
          >
            {loading ? (
              <span style={{
                width: 16, height: 16,
                border: '2px solid rgba(74,222,128,0.3)',
                borderTopColor: '#4ade80',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : '✓'} {loading ? 'Aguarde…' : 'Confirmar entrega'}
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

  // Restore session from localStorage
  useEffect(() => {
    const t = localStorage.getItem('entregador_token');
    const n = localStorage.getItem('entregador_nome');
    if (t) { setToken(t); setNome(n || ''); }
  }, []);

  const fetchPedidos = useCallback(async (t: string) => {
    setRefreshing(true);
    try {
      const data = await api.getMeusPedidos(t);
      setPedidos(data);
      setLastUpdate(new Date());
    } catch (err: any) {
      if (err.message?.includes('401') || err.message?.includes('Não autorizado')) {
        handleLogout();
      }
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchPedidos(token);
    const interval = setInterval(() => fetchPedidos(token), 30000);
    return () => clearInterval(interval);
  }, [token, fetchPedidos]);

  function handleLogin(newToken: string, entregadorNome: string) {
    localStorage.setItem('entregador_token', newToken);
    localStorage.setItem('entregador_nome', entregadorNome);
    setToken(newToken);
    setNome(entregadorNome);
  }

  function handleLogout() {
    localStorage.removeItem('entregador_token');
    localStorage.removeItem('entregador_nome');
    setToken(null);
    setNome('');
    setPedidos([]);
  }

  async function handleAceitar(id: number) {
    if (!token) return;
    setLoadingAction(id);
    try {
      await api.aceitarPedido(id, token);
      await fetchPedidos(token);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleEntregar(id: number) {
    if (!token) return;
    setLoadingAction(id);
    try {
      await api.entregarPedido(id, token);
      await fetchPedidos(token);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleRecusar(id: number) {
    if (!token) return;
    setLoadingAction(id);
    try {
      await api.recusarPedido(id, token);
      await fetchPedidos(token);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoadingAction(null);
    }
  }

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const emRota = pedidos.filter(p => p.status === 'saiu_para_entrega').length;
  const pendentes = pedidos.filter(p => p.status === 'atribuido').length;

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#070a0d',
      fontFamily: F.outfit,
      maxWidth: 480,
      margin: '0 auto',
      position: 'relative',
    }}>
      {/* Background grid */}
      <div style={{
        position: 'fixed',
        top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 480, height: '100%',
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: 'rgba(7,10,13,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid #1c2128',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #0d1a12, #0f2018)',
            border: '1px solid rgba(34,197,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
          }}>🛵</div>
          <div>
            <div style={{ color: '#e6edf3', fontWeight: 700, fontSize: 15, fontFamily: F.outfit, lineHeight: 1 }}>
              {nome}
            </div>
            <div style={{ color: '#4b5563', fontSize: 10, fontFamily: F.mono, marginTop: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
              {lastUpdate ? (
                <>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: '#22c55e', display: 'inline-block',
                    boxShadow: '0 0 6px rgba(34,197,94,0.6)',
                  }} />
                  {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </>
              ) : '—'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => token && fetchPedidos(token)}
            disabled={refreshing}
            title="Atualizar"
            style={{
              width: 36, height: 36,
              background: '#0d1117',
              border: '1px solid #21262d',
              borderRadius: 10,
              color: refreshing ? '#22c55e' : '#6b7280',
              fontSize: 16,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: refreshing ? 'spin 1s linear infinite' : 'none',
            }}
          >
            ↻
          </button>
          <button
            onClick={handleLogout}
            title="Sair"
            style={{
              width: 36, height: 36,
              background: '#0d1117',
              border: '1px solid #21262d',
              borderRadius: 10,
              color: '#6b7280',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: F.mono,
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Stats bar (only when there are orders) */}
      {pedidos.length > 0 && (
        <div style={{
          display: 'flex',
          gap: 1,
          background: '#1c2128',
          margin: '0',
          position: 'relative', zIndex: 1,
        }}>
          {[
            { label: 'Pendentes', value: pendentes, color: '#f97316' },
            { label: 'Em rota', value: emRota, color: '#38bdf8' },
            { label: 'Total', value: pedidos.length, color: '#22c55e' },
          ].map(s => (
            <div key={s.label} style={{
              flex: 1,
              background: '#070a0d',
              padding: '10px 14px',
              textAlign: 'center',
            }}>
              <div style={{ color: s.color, fontWeight: 800, fontSize: 22, fontFamily: F.outfit, lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ color: '#4b5563', fontSize: 10, fontFamily: F.mono, marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ padding: '16px 16px 32px', position: 'relative', zIndex: 1 }}>
        {pedidos.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '80px 20px',
            animation: 'fadeUp 0.4s ease both',
          }}>
            <div style={{ fontSize: 64, marginBottom: 20, filter: 'grayscale(0.2)' }}>🏁</div>
            <div style={{
              color: '#e6edf3',
              fontSize: 20,
              fontWeight: 700,
              fontFamily: F.outfit,
              marginBottom: 10,
            }}>
              Tudo livre!
            </div>
            <div style={{
              color: '#4b5563',
              fontSize: 14,
              fontFamily: F.outfit,
              lineHeight: 1.6,
            }}>
              Novos pedidos aparecerão aqui.<br />
              Atualização automática a cada 30s.
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 24,
              padding: '8px 16px',
              background: '#0d1117',
              border: '1px solid #1c2128',
              borderRadius: 100,
              color: '#4b5563',
              fontSize: 11,
              fontFamily: F.mono,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: refreshing ? '#22c55e' : '#374151',
                display: 'inline-block',
                boxShadow: refreshing ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
                transition: 'all 0.3s',
              }} />
              {refreshing ? 'Atualizando…' : 'Aguardando pedidos'}
            </div>
          </div>
        ) : (
          pedidos.map(p => (
            <PedidoCard
              key={p.id}
              pedido={p}
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
