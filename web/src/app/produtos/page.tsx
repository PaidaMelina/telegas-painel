'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Archive, Plus, Pencil, Box, X, TrendingUp, TrendingDown,
  AlertTriangle, ToggleLeft, ToggleRight, RefreshCw,
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

const TIPO_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  entrada: { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  saida: { bg: '#fff1f1', color: '#991b1b', border: '#fca5a5' },
  ajuste: { bg: 'var(--accent-dim)', color: 'var(--accent)', border: 'var(--accent)' },
};

const UNIDADES = ['unidade', 'kg', 'litro', 'caixa', 'fardo', 'par'];

type DrawerMode = 'create' | 'edit' | 'stock' | null;

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [drawer, setDrawer] = useState<DrawerMode>(null);
  const [selected, setSelected] = useState<Produto | null>(null);

  // Form state — create/edit
  const [fNome, setFNome] = useState('');
  const [fPreco, setFPreco] = useState('');
  const [fUnidade, setFUnidade] = useState('unidade');
  const [fQtdInicial, setFQtdInicial] = useState('0');
  const [fQtdMin, setFQtdMin] = useState('5');
  const [fAtivo, setFAtivo] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  const [formErro, setFormErro] = useState('');

  // Stock movement state
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
      // Refresh both the list and movements
      const [, movData] = await Promise.all([
        fetchProdutos(),
        api.getMovimentosProduto(selected.id),
      ]);
      setMovimentos(movData);
      // Update selected with new stock
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
    new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const getStockColor = (p: Produto) => {
    if (p.quantidade === 0) return '#c81e1e';
    if (p.estoqueBaixo) return '#c27803';
    return '#047857';
  };

  const getStockBg = (p: Produto) => {
    if (p.quantidade === 0) return '#fff1f1';
    if (p.estoqueBaixo) return '#fffbeb';
    return '#ecfdf5';
  };

  const getBarColor = (p: Produto) => {
    if (p.quantidade === 0) return '#c81e1e';
    if (p.estoqueBaixo) return '#c27803';
    return 'var(--accent)';
  };

  const getBarPct = (p: Produto) => {
    const max = Math.max(p.quantidadeMinima * 2, p.quantidade, 1);
    return Math.min((p.quantidade / max) * 100, 100);
  };

  const ativos = produtos.filter(p => p.ativo).length;
  const baixo = produtos.filter(p => p.estoqueBaixo && p.ativo).length;

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border)',
    borderRadius: '4px', padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)',
    outline: 'none', fontFamily: 'var(--font-space-mono)', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)',
    textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px', display: 'block',
  };

  const tabBtnStyle = (active: boolean, tipo: string): React.CSSProperties => {
    const colors = TIPO_COLORS[tipo];
    return {
      flex: 1, padding: '8px', border: '1px solid',
      borderColor: active ? colors.border : 'var(--border)',
      background: active ? colors.bg : 'transparent',
      color: active ? colors.color : 'var(--text-muted)',
      fontFamily: 'var(--font-space-mono)', fontSize: '10px', fontWeight: 700,
      textTransform: 'uppercase' as const, letterSpacing: '0.06em',
      cursor: 'pointer', borderRadius: '4px', transition: 'all 0.15s',
    };
  };

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '32px 28px', width: '100%' }}>

      {/* Header */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px' }}>
            Estoque
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Archive size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '30px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>Produtos</h1>
          </div>
          {!loading && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: '6px' }}>
              {ativos} ativos
              {baixo > 0 && <span style={{ color: '#c27803', marginLeft: '10px' }}>· {baixo} com estoque baixo</span>}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
          <button onClick={fetchProdutos} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '4px', padding: '9px 12px', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={14} />
          </button>
          <button
            onClick={openCreate}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'var(--accent)', border: 'none', borderRadius: '4px', padding: '9px 18px', color: '#fff', fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: 'pointer' }}
          >
            <Plus size={14} /> Novo Produto
          </button>
        </div>
      </header>

      {/* Error */}
      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff1f1', color: '#991b1b', marginBottom: '20px', fontSize: '13px' }}>
          <AlertTriangle size={15} /><span>{erro}</span>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          <span className="live-dot" style={{ marginRight: '10px', display: 'inline-block' }} /> Carregando produtos...
        </div>
      ) : produtos.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '240px', gap: '12px', color: 'var(--text-muted)' }}>
          <Archive size={32} style={{ opacity: 0.3 }} />
          <p style={{ fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>Nenhum produto cadastrado.</p>
          <button onClick={openCreate} style={{ fontSize: '11px', padding: '8px 18px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-space-mono)' }}>Criar primeiro produto</button>
        </div>
      ) : (
        <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {produtos.map(p => (
            <div key={p.id} style={{
              background: 'var(--bg-surface)', border: '1px solid var(--border)',
              borderLeft: `3px solid ${p.ativo ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: '8px', padding: '18px 20px',
              opacity: p.ativo ? 1 : 0.6,
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              {/* Top row: name + toggle */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginTop: '3px' }}>{p.unidade}</p>
                </div>
                <button
                  onClick={() => handleToggleAtivo(p)}
                  title={p.ativo ? 'Desativar' : 'Ativar'}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: p.ativo ? 'var(--accent)' : 'var(--text-muted)', padding: '2px', flexShrink: 0 }}
                >
                  {p.ativo ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                </button>
              </div>

              {/* Price */}
              <div>
                <p style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                  R$ {p.preco.toFixed(2)}
                </p>
              </div>

              {/* Stock */}
              <div style={{ background: getStockBg(p), border: `1px solid ${getStockColor(p)}33`, borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Estoque</span>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {p.quantidade === 0 && (
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: '#fff1f1', color: '#c81e1e', border: '1px solid #fca5a5', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sem Estoque</span>
                    )}
                    {p.estoqueBaixo && p.quantidade > 0 && (
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: '#fffbeb', color: '#c27803', border: '1px solid #fde68a', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Baixo</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'var(--font-barlow)', color: getStockColor(p), lineHeight: 1 }}>{p.quantidade}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{p.unidade}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginLeft: '4px' }}>/ mín {p.quantidadeMinima}</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${getBarPct(p)}%`, background: getBarColor(p), borderRadius: '2px', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                <button
                  onClick={() => openEdit(p)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  <Pencil size={12} /> Editar
                </button>
                <button
                  onClick={() => openStock(p)}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: '4px', padding: '8px', color: 'var(--accent)', cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                >
                  <Box size={12} /> Estoque
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Backdrop */}
      {drawer !== null && (
        <div onClick={closeDrawer} style={{ position: 'fixed', inset: 0, background: 'rgba(13,20,36,0.5)', zIndex: 100 }} />
      )}

      {/* Create/Edit Drawer */}
      {(drawer === 'create' || drawer === 'edit') && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '420px', height: '100vh', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', zIndex: 101, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {drawer === 'create' ? 'Novo Produto' : 'Editar Produto'}
            </span>
            <button onClick={closeDrawer} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
          </div>

          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
            {/* Nome */}
            <div>
              <label style={labelStyle}>Nome do Produto</label>
              <input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="ex: Gás 13kg" style={inputStyle} />
            </div>

            {/* Preço + Unidade */}
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

            {/* Estoque Inicial (create only) */}
            {drawer === 'create' && (
              <div>
                <label style={labelStyle}>Estoque Inicial</label>
                <input type="number" min="0" value={fQtdInicial} onChange={e => setFQtdInicial(e.target.value)} placeholder="0" style={inputStyle} />
              </div>
            )}

            {/* Estoque Mínimo */}
            <div>
              <label style={labelStyle}>Estoque Mínimo (alerta)</label>
              <input type="number" min="0" value={fQtdMin} onChange={e => setFQtdMin(e.target.value)} placeholder="5" style={inputStyle} />
            </div>

            {/* Ativo toggle (edit only) */}
            {drawer === 'edit' && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '6px' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '4px', background: '#fff1f1', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '12px', fontFamily: 'var(--font-space-mono)' }}>
                <AlertTriangle size={13} /> {formErro}
              </div>
            )}

            <button
              onClick={drawer === 'create' ? handleCreate : handleEdit}
              disabled={formLoading}
              style={{ padding: '12px', background: 'var(--accent)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', cursor: formLoading ? 'not-allowed' : 'pointer', opacity: formLoading ? 0.6 : 1, marginTop: 'auto' }}
            >
              {formLoading ? 'Salvando...' : drawer === 'create' ? 'Criar Produto' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {/* Stock Movement Drawer */}
      {drawer === 'stock' && selected && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '420px', height: '100vh', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)', zIndex: 101, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
          {/* Header */}
          <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div>
              <span style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Movimentação</span>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginTop: '2px' }}>{selected.nome}</p>
            </div>
            <button onClick={closeDrawer} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><X size={18} /></button>
          </div>

          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            {/* Current stock */}
            <div style={{ background: getStockBg(selected), border: `1px solid ${getStockColor(selected)}33`, borderRadius: '6px', padding: '14px 16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>Estoque Atual</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'var(--font-barlow)', color: getStockColor(selected), lineHeight: 1 }}>{selected.quantidade}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{selected.unidade}</span>
              </div>
            </div>

            {/* Tipo tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              {(['entrada', 'saida', 'ajuste'] as const).map(t => (
                <button key={t} onClick={() => setMovTipo(t)} style={tabBtnStyle(movTipo === t, t)}>
                  {t === 'entrada' ? <TrendingUp size={11} style={{ display: 'inline', marginRight: '4px' }} /> : t === 'saida' ? <TrendingDown size={11} style={{ display: 'inline', marginRight: '4px' }} /> : null}
                  {t.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Quantidade */}
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

            {/* Observação */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '4px', background: '#fff1f1', border: '1px solid #fca5a5', color: '#991b1b', fontSize: '12px', fontFamily: 'var(--font-space-mono)', marginBottom: '12px' }}>
                <AlertTriangle size={13} /> {movErro}
              </div>
            )}

            <button
              onClick={handleMovimento}
              disabled={movLoading}
              style={{
                width: '100%', padding: '11px',
                background: movTipo === 'entrada' ? '#ecfdf5' : movTipo === 'saida' ? '#fff1f1' : 'var(--accent-dim)',
                border: `1px solid ${movTipo === 'entrada' ? '#6ee7b7' : movTipo === 'saida' ? '#fca5a5' : 'var(--accent)'}`,
                borderRadius: '4px',
                color: movTipo === 'entrada' ? '#065f46' : movTipo === 'saida' ? '#991b1b' : 'var(--accent)',
                fontSize: '11px', fontFamily: 'var(--font-space-mono)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                cursor: movLoading ? 'not-allowed' : 'pointer', opacity: movLoading ? 0.6 : 1,
              }}
            >
              {movLoading ? 'Registrando...' : `Registrar ${movTipo.toUpperCase()}`}
            </button>
          </div>

          {/* Movement history */}
          <div style={{ padding: '20px 24px', flex: 1 }}>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '14px' }}>Últimos Movimentos</p>
            {movHistLoading ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Carregando...</p>
            ) : movimentos.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Nenhum movimento registrado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {movimentos.map(m => {
                  const c = TIPO_COLORS[m.tipo] ?? TIPO_COLORS.ajuste;
                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '4px' }}>
                      <span style={{ fontSize: '9px', padding: '2px 7px', borderRadius: '20px', background: c.bg, color: c.color, border: `1px solid ${c.border}`, fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                        {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '−' : '≈'} {m.tipo}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)' }}>{m.quantidade} {selected.unidade}</p>
                        {m.observacao && <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.observacao}</p>}
                      </div>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', flexShrink: 0 }}>{fmtDate(m.created_at)}</span>
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
