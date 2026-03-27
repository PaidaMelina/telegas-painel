'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Users, CheckCircle2, Truck, Plus, Pencil, Trash2, Coffee, X } from 'lucide-react';

interface Entregador {
  id: number;
  nome: string;
  telefone: string;
  ativo: boolean;
  emFolga: boolean;
  created_at: string;
  pedidosAbertos: number;
  entreguesHoje: number;
  tempoMedioEntrega: number;
}

type Filter = 'todos' | 'ativos' | 'folga' | 'inativos';

const EMPTY_FORM = { nome: '', telefone: '', ativo: true };

export default function EntregadoresPage() {
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todos');

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Entregador | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Entregador | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reload = () =>
    api.getEntregadores().then(setEntregadores).catch(console.error);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  const filtered = entregadores.filter((e) => {
    if (filter === 'ativos') return e.ativo && !e.emFolga;
    if (filter === 'folga') return e.emFolga;
    if (filter === 'inativos') return !e.ativo;
    return true;
  });

  const totalEntreguesHoje = entregadores.reduce((acc, e) => acc + e.entreguesHoje, 0);
  const totalEmAberto = entregadores.reduce((acc, e) => acc + e.pedidosAbertos, 0);
  const ativos = entregadores.filter((e) => e.ativo && !e.emFolga).length;
  const maxAberto = Math.max(...entregadores.map(e => e.pedidosAbertos), 1);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setDrawerOpen(true);
  }

  function openEdit(e: Entregador) {
    setEditTarget(e);
    setForm({ nome: e.nome, telefone: e.telefone, ativo: e.ativo });
    setFormError('');
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.telefone.trim()) {
      setFormError('Preencha nome e telefone.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editTarget) {
        await api.atualizarEntregador(editTarget.id, form);
      } else {
        await api.criarEntregador({ nome: form.nome, telefone: form.telefone });
      }
      setDrawerOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleFolga(e: Entregador) {
    try {
      await api.toggleFolga(e.id, !e.emFolga);
      reload();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.excluirEntregador(deleteTarget.id);
      setDeleteTarget(null);
      reload();
    } catch (err: any) {
      alert(err.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-barlow)',
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px', display: 'block',
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'todos', label: 'Todos' },
    { key: 'ativos', label: 'Ativos' },
    { key: 'folga', label: 'Folga' },
    { key: 'inativos', label: 'Inativos' },
  ];

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '32px 28px', width: '100%' }}>

      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px' }}>
            Equipe
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '30px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
              Entregadores
            </h1>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: '6px' }}>
            desempenho individual · hoje
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)} style={{
                fontSize: '10px', padding: '6px 14px', borderRadius: '4px',
                background: filter === f.key ? 'var(--accent)' : 'var(--bg-surface)',
                color: filter === f.key ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid', borderColor: filter === f.key ? 'var(--accent)' : 'var(--border)',
                fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s ease',
              }}>
                {f.label}
              </button>
            ))}
          </div>
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff',
            fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-space-mono)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <Plus size={13} strokeWidth={2.5} /> Novo
          </button>
        </div>
      </header>

      {/* ── KPI Strip ── */}
      <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <div className="kpi-card" style={{ borderTop: '2px solid var(--border)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Users size={13} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Ativos Agora</p>
          </div>
          <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>{ativos}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>de {entregadores.length} cadastrados</p>
        </div>

        <div className="kpi-card" style={{ borderTop: '2px solid #047857', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <CheckCircle2 size={13} style={{ color: '#047857', opacity: 0.7 }} strokeWidth={1.5} />
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Entregues Hoje</p>
          </div>
          <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#047857' }}>{totalEntreguesHoje}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>entregas concluídas</p>
        </div>

        <div className={`kpi-card${totalEmAberto > 0 ? ' kpi-card-accent' : ''}`} style={{ borderTop: totalEmAberto > 0 ? '2px solid var(--accent)' : '2px solid var(--border)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Truck size={13} style={{ color: totalEmAberto > 0 ? 'var(--accent)' : 'var(--text-muted)', opacity: 0.8 }} strokeWidth={1.5} />
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Em Rota Agora</p>
          </div>
          <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: totalEmAberto > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>{totalEmAberto}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>pedidos em andamento</p>
        </div>
      </div>

      {/* ── Entregador Cards ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          <span className="live-dot" style={{ marginRight: '10px', display: 'inline-block' }} /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          Nenhum entregador encontrado.
        </div>
      ) : (
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '14px' }}>
          {filtered.map((e) => {
            const cargaPct = maxAberto > 0 ? Math.round((e.pedidosAbertos / maxAberto) * 100) : 0;
            const borderColor = e.emFolga ? '#c27803' : e.pedidosAbertos > 0 ? 'var(--accent)' : e.ativo ? '#047857' : 'var(--border)';
            return (
              <div key={e.id} className="kpi-card" style={{ borderTop: `2px solid ${borderColor}`, padding: '20px', opacity: e.emFolga ? 0.75 : 1 }}>
                {/* Name + badge + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1, marginBottom: '4px' }}>{e.nome}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{e.telefone.replace(/^55/, '')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '3px 8px', borderRadius: '3px', fontSize: '9px', fontWeight: 700,
                      letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)',
                      background: e.emFolga ? '#fef3c7' : e.ativo ? '#d1fae5' : '#f1f5f9',
                      color: e.emFolga ? '#92400e' : e.ativo ? '#065f46' : '#4a5568',
                      border: `1px solid ${e.emFolga ? '#fcd34d' : e.ativo ? '#6ee7b7' : '#cbd5e1'}`,
                    }}>
                      <svg width="4" height="4" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                      {e.emFolga ? 'Folga' : e.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Entregues</p>
                    <p style={{ fontSize: '26px', fontWeight: 900, color: '#047857', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>{e.entreguesHoje}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Em Rota</p>
                    <p style={{ fontSize: '26px', fontWeight: 900, color: e.pedidosAbertos > 0 ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>{e.pedidosAbertos}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Tempo</p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', lineHeight: 1 }}>
                      {e.tempoMedioEntrega > 0 ? `${Math.round(e.tempoMedioEntrega)}m` : '—'}
                    </p>
                  </div>
                </div>

                {/* Workload bar */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Carga atual</span>
                    <span style={{ fontSize: '9px', color: e.pedidosAbertos > 0 ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}>{cargaPct}%</span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cargaPct}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <button onClick={() => handleToggleFolga(e)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    padding: '7px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 700,
                    fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    border: `1px solid ${e.emFolga ? '#6ee7b7' : '#fcd34d'}`,
                    background: e.emFolga ? '#d1fae5' : '#fef3c7',
                    color: e.emFolga ? '#065f46' : '#92400e',
                    transition: 'all 0.15s',
                  }}>
                    <Coffee size={11} strokeWidth={2} />
                    {e.emFolga ? 'Voltar' : 'Folga'}
                  </button>
                  <button onClick={() => openEdit(e)} style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    padding: '7px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 700,
                    fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    border: '1px solid var(--border)', background: 'var(--bg-surface)',
                    color: 'var(--text-secondary)', transition: 'all 0.15s',
                  }}>
                    <Pencil size={11} strokeWidth={2} /> Editar
                  </button>
                  <button onClick={() => setDeleteTarget(e)} style={{
                    padding: '7px 12px', borderRadius: '4px', cursor: 'pointer',
                    border: '1px solid #fecaca', background: '#fff1f1',
                    color: '#c81e1e', transition: 'all 0.15s',
                  }}>
                    <Trash2 size={12} strokeWidth={2} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ── */}
      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
          TeleGás Ops · {entregadores.length} entregadores cadastrados
        </p>
      </footer>

      {/* ── Backdrop ── */}
      {(drawerOpen || deleteTarget) && (
        <div
          onClick={() => { setDrawerOpen(false); setDeleteTarget(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,20,36,0.45)', zIndex: 40, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ── Create / Edit Drawer ── */}
      {drawerOpen && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '360px', height: '100vh',
          background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
          zIndex: 50, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {editTarget ? 'Editar Entregador' : 'Novo Entregador'}
            </h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
              <X size={18} />
            </button>
          </div>

          <div>
            <label style={labelStyle}>Nome</label>
            <input
              style={inputStyle}
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Thiago"
              autoFocus
            />
          </div>

          <div>
            <label style={labelStyle}>Telefone (só números)</label>
            <input
              style={inputStyle}
              value={form.telefone}
              onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
              placeholder="5553999990000"
            />
          </div>

          {editTarget && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="checkbox"
                id="ativo-check"
                checked={form.ativo}
                onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="ativo-check" style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>Ativo</label>
            </div>
          )}

          {formError && (
            <p style={{ fontSize: '12px', color: '#c81e1e', fontFamily: 'var(--font-space-mono)', background: '#fff1f1', padding: '10px 12px', borderRadius: '4px', border: '1px solid #fecaca' }}>
              {formError}
            </p>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={() => setDrawerOpen(false)} style={{
              flex: 1, padding: '11px', borderRadius: '6px', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700,
              fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: '11px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer',
              border: 'none', background: saving ? '#93c5fd' : 'var(--accent)', color: '#fff',
              fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
              transition: 'background 0.15s',
            }}>
              {saving ? 'Salvando...' : editTarget ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px',
          zIndex: 50, padding: '28px 28px 24px', width: '360px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
            Excluir entregador?
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', lineHeight: 1.6, marginBottom: '20px' }}>
            <strong>{deleteTarget.nome}</strong> será removido permanentemente.<br />
            Esta ação não pode ser desfeita.
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setDeleteTarget(null)} style={{
              flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 700,
              fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              Cancelar
            </button>
            <button onClick={handleDelete} disabled={deleting} style={{
              flex: 1, padding: '10px', borderRadius: '6px', cursor: deleting ? 'not-allowed' : 'pointer',
              border: 'none', background: '#c81e1e', color: '#fff',
              fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
