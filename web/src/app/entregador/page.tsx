'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, API_URL } from '@/lib/api';

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

// ─── Login Screen ────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (token: string, nome: string) => void }) {
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
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Brand */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>🛵</div>
        <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>
          TeleGás
        </h1>
        <p style={{ color: '#666', fontSize: 14, margin: '6px 0 0' }}>
          Área do Entregador
        </p>
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#141414',
          border: '1px solid #222',
          borderRadius: 16,
          padding: '28px 24px',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', color: '#888', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Telefone
          </label>
          <input
            type="tel"
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder="(53) 99999-9999"
            required
            style={{
              width: '100%',
              background: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              padding: '13px 14px',
              color: '#fff',
              fontSize: 16,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#f97316'}
            onBlur={e => e.target.style.borderColor = '#2a2a2a'}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', color: '#888', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Senha
          </label>
          <input
            type="password"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="••••••••"
            required
            style={{
              width: '100%',
              background: '#0a0a0a',
              border: '1px solid #2a2a2a',
              borderRadius: 10,
              padding: '13px 14px',
              color: '#fff',
              fontSize: 16,
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 0.15s',
            }}
            onFocus={e => e.target.style.borderColor = '#f97316'}
            onBlur={e => e.target.style.borderColor = '#2a2a2a'}
          />
        </div>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 8,
            padding: '10px 12px',
            color: '#f87171',
            fontSize: 13,
            marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#333' : '#f97316',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
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
  const accent = isAtribuido ? '#f97316' : '#22c55e';

  return (
    <div style={{
      background: '#141414',
      border: '1px solid #222',
      borderLeft: `4px solid ${accent}`,
      borderRadius: 14,
      padding: '18px 16px',
      marginBottom: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <span style={{
            display: 'inline-block',
            background: isAtribuido ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)',
            color: accent,
            borderRadius: 6,
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {isAtribuido ? '⏳ Aguardando aceite' : '🚀 Em rota'}
          </span>
          <div style={{ color: '#555', fontSize: 11, marginTop: 5 }}>
            Pedido #{pedido.id} · {tempoDesde(pedido.atribuidoEm)}
          </div>
        </div>
        <div style={{
          color: '#fff',
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: '-0.02em',
        }}>
          R$ {pedido.total.toFixed(2).replace('.', ',')}
        </div>
      </div>

      {/* Cliente */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 16, marginBottom: 2 }}>
          {pedido.nomeCliente || formatPhone(pedido.telefoneCliente)}
        </div>
        {pedido.nomeCliente && (
          <div style={{ color: '#555', fontSize: 13 }}>
            {formatPhone(pedido.telefoneCliente)}
          </div>
        )}
      </div>

      {/* Endereço */}
      <div style={{
        background: '#0a0a0a',
        borderRadius: 10,
        padding: '10px 12px',
        marginBottom: 12,
      }}>
        <div style={{ color: '#888', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
          📍 Endereço
        </div>
        <div style={{ color: '#e5e5e5', fontSize: 14, lineHeight: 1.5 }}>
          {pedido.endereco}{pedido.bairro ? `, ${pedido.bairro}` : ''}
        </div>
      </div>

      {/* Produtos */}
      <div style={{ marginBottom: 12 }}>
        {pedido.produtos?.map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#aaa', padding: '2px 0' }}>
            <span>{p.qtd}x {p.nome || p.produto}</span>
            <span>R$ {(p.preco * p.qtd).toFixed(2).replace('.', ',')}</span>
          </div>
        ))}
      </div>

      {/* Pagamento */}
      {(pedido.formaPagamento || pedido.trocoPara) && (
        <div style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}>
          {pedido.formaPagamento && (
            <span style={{
              background: '#1e1e1e',
              border: '1px solid #2a2a2a',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              color: '#aaa',
            }}>
              💳 {pedido.formaPagamento}
            </span>
          )}
          {pedido.trocoPara && (
            <span style={{
              background: 'rgba(249,115,22,0.08)',
              border: '1px solid rgba(249,115,22,0.2)',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 12,
              color: '#fb923c',
              fontWeight: 600,
            }}>
              Troco para R$ {pedido.trocoPara.toFixed(2).replace('.', ',')}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {isAtribuido ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onRecusar}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: '1px solid #333',
              borderRadius: 10,
              color: '#888',
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            Recusar
          </button>
          <button
            onClick={onAceitar}
            disabled={loading}
            style={{
              flex: 2,
              padding: '12px',
              background: loading ? '#333' : '#f97316',
              border: 'none',
              borderRadius: 10,
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '…' : '✓ Aceitar entrega'}
          </button>
        </div>
      ) : (
        <button
          onClick={onEntregar}
          disabled={loading}
          style={{
            width: '100%',
            padding: '14px',
            background: loading ? '#333' : '#22c55e',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '…' : '✓ Confirmar entrega'}
        </button>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function EntregadorPage() {
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

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0a',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      maxWidth: 480,
      margin: '0 auto',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        background: '#0a0a0a',
        borderBottom: '1px solid #1a1a1a',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🛵</span>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{nome}</span>
          </div>
          {lastUpdate && (
            <div style={{ color: '#444', fontSize: 11, marginTop: 2 }}>
              Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => token && fetchPedidos(token)}
            disabled={refreshing}
            style={{
              padding: '8px 12px',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              color: '#aaa',
              fontSize: 18,
              cursor: refreshing ? 'not-allowed' : 'pointer',
              lineHeight: 1,
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            ↻
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: '8px 12px',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 8,
              color: '#888',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Sair
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {pedidos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 20px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
            <div style={{ color: '#fff', fontSize: 17, fontWeight: 600, marginBottom: 8 }}>
              Nenhum pedido no momento
            </div>
            <div style={{ color: '#555', fontSize: 14 }}>
              Novos pedidos aparecerão aqui automaticamente
            </div>
          </div>
        ) : (
          <>
            <div style={{ color: '#888', fontSize: 12, fontWeight: 600, marginBottom: 14, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''} ativo{pedidos.length !== 1 ? 's' : ''}
            </div>
            {pedidos.map(p => (
              <PedidoCard
                key={p.id}
                pedido={p}
                loading={loadingAction === p.id}
                onAceitar={() => handleAceitar(p.id)}
                onEntregar={() => handleEntregar(p.id)}
                onRecusar={() => handleRecusar(p.id)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
