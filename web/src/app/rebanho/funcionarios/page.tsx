'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { rebanhoApi, Funcionario } from '@/lib/rebanho-client';
import { ArrowLeft, Plus, Pencil, KeyRound, X } from 'lucide-react';

const EMPTY_FORM = { nome: '', telefone: '', senha: '', ativo: true };

export default function FuncionariosPage() {
  const router = useRouter();
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Funcionario | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [senhaTarget, setSenhaTarget] = useState<Funcionario | null>(null);
  const [senhaValue, setSenhaValue] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);
  const [senhaError, setSenhaError] = useState('');

  const reload = () =>
    rebanhoApi.getFuncionarios().then(setFuncionarios).catch(console.error);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setDrawerOpen(true);
  }

  function openEdit(f: Funcionario) {
    setEditTarget(f);
    setForm({ nome: f.nome, telefone: f.telefone, senha: '', ativo: f.ativo });
    setFormError('');
    setDrawerOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.telefone.trim()) {
      setFormError('Preencha nome e telefone.');
      return;
    }
    if (!editTarget && form.senha.length < 4) {
      setFormError('Senha deve ter pelo menos 4 caracteres.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editTarget) {
        await rebanhoApi.atualizarFuncionario(editTarget.id, { nome: form.nome, telefone: form.telefone, ativo: form.ativo });
      } else {
        await rebanhoApi.criarFuncionario({ nome: form.nome, telefone: form.telefone, senha: form.senha });
      }
      setDrawerOpen(false);
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSenha() {
    if (!senhaTarget) return;
    setSavingSenha(true);
    setSenhaError('');
    try {
      await rebanhoApi.definirSenhaFuncionario(senhaTarget.id, senhaValue);
      setSenhaTarget(null);
      setSenhaValue('');
    } catch (err) {
      setSenhaError(err instanceof Error ? err.message : 'Erro ao definir senha');
    } finally {
      setSavingSenha(false);
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
      <button onClick={() => router.push('/rebanho')} style={{
        display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: '20px', padding: 0,
      }}>
        <ArrowLeft size={13} /> Voltar
      </button>

      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px' }}>
            Rebanho
          </p>
          <h1 style={{ fontSize: '30px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
            Funcionários de campo
          </h1>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: '6px' }}>
            acesso ao app de lançamento de peso
          </p>
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
      </header>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          Carregando...
        </div>
      ) : funcionarios.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          Nenhum funcionário cadastrado.
        </div>
      ) : (
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
          {funcionarios.map((f) => (
            <div key={f.id} className="kpi-card" style={{ borderTop: f.ativo ? '2px solid #047857' : '2px solid var(--border)', padding: '18px 20px', opacity: f.ativo ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {f.nome}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginTop: '4px' }}>
                    {f.telefone.replace(/^55/, '')}
                  </p>
                </div>
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '3px',
                  background: f.ativo ? '#d1fae5' : '#f1f5f9', color: f.ativo ? '#065f46' : '#4a5568',
                  fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {f.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                <button onClick={() => openEdit(f)} style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                  padding: '7px 0', borderRadius: '4px', cursor: 'pointer', fontSize: '10px', fontWeight: 700,
                  fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.05em',
                  border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)',
                }}>
                  <Pencil size={11} strokeWidth={2} /> Editar
                </button>
                <button onClick={() => { setSenhaTarget(f); setSenhaValue(''); setSenhaError(''); }} style={{
                  padding: '7px 10px', borderRadius: '4px', cursor: 'pointer',
                  border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', display: 'flex', alignItems: 'center',
                }} title="Definir senha">
                  <KeyRound size={12} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Backdrop ── */}
      {(drawerOpen || senhaTarget) && (
        <div
          onClick={() => { setDrawerOpen(false); setSenhaTarget(null); }}
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
              {editTarget ? 'Editar Funcionário' : 'Novo Funcionário'}
            </h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
              <X size={18} />
            </button>
          </div>

          <div>
            <label style={labelStyle}>Nome</label>
            <input style={inputStyle} value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: José" autoFocus />
          </div>

          <div>
            <label style={labelStyle}>Telefone (só números)</label>
            <input style={inputStyle} value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="5553999990000" />
          </div>

          {!editTarget && (
            <div>
              <label style={labelStyle}>Senha</label>
              <input type="password" style={inputStyle} value={form.senha} onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} placeholder="Mínimo 4 caracteres" />
            </div>
          )}

          {editTarget && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="checkbox" id="ativo-check" checked={form.ativo} onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
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
              border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)',
              fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: '11px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer',
              border: 'none', background: saving ? '#93c5fd' : 'var(--accent)', color: '#fff',
              fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              {saving ? 'Salvando...' : editTarget ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </div>
      )}

      {/* ── Senha Modal ── */}
      {senhaTarget && (
        <div style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px',
          zIndex: 50, padding: '28px 28px 24px', width: '360px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
            Definir senha
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '18px' }}>
            {senhaTarget.nome}
          </p>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Nova senha</label>
            <input type="password" style={inputStyle} value={senhaValue} onChange={e => setSenhaValue(e.target.value)} placeholder="Mínimo 4 caracteres" autoFocus />
          </div>
          {senhaError && (
            <p style={{ fontSize: '12px', color: '#c81e1e', fontFamily: 'var(--font-space-mono)', background: '#fff1f1', padding: '10px 12px', borderRadius: '4px', border: '1px solid #fecaca', marginBottom: '12px' }}>
              {senhaError}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setSenhaTarget(null)} style={{
              flex: 1, padding: '10px', borderRadius: '6px', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)',
              fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              Cancelar
            </button>
            <button onClick={handleSenha} disabled={savingSenha || senhaValue.length < 4} style={{
              flex: 1, padding: '10px', borderRadius: '6px', cursor: savingSenha || senhaValue.length < 4 ? 'not-allowed' : 'pointer',
              border: 'none', background: savingSenha || senhaValue.length < 4 ? '#93c5fd' : 'var(--accent)', color: '#fff',
              fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              {savingSenha ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
