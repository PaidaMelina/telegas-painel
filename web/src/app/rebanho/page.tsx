'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { rebanhoApi, Animal } from '@/lib/rebanho-client';
import { Beef, Plus, X, Search, Users } from 'lucide-react';

const EMPTY_FORM = { brinco: '', categoria: '', pesoInicial: '', observacoes: '' };

export default function RebanhoPage() {
  const [animais, setAnimais] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const reload = (q?: string) =>
    rebanhoApi.getAnimais(q).then(setAnimais).catch(console.error);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => reload(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  function openCreate() {
    setForm(EMPTY_FORM);
    setFormError('');
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.brinco.trim()) {
      setFormError('Informe o brinco.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await rebanhoApi.criarAnimal({
        brinco: form.brinco.trim(),
        categoria: form.categoria.trim() || undefined,
        pesoInicial: form.pesoInicial ? Number(form.pesoInicial) : undefined,
        observacoes: form.observacoes.trim() || undefined,
      });
      setDrawerOpen(false);
      reload(search);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
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

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '32px 28px', width: '100%' }}>

      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px' }}>
            Fazenda
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Beef size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '30px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
              Rebanho
            </h1>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: '6px' }}>
            {animais.length} animais cadastrados
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por brinco"
              style={{ ...inputStyle, width: '200px', padding: '8px 12px 8px 30px', fontSize: '12px' }}
            />
          </div>
          <Link href="/rebanho/funcionarios" style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '4px', border: '1px solid var(--border)', cursor: 'pointer',
            background: 'var(--bg-surface)', color: 'var(--text-secondary)',
            fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-space-mono)',
            textTransform: 'uppercase', letterSpacing: '0.05em', textDecoration: 'none',
          }}>
            <Users size={13} strokeWidth={2.5} /> Funcionários
          </Link>
          <button onClick={openCreate} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff',
            fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-space-mono)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <Plus size={13} strokeWidth={2.5} /> Novo animal
          </button>
        </div>
      </header>

      {/* ── List ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          <span className="live-dot" style={{ marginRight: '10px', display: 'inline-block' }} /> Carregando...
        </div>
      ) : animais.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          Nenhum animal encontrado.
        </div>
      ) : (
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' }}>
          {animais.map((a) => {
            const variacao = a.pesoAtual != null && a.pesoInicial != null ? a.pesoAtual - a.pesoInicial : null;
            return (
              <Link key={a.id} href={`/rebanho/${a.id}`} style={{ textDecoration: 'none' }}>
                <div className="kpi-card" style={{ borderTop: '2px solid var(--accent)', padding: '18px 20px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <p style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', letterSpacing: '0.04em' }}>
                      #{a.brinco}
                    </p>
                    {a.categoria && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '3px',
                        background: 'var(--bg-surface-3)', color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {a.categoria}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '28px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>
                    {a.pesoAtual != null ? `${a.pesoAtual} kg` : '—'}
                  </p>
                  <p style={{ fontSize: '11px', marginTop: '6px', fontFamily: 'var(--font-space-mono)', color: variacao == null ? 'var(--text-muted)' : variacao >= 0 ? '#047857' : '#c81e1e' }}>
                    {variacao == null ? 'sem histórico' : `${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)} kg desde o início`}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* ── Backdrop ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,20,36,0.45)', zIndex: 40, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ── Create Drawer ── */}
      {drawerOpen && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '360px', height: '100vh',
          background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
          zIndex: 50, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Novo Animal
            </h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
              <X size={18} />
            </button>
          </div>

          <div>
            <label style={labelStyle}>Brinco</label>
            <input style={inputStyle} value={form.brinco} onChange={e => setForm(f => ({ ...f, brinco: e.target.value }))} placeholder="Ex: 123" autoFocus />
          </div>

          <div>
            <label style={labelStyle}>Categoria (opcional)</label>
            <input style={inputStyle} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} placeholder="Ex: Parida, Terneiro..." />
          </div>

          <div>
            <label style={labelStyle}>Peso inicial em kg (opcional)</label>
            <input type="number" style={inputStyle} value={form.pesoInicial} onChange={e => setForm(f => ({ ...f, pesoInicial: e.target.value }))} placeholder="Ex: 180" />
          </div>

          <div>
            <label style={labelStyle}>Observações (opcional)</label>
            <input style={inputStyle} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>

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
            }}>
              {saving ? 'Salvando...' : 'Criar'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
