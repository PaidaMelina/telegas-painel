'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Bike, CheckCircle, XCircle, MapPin, User, Clock, X } from 'lucide-react';
import { api } from '@/lib/api';

type Pedido = {
  id: number;
  status: 'atribuido' | 'saiu_para_entrega';
  telefone_cliente: string;
  nome_cliente: string | null;
  endereco: string;
  bairro: string | null;
  total: number;
  entregador_nome: string | null;
  created_at: string;
};

function tempoDecorrido(data: string): string {
  const diff = Math.floor((Date.now() - new Date(data).getTime()) / 60000);
  if (diff < 1) return 'agora';
  if (diff === 1) return 'Há 1 min';
  if (diff < 60) return `Há ${diff} min`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `Há ${h}h ${m}min` : `Há ${h}h`;
}

export default function PainelEntregas() {
  const [open, setOpen] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [confirmCancel, setConfirmCancel] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAtivos = useCallback(async () => {
    try {
      const data = await api.getPedidosAtivos();
      setPedidos(data);
    } catch {}
  }, []);

  // Poll every 30s
  useEffect(() => {
    fetchAtivos();
    intervalRef.current = setInterval(() => {
      fetchAtivos();
      setTick(t => t + 1); // force re-render to update time labels
    }, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAtivos]);

  async function concluir(id: number) {
    setActionLoading(id);
    try {
      await api.concluirPedido(id);
      await fetchAtivos();
    } finally {
      setActionLoading(null);
    }
  }

  async function cancelar(id: number) {
    setActionLoading(id);
    try {
      await api.cancelarPedido(id, 'Cancelado pelo operador');
      await fetchAtivos();
    } finally {
      setActionLoading(null);
      setConfirmCancel(null);
    }
  }

  const ativos = pedidos.length;

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: open ? 372 : 20,
          zIndex: 100,
          background: ativos > 0 ? 'var(--accent)' : '#334155',
          color: '#fff',
          border: 'none',
          borderRadius: 50,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          cursor: 'pointer',
          fontFamily: 'var(--font-space-mono)',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.07em',
          boxShadow: ativos > 0
            ? '0 4px 20px rgba(37,87,231,0.4)'
            : '0 2px 10px rgba(0,0,0,0.2)',
          transition: 'right 0.3s ease, background 0.3s ease',
        }}
      >
        <Bike size={15} />
        ENTREGAS
        {ativos > 0 && (
          <span style={{
            background: '#fff',
            color: 'var(--accent)',
            borderRadius: '50%',
            width: 19,
            height: 19,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 800,
          }}>
            {ativos}
          </span>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => { setOpen(false); setConfirmCancel(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(13,20,36,0.25)',
            zIndex: 200,
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: open ? 0 : -372,
        width: 352,
        height: '100dvh',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        zIndex: 300,
        transition: 'right 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: open ? '-6px 0 28px rgba(13,20,36,0.10)' : 'none',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 18px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Bike size={17} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              Entregas em andamento
            </span>
            {ativos > 0 && (
              <span style={{
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: '50%',
                width: 21,
                height: 21,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 800,
              }}>
                {ativos}
              </span>
            )}
          </div>
          <button
            onClick={() => { setOpen(false); setConfirmCancel(null); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, borderRadius: 4 }}
          >
            <X size={17} />
          </button>
        </div>

        {/* Cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {pedidos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--text-muted)' }}>
              <Bike size={30} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.3 }} />
              <p style={{ fontSize: 13, margin: 0 }}>Nenhuma entrega em andamento</p>
            </div>
          ) : pedidos.map(p => (
            <div
              key={p.id}
              style={{
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${p.status === 'saiu_para_entrega' ? 'var(--blue)' : 'var(--amber)'}`,
                borderRadius: 9,
                padding: '12px 13px',
              }}
            >
              {/* ID + status + tempo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
                <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                  #{p.id}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className={`status-badge status-${p.status}`}>
                    {p.status === 'atribuido' ? 'Preparando' : 'Em rota'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
                    <Clock size={10} />
                    {tempoDecorrido(p.created_at)}
                  </span>
                </div>
              </div>

              {/* Cliente */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <User size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {p.nome_cliente || p.telefone_cliente}
                </span>
              </div>

              {/* Endereço */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 5, marginBottom: 7 }}>
                <MapPin size={11} color="var(--text-muted)" style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {p.endereco}{p.bairro ? `, ${p.bairro}` : ''}
                </span>
              </div>

              {/* Entregador */}
              {p.entregador_nome && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 9 }}>
                  <Bike size={11} color="var(--accent)" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>
                    {p.entregador_nome}
                  </span>
                  <CheckCircle size={11} color="var(--accent)" />
                </div>
              )}

              {/* Total + ações */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 8,
                borderTop: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  R$ {Number(p.total).toFixed(2).replace('.', ',')}
                </span>

                {confirmCancel === p.id ? (
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      onClick={() => setConfirmCancel(null)}
                      style={{ padding: '4px 9px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--text-secondary)' }}
                    >
                      Não
                    </button>
                    <button
                      onClick={() => cancelar(p.id)}
                      disabled={actionLoading === p.id}
                      style={{ padding: '4px 9px', borderRadius: 5, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: actionLoading === p.id ? 'not-allowed' : 'pointer', opacity: actionLoading === p.id ? 0.6 : 1 }}
                    >
                      {actionLoading === p.id ? '...' : 'Cancelar'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      onClick={() => setConfirmCancel(p.id)}
                      disabled={actionLoading === p.id}
                      style={{ padding: '4px 9px', borderRadius: 5, border: '1px solid var(--border)', background: 'none', fontSize: 11, cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <XCircle size={11} /> Cancelar
                    </button>
                    <button
                      onClick={() => concluir(p.id)}
                      disabled={actionLoading === p.id}
                      style={{ padding: '4px 11px', borderRadius: 5, border: 'none', background: 'var(--green)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: actionLoading === p.id ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: actionLoading === p.id ? 0.6 : 1 }}
                    >
                      <CheckCircle size={11} /> {actionLoading === p.id ? '...' : 'Entregue'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button
            onClick={fetchAtivos}
            style={{
              width: '100%',
              padding: '7px',
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'var(--font-space-mono)',
              color: 'var(--text-muted)',
              fontWeight: 700,
              letterSpacing: '0.07em',
            }}
          >
            ↻ ATUALIZAR
          </button>
        </div>
      </div>
    </>
  );
}
