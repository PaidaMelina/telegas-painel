'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Package, Truck, CheckCircle2, XCircle, Search, Filter, ChevronLeft, ChevronRight, Flame, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const STATUS_LABELS: Record<string, string> = {
  atribuido: 'Atribuído',
  saiu_para_entrega: 'Em Rota',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const fetchPedidos = async () => {
    setLoading(true);
    try {
      const params: any = { limit: limit.toString(), offset: offset.toString() };
      if (statusFilter) params.status = statusFilter;
      
      const res = await api.getPedidos(params);
      setPedidos(res.data || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
  }, [statusFilter, offset]);

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setOffset(0);
  };

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '40px 32px', maxWidth: '1280px', margin: '0 auto' }}>
      
      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/" className="back-button" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            transition: 'all 0.2s ease'
          }}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={20} style={{ color: 'var(--accent)' }} />
              <h1 style={{ 
                fontSize: '24px', 
                fontWeight: 800, 
                textTransform: 'uppercase', 
                letterSpacing: '0.1em',
                fontFamily: 'var(--font-barlow)'
              }}>
                Gestão de Pedidos
              </h1>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: '4px' }}>
                Histórico e acompanhamento total
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {['', 'atribuido', 'saiu_para_entrega', 'entregue', 'cancelado'].map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              style={{
                fontSize: '10px',
                padding: '6px 14px',
                borderRadius: '4px',
                background: statusFilter === s ? 'var(--accent)' : 'var(--bg-surface)',
                color: statusFilter === s ? 'var(--bg-base)' : 'var(--text-secondary)',
                border: '1px solid',
                borderColor: statusFilter === s ? 'var(--accent)' : 'var(--border)',
                fontFamily: 'var(--font-space-mono)',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {s === '' ? 'Todos' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </header>

      {/* ── Content ── */}
      <div className="fade-up-1" style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-surface)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border)' }}>
              {['# ID', 'Data / Hora', 'Cliente / Tel', 'Endereço', 'Total', 'Status'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-space-mono)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
                  <div className="live-dot" style={{ marginRight: '10px' }} /> Carregando registros...
                </td>
              </tr>
            ) : pedidos.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
                  Nenhum pedido encontrado com este filtro.
                </td>
              </tr>
            ) : (
              pedidos.map((p) => (
                <tr key={p.id} className="orders-row">
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-space-mono)' }}>#{p.id}</td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {new Date(p.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '13px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.telefone_cliente.replace('@s.whatsapp.net', '')}</div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.endereco} {p.bairro ? `( ${p.bairro} )` : ''}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)' }}>
                    R$ {parseFloat(p.total).toFixed(2)}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span className={`status-badge status-${p.status}`}>
                       <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                       {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* ── Pagination ── */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-2)', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
            Mostrando {pedidos.length} de {total} pedidos
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
             <button 
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
                style={{ 
                  background: 'var(--bg-surface)', 
                  border: '1px solid var(--border)', 
                  color: offset === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: offset === 0 ? 'default' : 'pointer'
                }}
             >
                <ChevronLeft size={16} />
             </button>
             <button 
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
                style={{ 
                  background: 'var(--bg-surface)', 
                  border: '1px solid var(--border)', 
                  color: offset + limit >= total ? 'var(--text-muted)' : 'var(--text-secondary)',
                  padding: '6px 12px',
                  borderRadius: '4px',
                  cursor: offset + limit >= total ? 'default' : 'pointer'
                }}
             >
                <ChevronRight size={16} />
             </button>
          </div>
        </div>
      </div>
    </main>
  );
}
