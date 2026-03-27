'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Users, Search, Pencil, X, Phone, MapPin, ShoppingBag, Tag, ChevronLeft, ChevronRight } from 'lucide-react';

interface Cliente {
  id: number;
  telefone: string;
  nome: string | null;
  endereco: string | null;
  bairro: string | null;
  etiquetas: string[];
  totalPedidos: number;
  pedidosEntregues: number;
  ultimoPedido: string | null;
  created_at: string;
}

const ETIQUETAS = [
  { id: 'VIP',       bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  { id: 'Frequente', bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  { id: 'Novo',      bg: '#dbeafe', color: '#1e3a8a', border: '#93c5fd' },
  { id: 'Atacado',   bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  { id: 'Problema',  bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  { id: 'Uruguai',   bg: '#ffedd5', color: '#9a3412', border: '#fdba74' },
  { id: 'Inativo',   bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
];

function etiquetaStyle(id: string) {
  return ETIQUETAS.find(e => e.id === id) || { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' };
}

function EtiquetaPill({ id, small }: { id: string; small?: boolean }) {
  const s = etiquetaStyle(id);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: small ? '2px 7px' : '3px 9px',
      borderRadius: 3,
      fontSize: small ? 9 : 10,
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      fontFamily: 'var(--font-space-mono)',
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {id}
    </span>
  );
}

function formatTelefone(t: string) {
  const d = t.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return d;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return 'hoje';
  if (diff === 1) return 'ontem';
  if (diff < 7) return `${diff}d atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const LIMIT = 50;

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEtiqueta, setFilterEtiqueta] = useState('');
  const [offset, setOffset] = useState(0);

  // Edit drawer
  const [editTarget, setEditTarget] = useState<Cliente | null>(null);
  const [form, setForm] = useState({ nome: '', endereco: '', bairro: '', etiquetas: [] as string[] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (s: string, et: string, off: number) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: String(LIMIT), offset: String(off) };
      if (s) params.search = s;
      if (et) params.etiqueta = et;
      const res = await api.getClientes(params);
      setClientes(res.data);
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(search, filterEtiqueta, offset); }, []);

  function handleSearch(v: string) {
    setSearch(v);
    setOffset(0);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(v, filterEtiqueta, 0), 350);
  }

  function handleEtiquetaFilter(et: string) {
    const next = filterEtiqueta === et ? '' : et;
    setFilterEtiqueta(next);
    setOffset(0);
    load(search, next, 0);
  }

  function handlePage(dir: 1 | -1) {
    const next = offset + dir * LIMIT;
    setOffset(next);
    load(search, filterEtiqueta, next);
  }

  function openEdit(c: Cliente) {
    setEditTarget(c);
    setForm({
      nome: c.nome || '',
      endereco: c.endereco || '',
      bairro: c.bairro || '',
      etiquetas: [...(c.etiquetas || [])],
    });
    setFormError('');
  }

  function toggleEtiqueta(id: string) {
    setForm(f => ({
      ...f,
      etiquetas: f.etiquetas.includes(id)
        ? f.etiquetas.filter(e => e !== id)
        : [...f.etiquetas, id],
    }));
  }

  async function handleSave() {
    if (!editTarget) return;
    setSaving(true);
    setFormError('');
    try {
      await api.atualizarCliente(editTarget.id, {
        nome: form.nome || undefined,
        endereco: form.endereco || undefined,
        bairro: form.bairro || undefined,
        etiquetas: form.etiquetas,
      });
      setEditTarget(null);
      load(search, filterEtiqueta, offset);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  // KPIs
  const comPedidos = clientes.filter(c => c.totalPedidos > 0).length;
  const vips = clientes.filter(c => c.etiquetas?.includes('VIP')).length;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 6,
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', fontSize: 14, fontFamily: 'var(--font-barlow)',
    outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)',
    marginBottom: 6, display: 'block',
  };

  const totalPages = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <main className="min-h-screen" style={{ padding: '32px 28px', width: '100%' }}>

      {/* Header */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 6 }}>
            Base de Clientes
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 30, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
              Clientes
            </h1>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: 6 }}>
            {total} cadastrados · edição e etiquetas
          </p>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: 280, marginTop: 6 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Buscar nome, telefone ou endereço..."
            style={{ ...inputStyle, paddingLeft: 36, fontSize: 13 }}
          />
          {search && (
            <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              <X size={13} />
            </button>
          )}
        </div>
      </header>

      {/* KPI strip */}
      <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        <div className="kpi-card" style={{ borderTop: '2px solid var(--border)', padding: '18px 22px' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 10 }}>Total Cadastrados</p>
          <p style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>{total}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>na base</p>
        </div>
        <div className="kpi-card" style={{ borderTop: '2px solid #047857', padding: '18px 22px' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 10 }}>Com Pedidos</p>
          <p style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#047857' }}>{comPedidos}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>nesta página</p>
        </div>
        <div className="kpi-card" style={{ borderTop: '2px solid #fcd34d', padding: '18px 22px' }}>
          <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 10 }}>VIP</p>
          <p style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#92400e' }}>{vips}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>clientes VIP nesta página</p>
        </div>
      </div>

      {/* Etiqueta filters */}
      <div className="fade-up-2" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginRight: 4 }}>
          <Tag size={11} style={{ display: 'inline', marginRight: 4 }} />Filtrar:
        </span>
        {ETIQUETAS.map(et => {
          const active = filterEtiqueta === et.id;
          return (
            <button
              key={et.id}
              onClick={() => handleEtiquetaFilter(et.id)}
              style={{
                padding: '4px 12px', borderRadius: 4, cursor: 'pointer',
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                background: active ? et.bg : 'var(--bg-surface)',
                color: active ? et.color : 'var(--text-muted)',
                border: `1px solid ${active ? et.border : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}
            >
              {et.id}
            </button>
          );
        })}
        {filterEtiqueta && (
          <button onClick={() => handleEtiquetaFilter('')} style={{ padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'var(--font-space-mono)', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <X size={11} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="fade-up-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1.6fr 1.4fr 80px 90px 44px', gap: 0, padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface-2)' }}>
          {['Cliente', 'Telefone', 'Endereço', 'Etiquetas', 'Pedidos', 'Último', ''].map((h, i) => (
            <span key={i} style={{ fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}>{h}</span>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-space-mono)' }}>
            <span className="live-dot" style={{ marginRight: 10, display: 'inline-block' }} /> Carregando...
          </div>
        ) : clientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '52px 0', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-space-mono)' }}>
            Nenhum cliente encontrado.
          </div>
        ) : clientes.map((c, idx) => (
          <div
            key={c.id}
            className="orders-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.6fr 1.4fr 80px 90px 44px',
              gap: 0,
              padding: '11px 18px',
              alignItems: 'center',
              background: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-2)',
            }}
          >
            {/* Nome */}
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.nome || <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontStyle: 'italic' }}>sem nome</span>}
              </p>
            </div>

            {/* Telefone */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Phone size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>
                {formatTelefone(c.telefone)}
              </span>
            </div>

            {/* Endereço */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
              <MapPin size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.endereco ? `${c.endereco}${c.bairro ? `, ${c.bairro}` : ''}` : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
              </span>
            </div>

            {/* Etiquetas */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(c.etiquetas || []).length === 0
                ? <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                : (c.etiquetas || []).map(et => <EtiquetaPill key={et} id={et} small />)
              }
            </div>

            {/* Pedidos */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ShoppingBag size={11} color="var(--text-muted)" />
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: c.totalPedidos > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {c.totalPedidos}
              </span>
            </div>

            {/* Último pedido */}
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
              {formatDate(c.ultimoPedido)}
            </span>

            {/* Editar */}
            <button
              onClick={() => openEdit(c)}
              style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', padding: '5px 7px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Pencil size={13} />
            </button>
          </div>
        ))}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface-2)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
              Página {currentPage} de {totalPages} · {total} clientes
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => handlePage(-1)}
                disabled={offset === 0}
                style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', cursor: offset === 0 ? 'not-allowed' : 'pointer', color: offset === 0 ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}
              >
                <ChevronLeft size={13} /> Ant.
              </button>
              <button
                onClick={() => handlePage(1)}
                disabled={offset + LIMIT >= total}
                style={{ padding: '5px 10px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-surface)', cursor: offset + LIMIT >= total ? 'not-allowed' : 'pointer', color: offset + LIMIT >= total ? 'var(--text-muted)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}
              >
                Próx. <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
          TeleGás Ops · {total} clientes cadastrados
        </p>
      </footer>

      {/* Backdrop */}
      {editTarget && (
        <div
          onClick={() => setEditTarget(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,20,36,0.45)', zIndex: 40, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Edit Drawer */}
      {editTarget && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: 380, height: '100vh',
          background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
          zIndex: 50, display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}>
          {/* Drawer header */}
          <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div>
              <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 4 }}>Editar Cliente</p>
              <h2 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1 }}>
                {editTarget.nome || formatTelefone(editTarget.telefone)}
              </h2>
            </div>
            <button onClick={() => setEditTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          {/* Drawer body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

            {/* Phone (readonly) */}
            <div>
              <label style={labelStyle}>Telefone</label>
              <div style={{ ...inputStyle, background: 'var(--bg-surface-2)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Phone size={13} />
                {formatTelefone(editTarget.telefone)}
              </div>
            </div>

            <div>
              <label style={labelStyle}>Nome</label>
              <input
                style={inputStyle}
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome do cliente"
                autoFocus
              />
            </div>

            <div>
              <label style={labelStyle}>Endereço</label>
              <input
                style={inputStyle}
                value={form.endereco}
                onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))}
                placeholder="Rua e número"
              />
            </div>

            <div>
              <label style={labelStyle}>Bairro</label>
              <input
                style={inputStyle}
                value={form.bairro}
                onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))}
                placeholder="Bairro"
              />
            </div>

            {/* Etiquetas */}
            <div>
              <label style={labelStyle}>
                <Tag size={10} style={{ display: 'inline', marginRight: 5 }} />
                Etiquetas
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                {ETIQUETAS.map(et => {
                  const active = form.etiquetas.includes(et.id);
                  return (
                    <button
                      key={et.id}
                      onClick={() => toggleEtiqueta(et.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 5, cursor: 'pointer',
                        fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        background: active ? et.bg : 'var(--bg-surface)',
                        color: active ? et.color : 'var(--text-muted)',
                        border: `1px solid ${active ? et.border : 'var(--border)'}`,
                        transition: 'all 0.15s',
                        transform: active ? 'scale(1.03)' : 'scale(1)',
                      }}
                    >
                      {active && '✓ '}{et.id}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stats */}
            <div style={{ background: 'var(--bg-surface-2)', borderRadius: 8, padding: '14px 16px', border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 10 }}>Histórico</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <p style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Total pedidos</p>
                  <p style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>{editTarget.totalPedidos}</p>
                </div>
                <div>
                  <p style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Último pedido</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', lineHeight: 1 }}>{formatDate(editTarget.ultimoPedido)}</p>
                </div>
              </div>
            </div>

            {formError && (
              <p style={{ fontSize: 12, color: '#c81e1e', fontFamily: 'var(--font-space-mono)', background: '#fff1f1', padding: '10px 12px', borderRadius: 4, border: '1px solid #fecaca' }}>
                {formError}
              </p>
            )}
          </div>

          {/* Drawer footer */}
          <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', gap: 8 }}>
            <button onClick={() => setEditTarget(null)} style={{
              flex: 1, padding: 11, borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700,
              fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: 11, borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer',
              border: 'none', background: saving ? '#93c5fd' : 'var(--accent)', color: '#fff',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
              transition: 'background 0.15s',
            }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
