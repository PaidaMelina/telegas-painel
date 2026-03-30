'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Archive, Plus, Pencil, Box, X, TrendingUp, TrendingDown,
  AlertTriangle, ToggleLeft, ToggleRight, RefreshCw, Package,
} from 'lucide-react';

interface Produto {
  id: number;
  nome: string;
  preco: number;
  unidade: string;
  ativo: boolean;
  quantidade: number;
  quantidadeMinima: number;
  estoqueBaixo: boolean;
}

interface Movimento {
  id: number;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  created_at: string;
}

const TIPO_META: Record<string, { bg: string; color: string; border: string; label: string; sign: string }> = {
  entrada: { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7', label: 'Entrada', sign: '+' },
  saida:   { bg: '#fff1f1', color: '#991b1b', border: '#fca5a5', label: 'Saída',   sign: '−' },
  ajuste:  { bg: '#ebf1fe', color: '#1e3fa8', border: '#a5bcf7', label: 'Ajuste',  sign: '≈' },
};

const UNIDADES = ['unidade', 'kg', 'litro', 'caixa', 'fardo', 'par'];

type DrawerMode = 'create' | 'edit' | 'stock' | null;

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [selected, setSelected] = useState<Produto | null>(null);

  const [fNome, setFNome] = useState('');
  const [fPreco, setFPreco] = useState('');
  const [fUnidade, setFUnidade] = useState('unidade');
  const [fQtdInicial, setFQtdInicial] = useState('0');
  const [fQtdMin, setFQtdMin] = useState('5');
  const [fAtivo, setFAtivo] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [formErro, setFormErro] = useState('');

  const [movTipo, setMovTipo] = useState<'entrada' | 'saida' | 'ajuste'>('entrada');
  const [movQtd, setMovQtd] = useState('');
  const [movObs, setMovObs] = useState('');
  const [movLoading, setMovLoading] = useState(false);
  const [movErro, setMovErro] = useState('');
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [movHistLoading, setMovHistLoading] = useState(false);

  const fetchProdutos = useCallback(async () => {
    setLoading(true); setErro('');
    try {
      const data = await api.getProdutos(true);
      setProdutos(data);
    } catch { setErro('Erro ao carregar produtos.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchProdutos(); }, [fetchProdutos]);

  const openCreate = () => {
    setFNome(''); setFPreco(''); setFUnidade('unidade');
    setFQtdInicial('0'); setFQtdMin('5'); setFormErro('');
    setDrawer('create');
  };

  const openEdit = (p: Produto) => {
    setSelected(p);
    setFNome(p.nome); setFPreco(String(p.preco));
    setFUnidade(p.unidade); setFQtdMin(String(p.quantidadeMinima));
    setFAtivo(p.ativo); setFormErro('');
    setDrawer('edit');
  };

  const openStock = async (p: Produto) => {
    setSelected(p);
    setMovTipo('entrada'); setMovQtd(''); setMovObs(''); setMovErro('');
    setDrawer('stock');
    setMovHistLoading(true);
    try {
      const data = await api.getMovimentosProduto(p.id);
      setMovimentos(data);
    } catch { setMovimentos([]); }
    finally { setMovHistLoading(false); }
  };

  const closeDrawer = () => { setDrawer(null); setSelected(null); };

  const handleCreate = async () => {
    if (!fNome.trim() || !fPreco) { setFormErro('Nome e preço são obrigatórios.'); return; }
    setFormLoading(true); setFormErro('');
    try {
      await api.criarProduto({
        nome: fNome.trim(),
        preco: parseFloat(fPreco),
        unidade: fUnidade,
        quantidade: parseInt(fQtdInicial) || 0,
        quantidadeMinima: parseInt(fQtdMin) || 5,
      });
      closeDrawer();
      await fetchProdutos();
    } catch (e: any) { setFormErro(e.message || 'Erro ao criar produto'); }
    finally { setFormLoading(false); }
  };

  const handleEdit = async () => {
    if (!selected || !fNome.trim() || !fPreco) { setFormErro('Nome e preço são obrigatórios.'); return; }
    setFormLoading(true); setFormErro('');
    try {
      await api.atualizarProduto(selected.id, {
        nome: fNome.trim(),
        preco: parseFloat(fPreco),
        unidade: fUnidade,
        quantidadeMinima: parseInt(fQtdMin) || 5,
        ativo: fAtivo,
      });
      closeDrawer();
      await fetchProdutos();
    } catch (e: any) { setFormErro(e.message || 'Erro ao atualizar produto'); }
    finally { setFormLoading(false); }
  };

  const handleMovimento = async () => {
    if (!selected || !movQtd || parseFloat(movQtd) <= 0) { setMovErro('Informe uma quantidade válida.'); return; }
    setMovLoading(true); setMovErro('');
    try {
      await api.atualizarEstoque(selected.id, movTipo, parseFloat(movQtd), movObs || undefined);
      setMovQtd(''); setMovObs('');
      const [, movData] = await Promise.all([
        fetchProdutos(),
        api.getMovimentosProduto(selected.id),
      ]);
      setMovimentos(movData);
      setProdutos(prev => {
        const updated = prev.find(p => p.id === selected.id);
        if (updated) setSelected(updated);
        return prev;
      });
    } catch (e: any) { setMovErro(e.message || 'Erro ao registrar movimento'); }
    finally { setMovLoading(false); }
  };

  const handleToggleAtivo = async (p: Produto) => {
    try {
      await api.atualizarProduto(p.id, { ativo: !p.ativo });
      await fetchProdutos();
    } catch { /* silent */ }
  };

  const fmtDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  const stockLevel = (p: Produto): 'zero' | 'low' | 'ok' => {
    if (p.quantidade === 0) return 'zero';
    if (p.estoqueBaixo) return 'low';
    return 'ok';
  };

  const stockAccent = (level: 'zero' | 'low' | 'ok') => ({
    zero: { text: '#c81e1e', bg: '#fff1f1', border: '#fca5a5', bar: '#c81e1e' },
    low:  { text: '#92400e', bg: '#fef8ec', border: '#fcd97d', bar: '#c27803' },
    ok:   { text: '#065f46', bg: '#ecfdf5', border: '#6ee7b7', bar: '#059669' },
  }[level]);

  const barPct = (p: Produto) => {
    const max = Math.max(p.quantidadeMinima * 2, p.quantidade, 1);
    return Math.min((p.quantidade / max) * 100, 100);
  };

  const ativos = produtos.filter(p => p.ativo).length;
  const semEstoque = produtos.filter(p => p.ativo && p.quantidade === 0).length;
  const baixo = produtos.filter(p => p.ativo && p.estoqueBaixo && p.quantidade > 0).length;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--bg-base)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '10px 12px',
    fontSize: '13px',
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: 'var(--font-space-mono)',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-space-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '6px',
    display: 'block',
  };

  return (
    <main style={{ padding: '32px 28px', width: '100%', minHeight: '100vh', position: 'relative', zIndex: 10 }}>

      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px' }}>
            Estoque
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Archive size={22} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
            <h1 style={{ fontSize: '30px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1, color: 'var(--text-primary)' }}>
              Produtos
            </h1>
          </div>
          {!loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em' }}>
                {ativos} ativo{ativos !== 1 ? 's' : ''}
              </span>
              {baixo > 0 && (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#fef8ec', color: '#92400e', border: '1px solid #fcd97d', fontFamily: 'var(--font-space-mono)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {baixo} baixo
                </span>
              )}
              {semEstoque > 0 && (
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: '#fff1f1', color: '#991b1b', border: '1px solid #fca5a5', fontFamily: 'var(--font-space-mono)', fontWeight: 700, letterSpacing: '0.04em' }}>
                  {semEstoque} sem estoque
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button
            onClick={fetchProdutos}
            title="Recarregar"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '6px', padding: '9px 12px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: '0 1px 3px rgba(13,20,36,0.06)' }}
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'var(--accent)', border: 'none', borderRadius: '6px', padding: '9px 18px', color: '#fff', fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer', boxShadow: '0 2px 8px rgba(37,87,231,0.25)' }}
          >
            <Plus size={14} /> Novo Produto
          </button>
        </div>
      </header>

      {/* ── Error ── */}
      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '8px', border: '1px solid #fca5a5', background: '#fff1f1', color: '#991b1b', marginBottom: '20px', fontSize: '13px' }}>
          <AlertTriangle size={15} /><span>{erro}</span>
        </div>
      )}

      {/* ── Grid ── */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          <span className="live-dot" style={{ marginRight: '10px' }} /> Carregando produtos...
        </div>
      ) : produtos.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', gap: '14px', color: 'var(--text-muted)' }}>
          <Package size={36} style={{ opacity: 0.25 }} />
          <p style={{ fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>Nenhum produto cadastrado.</p>
          <button onClick={openCreate} style={{ fontSize: '11px', padding: '9px 20px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'var(--accent-dim)', color: 'var(--accent)', cursor: 'pointer', fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}>
            Criar primeiro produto
          </button>
        </div>
      ) : (
        <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '16px' }}>
          {produtos.map(p => {
            const level = stockLevel(p);
            const sa = stockAccent(level);
            return (
              <div
                key={p.id}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderTop: `3px solid ${p.ativo ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: '10px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  boxShadow: '0 1px 4px rgba(13,20,36,0.06), 0 4px 16px rgba(13,20,36,0.04)',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  opacity: p.ativo ? 1 : 0.55,
                  position: 'relative',
                }}
              >
                {/* ── Name row ── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-barlow)',
                      color: 'var(--text-primary)', textTransform: 'uppercase',
                      letterSpacing: '0.05em', lineHeight: 1.2,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.nome}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginTop: '2px' }}>
                      {p.unidade}
                    </p>
                  </div>
                  <button
                    onClick={() => handleToggleAtivo(p)}
                    title={p.ativo ? 'Desativar' : 'Ativar'}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: p.ativo ? 'var(--accent)' : 'var(--text-muted)', padding: '2px', flexShrink: 0 }}
                  >
                    {p.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  </button>
                </div>

                {/* ── Price ── */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>R$</span>
                  <span style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
                    {p.preco.toFixed(2)}
                  </span>
                </div>

                {/* ── Stock block ── */}
                <div style={{ background: sa.bg, border: `1px solid ${sa.border}`, borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontSize: '10px', color: sa.text, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, opacity: 0.75 }}>
                      Estoque
                    </span>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      {p.quantidade === 0 && (
                        <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: '#c81e1e', color: '#fff', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Sem estoque
                        </span>
                      )}
                      {p.estoqueBaixo && p.quantidade > 0 && (
                        <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: '#c27803', color: '#fff', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Baixo
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '10px' }}>
                    <span style={{ fontSize: '28px', fontWeight: 900, fontFamily: 'var(--font-barlow)', color: sa.text, lineHeight: 1 }}>
                      {p.quantidade}
                    </span>
                    <span style={{ fontSize: '12px', color: sa.text, fontFamily: 'var(--font-space-mono)', opacity: 0.75 }}>
                      {p.unidade}
                    </span>
                    <span style={{ fontSize: '10px', color: sa.text, fontFamily: 'var(--font-space-mono)', marginLeft: '4px', opacity: 0.6 }}>
                      / mín {p.quantidadeMinima}
                    </span>
                  </div>

                  <div style={{ height: '4px', background: 'rgba(0,0,0,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barPct(p)}%`, background: sa.bar, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>

                {/* ── Action buttons ── */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => openEdit(p)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
                      borderRadius: '6px', padding: '8px',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                      fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      transition: 'background 0.15s, border-color 0.15s',
                    }}
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    onClick={() => openStock(p)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      background: 'var(--accent-dim)', border: '1px solid var(--accent)',
                      borderRadius: '6px', padding: '8px',
                      color: 'var(--accent)', cursor: 'pointer',
                      fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      transition: 'background 0.15s',
                    }}
                  >
                    <Box size={12} /> Estoque
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Backdrop ── */}
      {drawer !== null && (
        <div
          onClick={closeDrawer}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,20,36,0.35)', zIndex: 100, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ── Create / Edit Drawer ── */}
      {(drawer === 'create' || drawer === 'edit') && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '420px', height: '100vh',
          background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
          zIndex: 101, display: 'flex', flexDirection: 'column', overflowY: 'auto',
          boxShadow: '-8px 0 32px rgba(13,20,36,0.10)',
        }}>
          <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} style={{ color: 'var(--accent)' }} />
              </div>
              <span style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                {drawer === 'create' ? 'Novo Produto' : 'Editar Produto'}
              </span>
            </div>
            <button onClick={closeDrawer} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
            <div>
              <label style={labelStyle}>Nome do Produto</label>
              <input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="ex: Gás 13kg" style={inputStyle} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Preço (R$)</label>
                <input type="number" min="0" step="0.01" value={fPreco} onChange={e => setFPreco(e.target.value)} placeholder="0.00" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Unidade</label>
                <select value={fUnidade} onChange={e => setFUnidade(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            {drawer === 'create' && (
              <div>
                <label style={labelStyle}>Estoque Inicial</label>
                <input type="number" min="0" value={fQtdInicial} onChange={e => setFQtdInicial(e.target.value)} placeholder="0" style={inputStyle} />
              </div>
            )}

            <div>
              <label style={labelStyle}>Estoque Mínimo (alerta)</label>
              <input type="number" min="0" value={fQtdMin} onChange={e => setFQtdMin(e.target.value)} placeholder="5" style={inputStyle} />
            </div>

            {drawer === 'edit' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <div>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}>Produto ativo</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Aparece na portaria e para o agente</p>
                </div>
                <button onClick={() => setFAtivo(v => !v)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: fAtivo ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {fAtivo ? <ToggleRight size={26} /> : <ToggleLeft size={26} />}
                </button>
              </div>
            )}

            {formErro && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '6px', background: '#fff1f1', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '12px', fontFamily: 'var(--font-space-mono)' }}>
                <AlertTriangle size={13} /> {formErro}
              </div>
            )}

            <button
              onClick={drawer === 'create' ? handleCreate : handleEdit}
              disabled={formLoading}
              style={{
                padding: '13px', background: 'var(--accent)', border: 'none', borderRadius: '6px',
                color: '#fff', fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: formLoading ? 'not-allowed' : 'pointer',
                opacity: formLoading ? 0.65 : 1,
                marginTop: 'auto',
                boxShadow: '0 2px 8px rgba(37,87,231,0.22)',
              }}
            >
              {formLoading ? 'Salvando...' : drawer === 'create' ? 'Criar Produto' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {/* ── Stock Movement Drawer ── */}
      {drawer === 'stock' && selected && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '420px', height: '100vh',
          background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
          zIndex: 101, display: 'flex', flexDirection: 'column', overflowY: 'auto',
          boxShadow: '-8px 0 32px rgba(13,20,36,0.10)',
        }}>
          <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <span style={{ fontSize: '15px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
                Movimentação
              </span>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginTop: '2px' }}>{selected.nome}</p>
            </div>
            <button onClick={closeDrawer} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
            {/* Current stock */}
            {(() => {
              const level = stockLevel(selected);
              const sa = stockAccent(level);
              return (
                <div style={{ background: sa.bg, border: `1px solid ${sa.border}`, borderRadius: '8px', padding: '14px 16px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '10px', color: sa.text, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', opacity: 0.75 }}>
                    Estoque Atual
                  </p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                    <span style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'var(--font-barlow)', color: sa.text, lineHeight: 1 }}>{selected.quantidade}</span>
                    <span style={{ fontSize: '13px', color: sa.text, fontFamily: 'var(--font-space-mono)', opacity: 0.7 }}>{selected.unidade}</span>
                  </div>
                </div>
              );
            })()}

            {/* Tipo tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              {(['entrada', 'saida', 'ajuste'] as const).map(t => {
                const m = TIPO_META[t];
                const active = movTipo === t;
                return (
                  <button
                    key={t}
                    onClick={() => setMovTipo(t)}
                    style={{
                      flex: 1, padding: '8px 4px',
                      border: `1px solid ${active ? m.border : 'var(--border)'}`,
                      background: active ? m.bg : 'transparent',
                      color: active ? m.color : 'var(--text-muted)',
                      fontFamily: 'var(--font-space-mono)', fontSize: '10px', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                    }}
                  >
                    {t === 'entrada' ? <TrendingUp size={11} /> : t === 'saida' ? <TrendingDown size={11} /> : null}
                    {t.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={labelStyle}>Quantidade</label>
              <input
                type="number" min="1" value={movQtd}
                onChange={e => setMovQtd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMovimento()}
                placeholder="0"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Observação (opcional)</label>
              <input
                value={movObs} onChange={e => setMovObs(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMovimento()}
                placeholder="ex: Reposição semanal"
                style={inputStyle}
              />
            </div>

            {movErro && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '6px', background: '#fff1f1', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '12px', fontFamily: 'var(--font-space-mono)', marginBottom: '12px' }}>
                <AlertTriangle size={13} /> {movErro}
              </div>
            )}

            {(() => {
              const m = TIPO_META[movTipo];
              return (
                <button
                  onClick={handleMovimento}
                  disabled={movLoading}
                  style={{
                    width: '100%', padding: '12px',
                    background: m.bg, border: `1px solid ${m.border}`,
                    borderRadius: '6px', color: m.color,
                    fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: movLoading ? 'not-allowed' : 'pointer',
                    opacity: movLoading ? 0.65 : 1,
                  }}
                >
                  {movLoading ? 'Registrando...' : `Registrar ${m.label}`}
                </button>
              );
            })()}
          </div>

          {/* Movement history */}
          <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '14px' }}>
              Últimos Movimentos
            </p>
            {movHistLoading ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Carregando...</p>
            ) : movimentos.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Nenhum movimento registrado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {movimentos.map(m => {
                  const meta = TIPO_META[m.tipo] ?? TIPO_META.ajuste;
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                        {meta.sign} {meta.label}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)' }}>
                          {m.quantidade} {selected.unidade}
                        </p>
                        {m.observacao && (
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.observacao}
                          </p>
                        )}
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', flexShrink: 0 }}>
                        {fmtDate(m.created_at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
