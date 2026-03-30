'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Banknote, QrCode, CreditCard, Wallet, Plus, Pencil, Trash2,
  X, ChevronRight, Check, AlertTriangle, ToggleLeft, ToggleRight,
  RefreshCw,
} from 'lucide-react';

interface FormaPagamento {
  id: number;
  nome: string;
  slug: string;
  aceitaTroco: boolean;
  ativo: boolean;
  ordem: number;
}

/* ── Icon resolver ─────────────────────────────────── */
function PayIcon({ slug, size = 28 }: { slug: string; size?: number }) {
  const s = slug.toLowerCase();
  if (s.includes('pix'))     return <QrCode size={size} strokeWidth={1.3} />;
  if (s.includes('dinheiro') || s.includes('cash')) return <Banknote size={size} strokeWidth={1.3} />;
  if (s.includes('debito'))  return <CreditCard size={size} strokeWidth={1.3} />;
  if (s.includes('credito')) return <CreditCard size={size} strokeWidth={1.3} />;
  return <Wallet size={size} strokeWidth={1.3} />;
}

/* ── Color palette per slug ────────────────────────── */
function accentFor(slug: string): { color: string; bg: string; glow: string } {
  const s = slug.toLowerCase();
  if (s.includes('pix'))     return { color: '#00d084', bg: 'rgba(0,208,132,0.06)', glow: 'rgba(0,208,132,0.18)' };
  if (s.includes('dinheiro'))return { color: '#f5c842', bg: 'rgba(245,200,66,0.06)', glow: 'rgba(245,200,66,0.18)' };
  if (s.includes('debito'))  return { color: '#5b8dee', bg: 'rgba(91,141,238,0.06)', glow: 'rgba(91,141,238,0.18)' };
  if (s.includes('credito')) return { color: '#e05aff', bg: 'rgba(224,90,255,0.06)', glow: 'rgba(224,90,255,0.18)' };
  return { color: 'var(--accent)', bg: 'var(--accent-dim)', glow: 'rgba(100,130,255,0.18)' };
}

/* ── Toggle ────────────────────────────────────────── */
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{
      background: 'none', border: 'none', cursor: 'pointer', padding: 0,
      color: on ? 'var(--green)' : 'var(--text-muted)',
      transition: 'color 0.2s',
      display: 'flex', alignItems: 'center',
    }}>
      {on ? <ToggleRight size={22} strokeWidth={1.5} /> : <ToggleLeft size={22} strokeWidth={1.5} />}
    </button>
  );
}

