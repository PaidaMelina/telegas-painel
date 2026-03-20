'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Package, ChevronLeft, ChevronRight, ArrowLeft, X,
  Clock, MapPin, Phone, Hash, ShoppingBag, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_LABELS: Record<string, string> = {
  atribuido: 'Atribuído',
  saiu_para_entrega: 'Em Rota',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  novo: 'Novo',
};

interface Produto { qtd: number; produto: string; preco: number }
interface HistoryEntry { status: string; changed_at: string }
interface Pedido {
  id: number;
  telefone_cliente: string;
  nome_cliente?: string;
  produtos: Produto[];
  total: string;
  endereco: string;
  bairro: string;
  troco_para: string | null;
  status: string;
  created_at: string;
  atribuido_em: string | null;
  saiu_entrega_em: string | null;
  entregue_em: string | null;
  cancelado_em: string | null;
  motivo_cancelamento: string | null;
  entregador_id: number | null;
  entregador_nome?: string | null;
}

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const limit = 20;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<Pedido | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [motivoCancel, setMotivoCancel] = useState('');

  const fetchPedidos = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const params: Record<string, string> = {
        limit: limit.toString(),
        offset: offset.toString(),
        sort: sortBy,
        dir: sortDir,
      };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.getPedidos(params);
      setPedidos(res.data || []);
      setTotal(res.total || 0);
    } catch {
      setErro('Erro ao carregar pedidos. Verifique se o backend está rodando.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, offset, sortBy, sortDir, search]);

  useEffect(() => { fetchPedidos(); }, [fetchPedidos]);

  const handleStatusChange = (s: string) => { setStatusFilter(s); setOffset(0); };
  const handleSearch = () => { setSearch(searchInput); setOffset(0); };

  const openDetail = async (id: number) => {
    setSelectedId(id);
    setDetailLoading(true);
    setActionError('');
    setShowCancelModal(false);
    setMotivoCancel('');
    try {
      const [det, hist] = await Promise.all([
        api.getPedidoDetails(String(id)),
        api.getPedidoHistory(String(id)),
      ]);
      setDetail(det);
      setHistory(hist);
    } catch { /* silent */ } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null); setDetail(null); setHistory([]);
    setActionError(''); setShowCancelModal(false); setMotivoCancel('');
  };

  const handleConcluir = async () => {
    if (!detail) return;
    setActionLoading(true); setActionError('');
    try {
      const updated = await api.concluirPedido(detail.id);
      setDetail(updated);
      setHistory(h => [...h, { status: 'entregue', changed_at: new Date().toISOString() }]);
      fetchPedidos();
    } catch (e: any) { setActionError(e.message || 'Erro ao concluir'); }
    finally { setActionLoading(false); }
  };

  const handleCancelar = async () => {
    if (!detail) return;
    setActionLoading(true); setActionError('');
    try {
      const updated = await api.cancelarPedido(detail.id, motivoCancel || undefined);
      setDetail(updated);
      setHistory(h => [...h, { status: 'cancelado', changed_at: new Date().toISOString() }]);
      setShowCancelModal(false); setMotivoCancel('');
      fetchPedidos();
    } catch (e: any) { setActionError(e.message || 'Erro ao cancelar'); }
    finally { setActionLoading(false); }
  };

  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
    setOffset(0);
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });

  const fmtPhone = (p: string) => p.replace('@s.whatsapp.net', '').replace(/^55/, '');
  const isFinal = (s: string) => s === 'entregue' || s === 'cancelado';

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '40px 32px', maxWidth: '1280px', margin: '0 auto' }}>

      <header className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={20} style={{ color: 'var(--accent)' }} />
              <h1 style={{ fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-barlow)' }}>Gestão de Pedidos</h1>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: '4px' }}>Histórico e acompanhamento total</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="Telefone ou endereço..."
              style={{ background: 'transparent', border: 'none', outline: 'none', padding: '8px 14px', fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)', width: '220px' }}
            />
            <button onClick={handleSearch} style={{ background: 'var(--accent-dim)', border: 'none', borderLeft: '1px solid var(--border)', padding: '8px 14px', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}>BUSCAR</button>
          </div>
          {search && (
            <button onClick={() => { setSearch(''); setSearchInput(''); setOffset(0); }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px 10px', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </header>

      <div className="fade-up-1" style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {(['', 'atribuido', 'saiu_para_entrega', 'entregue', 'cancelado'] as const).map(s => (
          <button key={s} onClick={() => handleStatusChange(s)} style={{ fontSize: '10px', padding: '6px 14px', borderRadius: '4px', background: statusFilter === s ? 'var(--accent)' : 'var(--bg-surface)', color: statusFilter === s ? 'var(--bg-base)' : 'var(--text-secondary)', border: '1px solid', borderColor: statusFilter === s ? 'var(--accent)' : 'var(--border)', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s ease' }}>
            {s === '' ? 'Todos' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#f87171', marginBottom: '24px', fontSize: '13px' }}>
          <AlertTriangle size={15} /><span>{erro}</span>
        </div>
      )}

      <div className="fade-up-1" style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-surface)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border)' }}>
              {[
                { label: '# ID', col: 'id' },
                { label: 'Data / Hora', col: 'created_at' },
                { label: 'Cliente', col: null },
                { label: 'Endereço', col: null },
                { label: 'Total', col: 'total' },
                { label: 'Status', col: null },
              ].map(({ label, col }) => (
                <th key={label} onClick={col ? () => toggleSort(col) : undefined} style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10px', fontWeight: 700, color: col && sortBy === col ? 'var(--accent)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-space-mono)', cursor: col ? 'pointer' : 'default', userSelect: 'none', whiteSpace: 'nowrap' }}>
                  {label}{col && sortBy === col ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}><span className="live-dot" style={{ marginRight: '10px', display: 'inline-block' }} /> Carregando registros...</td></tr>
            ) : pedidos.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>Nenhum pedido encontrado.</td></tr>
            ) : (
              pedidos.map(p => (
                <tr key={p.id} className="orders-row" onClick={() => openDetail(p.id)} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-space-mono)' }}>#{p.id}</td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(p.created_at)}</td>
                  <td style={{ padding: '16px 20px', fontSize: '13px' }}><div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmtPhone(p.telefone_cliente)}</div></td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '240px' }}><span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.endereco}{p.bairro ? ` (${p.bairro})` : ''}</span></td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', whiteSpace: 'nowrap' }}>R$ {parseFloat(p.total).toFixed(2)}</td>
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

        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-2)', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
            {total === 0 ? 'Nenhum registro' : `Mostrando ${Math.min(offset + 1, total)}–${Math.min(offset + pedidos.length, total)} de ${total} pedidos`}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: offset === 0 ? 'var(--text-muted)' : 'var(--text-secondary)', padding: '6px 12px', borderRadius: '4px', cursor: offset === 0 ? 'default' : 'pointer' }}><ChevronLeft size={16} /></button>
            <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: offset + limit >= total ? 'var(--text-muted)' : 'var(--text-secondary)', padding: '6px 12px', borderRadius: '4px', cursor: offset + limit >= total ? 'default' : 'pointer' }}><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>

      {/* ── Detail Drawer ── */}
      {selectedId !== null && (
        <div onClick={closeDetail} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '420px', height: '100vh', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Hash size={16} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Pedido #{selectedId}</span>
              </div>
              <button onClick={closeDetail} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
            </div>

            {detailLoading ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>Carregando...</div>
            ) : detail ? (
              <div style={{ flex: 1, overflowY: 'auto' }}>

                {/* Status + ações */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                  <span className={`status-badge status-${detail.status}`} style={{ display: 'inline-flex', marginBottom: '16px' }}>
                    <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                    {STATUS_LABELS[detail.status] ?? detail.status}
                  </span>
                  {!isFinal(detail.status) && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        disabled={actionLoading}
                        onClick={handleConcluir}
                        style={{ fontSize: '10px', padding: '8px 16px', borderRadius: '4px', border: '1px solid rgba(52,211,153,0.3)', background: 'rgba(52,211,153,0.1)', color: '#34d399', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}
                      >
                        {actionLoading ? '...' : '✓ Concluir Pedido'}
                      </button>
                      <button
                        disabled={actionLoading}
                        onClick={() => setShowCancelModal(true)}
                        style={{ fontSize: '10px', padding: '8px 16px', borderRadius: '4px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.1)', color: '#f87171', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}
                      >
                        ✕ Cancelar Pedido
                      </button>
                    </div>
                  )}
                  {actionError && <p style={{ fontSize: '12px', color: '#f87171', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>⚠ {actionError}</p>}
                </div>

                {/* Cancel motivo */}
                {showCancelModal && (
                  <div style={{ padding: '16px 24px', background: 'rgba(239,68,68,0.05)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
                    <p style={{ fontSize: '11px', color: '#f87171', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>Motivo do cancelamento (opcional)</p>
                    <input
                      value={motivoCancel}
                      onChange={e => setMotivoCancel(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCancelar()}
                      placeholder="ex: cliente não estava em casa"
                      style={{ width: '100%', background: 'var(--bg-surface-2)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '4px', padding: '8px 12px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'var(--font-space-mono)', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button disabled={actionLoading} onClick={handleCancelar} style={{ flex: 1, fontSize: '10px', padding: '8px', borderRadius: '4px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.15)', color: '#f87171', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer', opacity: actionLoading ? 0.5 : 1 }}>
                        {actionLoading ? '...' : 'Confirmar Cancelamento'}
                      </button>
                      <button onClick={() => { setShowCancelModal(false); setMotivoCancel(''); }} style={{ padding: '8px 14px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '10px', fontFamily: 'var(--font-space-mono)' }}>VOLTAR</button>
                    </div>
                  </div>
                )}

                {/* Dados do pedido */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Phone size={14} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Cliente</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>{fmtPhone(detail.telefone_cliente)}</p>
                      {detail.nome_cliente && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{detail.nome_cliente}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <MapPin size={14} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Endereço</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{detail.endereco}</p>
                      {detail.bairro && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>{detail.bairro}</p>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <Clock size={14} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Criado em</p>
                      <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>{fmtDate(detail.created_at)}</p>
                    </div>
                  </div>
                  {detail.entregador_nome && (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      <Package size={14} style={{ color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px' }}>Entregador</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{detail.entregador_nome}</p>
                      </div>
                    </div>
                  )}
                  {detail.motivo_cancelamento && (
                    <div style={{ padding: '10px 12px', background: 'rgba(239,68,68,0.07)', borderRadius: '4px', border: '1px solid rgba(239,68,68,0.15)' }}>
                      <p style={{ fontSize: '10px', color: '#f87171', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Motivo cancelamento</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{detail.motivo_cancelamento}</p>
                    </div>
                  )}
                </div>

                {/* Produtos */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                    <ShoppingBag size={14} style={{ color: 'var(--text-muted)', marginTop: '1px', flexShrink: 0 }} />
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Produtos</p>
                  </div>
                  {Array.isArray(detail.produtos) && detail.produtos.map((pr, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{pr.qtd}× {pr.produto}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>R$ {parseFloat(String(pr.preco)).toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '12px', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase' }}>Total</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)' }}>R$ {parseFloat(detail.total).toFixed(2)}</span>
                  </div>
                  {detail.troco_para && parseFloat(detail.troco_para) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase' }}>Troco para</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>R$ {parseFloat(detail.troco_para).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                {history.length > 0 && (
                  <div style={{ padding: '20px 24px' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>Timeline de Status</p>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {history.map((h, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: h.status === 'entregue' ? '#34d399' : h.status === 'cancelado' ? '#f87171' : 'var(--accent)', marginTop: '4px' }} />
                            {i < history.length - 1 && <div style={{ width: '1px', flex: 1, background: 'var(--border)', minHeight: '20px', marginTop: '2px' }} />}
                          </div>
                          <div style={{ paddingBottom: i < history.length - 1 ? '16px' : '0' }}>
                            <span className={`status-badge status-${h.status}`} style={{ marginBottom: '4px' }}>
                              <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                              {STATUS_LABELS[h.status] ?? h.status}
                            </span>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginTop: '2px' }}>{fmtDate(h.changed_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