/* ── Form Drawer ───────────────────────────────────── */
function Drawer({
  open, onClose, initial, onSave,
}: {
  open: boolean;
  onClose: () => void;
  initial: Partial<FormaPagamento> | null;
  onSave: (data: Partial<FormaPagamento>) => Promise<void>;
}) {
  const isEdit = !!initial?.id;
  const [nome, setNome] = useState('');
  const [slug, setSlug] = useState('');
  const [aceitaTroco, setAceitaTroco] = useState(false);
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (open) {
      setNome(initial?.nome ?? '');
      setSlug(initial?.slug ?? '');
      setAceitaTroco(initial?.aceitaTroco ?? false);
      setAtivo(initial?.ativo ?? true);
      setErr('');
    }
  }, [open, initial]);

  const autoSlug = (v: string) =>
    v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const handleNome = (v: string) => {
    setNome(v);
    if (!isEdit) setSlug(autoSlug(v));
  };

  const handleSubmit = async () => {
    if (!nome.trim() || !slug.trim()) { setErr('Nome e slug são obrigatórios'); return; }
    setSaving(true); setErr('');
    try {
      await onSave({ nome: nome.trim(), slug: slug.trim(), aceitaTroco, ativo, ordem: initial?.ordem ?? 0 });
      onClose();
    } catch (e: any) { setErr(e.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  const accent = accentFor(slug);

  return (
    <>
      {/* backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 40,
        background: 'rgba(0,0,0,0.55)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        transition: 'opacity 0.25s',
        backdropFilter: 'blur(2px)',
      }} />

      {/* panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 50,
        width: 400,
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border)',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.32,0,0,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* drawer header */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: `2px solid ${accent.color}`,
          background: accent.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 9, letterSpacing: '0.22em', textTransform: 'uppercase', color: accent.color, fontFamily: 'var(--font-space-mono)', marginBottom: 4 }}>
              {isEdit ? 'Editar' : 'Nova'} Forma de Pagamento
            </p>
            <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {nome || '—'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* preview icon */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 16,
            background: accent.bg,
            border: `1px solid ${accent.color}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent.color,
            boxShadow: `0 0 24px ${accent.glow}`,
          }}>
            <PayIcon slug={slug || nome} size={32} />
          </div>
        </div>

        {/* fields */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <Field label="Nome da Forma de Pagamento">
            <input value={nome} onChange={e => handleNome(e.target.value)}
              placeholder="ex: Dinheiro, PIX, Cartão de Crédito"
              style={inputStyle} />
          </Field>

          <Field label="Identificador (Slug)" hint="Usado pelo sistema e pelo agente">
            <input value={slug} onChange={e => setSlug(autoSlug(e.target.value))}
              placeholder="ex: dinheiro, pix, cartao_credito"
              style={{ ...inputStyle, fontFamily: 'var(--font-space-mono)', fontSize: 12 }} />
          </Field>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 20 }}>
            <ToggleRow
              label="Aceita Troco"
              sub="O agente irá perguntar o valor do troco"
              on={aceitaTroco}
              onChange={setAceitaTroco}
            />
            <ToggleRow
              label="Ativo"
              sub="Disponível para seleção nos pedidos"
              on={ativo}
              onChange={setAtivo}
            />
          </div>

          {err && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', borderRadius: 8, background: 'rgba(220,50,50,0.08)', border: '1px solid rgba(220,50,50,0.25)', color: '#ff6b6b', fontSize: 12, fontFamily: 'var(--font-space-mono)', marginBottom: 16 }}>
              <AlertTriangle size={13} /> {err}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ padding: '16px 28px 24px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleSubmit} disabled={saving} style={{
            width: '100%', padding: '13px 0', borderRadius: 10, border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
            background: accent.color, color: '#000',
            fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: saving ? 0.6 : 1, transition: 'opacity 0.15s',
          }}>
            {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
            {saving ? 'Salvando…' : isEdit ? 'Salvar Alterações' : 'Criar Forma de Pagamento'}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: hint ? 2 : 8 }}>
        {label}
      </p>
      {hint && <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 8 }}>{hint}</p>}
      {children}
    </div>
  );
}

function ToggleRow({ label, sub, on, onChange }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderRadius: 10, background: 'var(--bg-surface-2)',
      border: '1px solid var(--border-subtle)', marginBottom: 10,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{sub}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 14px', borderRadius: 8,
  background: 'var(--bg-surface-2)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)', fontSize: 13,
  outline: 'none',
  fontFamily: 'inherit',
};

/* ── Delete confirm modal ──────────────────────────── */
function DeleteModal({ name, onCancel, onConfirm, loading }: {
  name: string; onCancel: () => void; onConfirm: () => void; loading: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 16, padding: 32, width: 360, textAlign: 'center',
      }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(220,50,50,0.1)', border: '1px solid rgba(220,50,50,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#ff6b6b' }}>
          <AlertTriangle size={22} />
        </div>
        <p style={{ fontSize: 17, fontWeight: 800, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Excluir Forma?
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: 28, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{name}</strong> será removida permanentemente.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-space-mono)', fontSize: 11 }}>
            Cancelar
          </button>
          <button onClick={onConfirm} disabled={loading} style={{ flex: 1, padding: '11px 0', borderRadius: 8, border: 'none', background: '#cc3333', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-barlow)', fontWeight: 700, fontSize: 12, letterSpacing: '0.08em', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Excluindo…' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Payment Card ──────────────────────────────────── */
function PayCard({
  forma, onToggleAtivo, onEdit, onDelete,
}: {
  forma: FormaPagamento;
  onToggleAtivo: (id: number, v: boolean) => void;
  onEdit: (f: FormaPagamento) => void;
  onDelete: (f: FormaPagamento) => void;
}) {
  const accent = accentFor(forma.slug);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 0,
        background: forma.ativo ? accent.bg : 'var(--bg-surface)',
        border: `1px solid ${hovered ? accent.color + '55' : 'var(--border)'}`,
        borderRadius: 14, overflow: 'hidden',
        opacity: forma.ativo ? 1 : 0.5,
        transition: 'all 0.2s',
        boxShadow: hovered && forma.ativo ? `0 0 20px ${accent.glow}` : 'none',
        position: 'relative',
      }}
    >
      {/* left accent bar */}
      <div style={{
        width: 4, alignSelf: 'stretch', flexShrink: 0,
        background: forma.ativo ? accent.color : 'var(--border)',
        transition: 'background 0.2s',
      }} />

      {/* icon zone */}
      <div style={{
        width: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '22px 0',
        color: forma.ativo ? accent.color : 'var(--text-muted)',
        transition: 'color 0.2s',
      }}>
        <PayIcon slug={forma.slug} size={30} />
      </div>

      {/* main info */}
      <div style={{ flex: 1, padding: '18px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{
            fontSize: 20, fontWeight: 900, fontFamily: 'var(--font-barlow)',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            color: forma.ativo ? 'var(--text-primary)' : 'var(--text-muted)',
          }}>
            {forma.nome}
          </span>
          {forma.aceitaTroco && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-space-mono)', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: '#f5c842', background: 'rgba(245,200,66,0.12)',
              border: '1px solid rgba(245,200,66,0.3)',
              padding: '3px 8px', borderRadius: 4,
            }}>
              Troco
            </span>
          )}
          {!forma.ativo && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-space-mono)', fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              color: 'var(--text-muted)', background: 'var(--bg-surface-3)',
              border: '1px solid var(--border)',
              padding: '3px 8px', borderRadius: 4,
            }}>
              Inativo
            </span>
          )}
        </div>
        <code style={{
          fontSize: 10, fontFamily: 'var(--font-space-mono)', color: forma.ativo ? accent.color : 'var(--text-muted)',
          background: forma.ativo ? `${accent.color}11` : 'var(--bg-surface-3)',
          border: `1px solid ${forma.ativo ? accent.color + '33' : 'var(--border)'}`,
          padding: '2px 8px', borderRadius: 4, letterSpacing: '0.06em',
        }}>
          {forma.slug}
        </code>
      </div>

      {/* right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 20px', borderLeft: '1px solid var(--border-subtle)' }}>
        <Toggle on={forma.ativo} onChange={v => onToggleAtivo(forma.id, v)} />
        <button onClick={() => onEdit(forma)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          <Pencil size={14} />
        </button>
        <button onClick={() => onDelete(forma)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: 6, transition: 'color 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#ff6b6b')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
          <Trash2 size={14} />
        </button>
        <ChevronRight size={14} style={{ color: 'var(--border)', marginLeft: 4 }} />
      </div>
    </div>
  );
}

/* ── Page ──────────────────────────────────────────── */
export default function PagamentosPage() {
  const [formas, setFormas]           = useState<FormaPagamento[]>([]);
  const [loading, setLoading]         = useState(true);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<FormaPagamento | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FormaPagamento | null>(null);
  const [deleting, setDeleting]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setFormas(await api.getFormasPagamento()); } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditTarget(null); setDrawerOpen(true); };
  const openEdit   = (f: FormaPagamento) => { setEditTarget(f); setDrawerOpen(true); };

  const handleSave = async (data: Partial<FormaPagamento>) => {
    if (editTarget) {
      await api.atualizarFormaPagamento(editTarget.id, data);
    } else {
      await api.criarFormaPagamento(data as any);
    }
    await load();
  };

  const handleToggleAtivo = async (id: number, ativo: boolean) => {
    await api.atualizarFormaPagamento(id, { ativo });
    setFormas(prev => prev.map(f => f.id === id ? { ...f, ativo } : f));
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.excluirFormaPagamento(deleteTarget.id);
      setFormas(prev => prev.filter(f => f.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch { /* silent */ }
    finally { setDeleting(false); }
  };

  const ativas = formas.filter(f => f.ativo).length;

  return (
    <main style={{ padding: '36px 32px', width: '100%', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pay-card-row { animation: fadeSlideUp 0.35s ease both; }
        .pay-card-row:nth-child(1) { animation-delay: 0.04s }
        .pay-card-row:nth-child(2) { animation-delay: 0.10s }
        .pay-card-row:nth-child(3) { animation-delay: 0.16s }
        .pay-card-row:nth-child(4) { animation-delay: 0.22s }
        .pay-card-row:nth-child(5) { animation-delay: 0.28s }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 40, flexWrap: 'wrap', gap: 20 }}>
        <div>
          <p style={{
            fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 6,
          }}>
            Configuração · Gateway
          </p>
          <h1 style={{
            fontSize: 38, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase',
            color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', lineHeight: 1, margin: 0,
          }}>
            Pagamentos
          </h1>

          {/* stat strip */}
          <div style={{ display: 'flex', gap: 24, marginTop: 16 }}>
            <StatPill label="Total" value={formas.length} />
            <StatPill label="Ativos" value={ativas} accent="var(--green)" />
            <StatPill label="Inativos" value={formas.length - ativas} accent="var(--text-muted)" />
            <StatPill label="Aceitam Troco" value={formas.filter(f => f.aceitaTroco).length} accent="#f5c842" />
          </div>
        </div>

        <button onClick={openCreate} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 22px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#fff',
          fontFamily: 'var(--font-barlow)', fontWeight: 800, fontSize: 13,
          letterSpacing: '0.08em', textTransform: 'uppercase',
        }}>
          <Plus size={15} />
          Nova Forma
        </button>
      </div>

      {/* ── Cards ── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }}>
          <RefreshCw size={20} style={{ color: 'var(--text-muted)', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : formas.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: 240, border: '1px dashed var(--border)', borderRadius: 16, gap: 16,
        }}>
          <CreditCard size={32} style={{ color: 'var(--text-muted)', opacity: 0.4 }} strokeWidth={1} />
          <p style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
            Nenhuma forma de pagamento cadastrada
          </p>
          <button onClick={openCreate} style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-space-mono)', textDecoration: 'underline' }}>
            Adicionar primeira forma
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {formas.map(f => (
            <div key={f.id} className="pay-card-row">
              <PayCard
                forma={f}
                onToggleAtivo={handleToggleAtivo}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        initial={editTarget}
        onSave={handleSave}
      />

      {/* ── Delete confirm ── */}
      {deleteTarget && (
        <DeleteModal
          name={deleteTarget.nome}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}
    </main>
  );
}

function StatPill({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 22, fontWeight: 900, fontFamily: 'var(--font-barlow)', color: accent ?? 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
  );
}
