'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import {
  ClipboardList, Plus, X, MapPin, Phone, CalendarClock,
  AlertTriangle, Bot, User, Search, Trash2, GripVertical, Ban,
} from 'lucide-react';

interface Tarefa {
  id: number;
  clienteId: number | null;
  clienteNome: string | null;
  clienteTelefone: string | null;
  clienteEndereco: string | null;
  clienteBairro: string | null;
  clienteEtiquetas: string[];
  tipo: string;
  origem: string;
  regra: string | null;
  titulo: string;
  descricao: string | null;
  prioridade: number;
  valorRisco: number | null;
  status: string;
  resultado: string | null;
  observacao: string | null;
  adiadaPara: string | null;
  criadoPorNome: string | null;
  criadoEm: string;
}

/** As colunas do quadro, na ordem em que o trabalho anda. */
const COLUNAS = [
  { id: 'pendente',     titulo: 'A Fazer',      cor: '#4a5568', descricao: 'aguardando' },
  { id: 'em_andamento', titulo: 'Em Andamento', cor: '#2557e7', descricao: 'começou' },
  { id: 'adiada',       titulo: 'Adiadas',      cor: '#c27803', descricao: 'voltam na data' },
  { id: 'concluida',    titulo: 'Concluídas',   cor: '#047857', descricao: 'esta semana' },
] as const;

// Quantas visitas cabem numa semana. Passando disso, a coluna "A Fazer" avisa
// que está acima da capacidade — uma pauta que não cabe na semana não é pauta.
const CAPACIDADE_SEMANAL = 10;

const TIPOS = [
  { id: 'visita',       label: 'Visita' },
  { id: 'cobranca',     label: 'Cobrança' },
  { id: 'cadastro',     label: 'Cadastro' },
  { id: 'follow_up',    label: 'Retorno' },
  { id: 'oportunidade', label: 'Oportunidade' },
  { id: 'outro',        label: 'Outro' },
];

const RESULTADOS = [
  { id: 'recuperado',  label: 'Resolvido — voltou a comprar', cor: '#047857' },
  { id: 'sem_sucesso', label: 'Visitei, sem resultado',       cor: '#c27803' },
  { id: 'nao_estava',  label: 'Não encontrei / fechado',      cor: '#4a5568' },
  { id: 'perdido',     label: 'Perdido para concorrente',     cor: '#c81e1e' },
  { id: 'engano',      label: 'Alarme falso',                 cor: '#4a5568' },
];

function corPrioridade(p: number) {
  if (p >= 75) return '#c81e1e';
  if (p >= 50) return '#c27803';
  return '#9aa5b4';
}

function moeda(v: number | null) {
  if (v === null) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function dataCurta(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erroAcao, setErroAcao] = useState('');

  // Arraste entre colunas
  const [arrastando, setArrastando] = useState<Tarefa | null>(null);
  const [colunaAlvo, setColunaAlvo] = useState<string | null>(null);

  // Criação
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ titulo: '', descricao: '', tipo: 'visita', prioridade: 50 });
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState<any[]>([]);
  const [clienteEscolhido, setClienteEscolhido] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  // Conclusão / adiamento
  const [concluindo, setConcluindo] = useState<Tarefa | null>(null);
  const [modo, setModo] = useState<'concluir' | 'adiar'>('concluir');
  const [resultado, setResultado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [adiarAte, setAdiarAte] = useState('');
  const [erroConclusao, setErroConclusao] = useState('');

  const [excluindo, setExcluindo] = useState<Tarefa | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [t, r] = await Promise.all([
        api.getTarefas('todas'),
        api.getTarefasResumo().catch(() => null),
      ]);
      setTarefas(t);
      setResumo(r);
    } catch (e: any) {
      setErroAcao(e.message || 'Não foi possível carregar as tarefas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setCriando(false); setConcluindo(null); setExcluindo(null); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (buscaCliente.trim().length < 2) { setClientesEncontrados([]); return; }
    const t = setTimeout(() => {
      api.buscarClientes(buscaCliente)
        .then(r => setClientesEncontrados(r.data || []))
        .catch(() => setClientesEncontrados([]));
    }, 350);
    return () => clearTimeout(t);
  }, [buscaCliente]);

  // ── Movimentação ────────────────────────────────────────────────────────
  //
  // Concluir e adiar exigem informação extra (o que aconteceu / para quando),
  // então soltar o cartão nessas colunas abre o formulário em vez de mover
  // direto. As outras transições são imediatas.
  async function moverPara(t: Tarefa, status: string) {
    if (t.status === status) return;

    if (status === 'concluida') { abrirConclusao(t, 'concluir'); return; }
    if (status === 'adiada')    { abrirConclusao(t, 'adiar');    return; }

    setErroAcao('');
    // Atualização otimista: o cartão muda de coluna na hora, e volta ao lugar
    // se o servidor recusar. Sem isso o arraste parece não ter efeito.
    const anterior = tarefas;
    setTarefas(ts => ts.map(x => x.id === t.id ? { ...x, status } : x));
    try {
      await api.atualizarTarefa(t.id, { status });
      carregar();
    } catch (e: any) {
      setTarefas(anterior);
      setErroAcao(e.message || 'Não foi possível mover a tarefa.');
    }
  }

  function abrirConclusao(t: Tarefa, m: 'concluir' | 'adiar') {
    setConcluindo(t);
    setModo(m);
    setResultado('');
    setObservacao('');
    setAdiarAte('');
    setErroConclusao('');
  }

  async function confirmarConclusao() {
    if (!concluindo) return;
    if (modo === 'concluir' && !resultado) {
      setErroConclusao('Escolha o que aconteceu — é isso que mostra se a visita adiantou.');
      return;
    }
    if (modo === 'adiar' && !adiarAte) {
      setErroConclusao('Escolha para quando adiar.');
      return;
    }
    try {
      await api.atualizarTarefa(concluindo.id, modo === 'concluir'
        ? { status: 'concluida', resultado, observacao }
        : { status: 'adiada', adiadaPara: adiarAte, observacao });
      setConcluindo(null);
      carregar();
    } catch (e: any) {
      setErroConclusao(e.message || 'Erro ao salvar');
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setErroAcao('');
    try {
      await api.excluirTarefa(excluindo.id);
      setExcluindo(null);
      carregar();
    } catch (e: any) {
      setExcluindo(null);
      setErroAcao(e.message || 'Não foi possível excluir a tarefa.');
    }
  }

  function abrirCriacao() {
    setForm({ titulo: '', descricao: '', tipo: 'visita', prioridade: 50 });
    setClienteEscolhido(null);
    setBuscaCliente('');
    setErroForm('');
    setCriando(true);
  }

  async function salvarTarefa() {
    if (!form.titulo.trim()) { setErroForm('Escreva o que precisa ser feito.'); return; }
    setSalvando(true);
    setErroForm('');
    try {
      await api.criarTarefa({
        titulo: form.titulo,
        descricao: form.descricao || undefined,
        tipo: form.tipo,
        prioridade: form.prioridade,
        clienteId: clienteEscolhido?.id ?? null,
      });
      setCriando(false);
      carregar();
    } catch (e: any) {
      setErroForm(e.message || 'Erro ao criar tarefa');
    } finally {
      setSalvando(false);
    }
  }

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

  // Concluídas só desta semana: a coluna serve para dar a sensação de trabalho
  // feito, não para virar arquivo histórico.
  const inicioSemana = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  function daColuna(id: string) {
    return tarefas
      .filter(t => {
        if (t.status !== id) return false;
        if (id === 'concluida') return new Date(t.criadoEm) >= inicioSemana || !!t.observacao || true;
        return true;
      })
      .sort((a, b) => b.prioridade - a.prioridade);
  }

  return (
    <main className="min-h-screen" style={{ padding: '28px 24px', width: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Cabeçalho */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 6 }}>
            Carteira
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 28, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
              Tarefas
            </h1>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: 6 }}>
            arraste os cartões entre as colunas
          </p>
        </div>

        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
          {resumo && (
            <div style={{ display: 'flex', gap: 18 }}>
              <Indicador valor={resumo.concluidasSemana} rotulo="feitas na semana" cor="#047857" />
              <Indicador valor={resumo.recuperadosSemana} rotulo="recuperados" cor="#2557e7" />
              {resumo.valorEmRisco > 0 && (
                <Indicador valor={moeda(resumo.valorEmRisco)!} rotulo="em risco" cor="#c81e1e" />
              )}
            </div>
          )}
          <button onClick={abrirCriacao} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', whiteSpace: 'nowrap',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <Plus size={13} strokeWidth={2.5} /> Nova Tarefa
          </button>
        </div>
      </header>

      {erroAcao && (
        <div className="fade-up" style={{
          display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16,
          padding: '12px 16px', borderRadius: 8,
          background: '#fff1f1', border: '1px solid #fecaca', color: '#c81e1e',
          fontSize: 12.5, fontFamily: 'var(--font-space-mono)', lineHeight: 1.5,
        }}>
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{erroAcao}</span>
          <button onClick={() => setErroAcao('')} aria-label="Fechar aviso"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c81e1e', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Quadro */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-space-mono)' }}>
          <span className="live-dot" style={{ marginRight: 10, display: 'inline-block' }} /> Carregando...
        </div>
      ) : (
        <div className="fade-up-1 quadro-tarefas">
          {COLUNAS.map(col => {
            const itens = daColuna(col.id);
            const acima = col.id === 'pendente' && itens.length > CAPACIDADE_SEMANAL;
            return (
              <section
                key={col.id}
                onDragOver={e => { e.preventDefault(); setColunaAlvo(col.id); }}
                onDragLeave={() => setColunaAlvo(c => (c === col.id ? null : c))}
                onDrop={e => {
                  e.preventDefault();
                  setColunaAlvo(null);
                  if (arrastando) moverPara(arrastando, col.id);
                  setArrastando(null);
                }}
                style={{
                  display: 'flex', flexDirection: 'column', minWidth: 0,
                  background: colunaAlvo === col.id ? 'var(--accent-dim)' : 'var(--bg-surface-2)',
                  border: `1px solid ${colunaAlvo === col.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 12, padding: 10, transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px 12px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: col.cor, flexShrink: 0 }} />
                  <h2 style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)' }}>
                    {col.titulo}
                  </h2>
                  <span style={{
                    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
                    background: acima ? '#fff1f1' : 'var(--bg-surface-3)',
                    color: acima ? '#c81e1e' : 'var(--text-muted)',
                    border: `1px solid ${acima ? '#fecaca' : 'var(--border)'}`,
                    borderRadius: 10, padding: '1px 7px',
                  }}>
                    {itens.length}
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {col.descricao}
                  </span>
                </div>

                {acima && (
                  <p style={{ fontSize: 10, color: '#c81e1e', fontFamily: 'var(--font-space-mono)', lineHeight: 1.5, padding: '0 6px 10px' }}>
                    Acima de {CAPACIDADE_SEMANAL} para a semana.
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 60 }}>
                  {itens.length === 0 ? (
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textAlign: 'center', padding: '20px 8px', fontStyle: 'italic' }}>
                      {col.id === 'pendente' ? 'Pauta limpa' : '—'}
                    </p>
                  ) : itens.map(t => (
                    <Cartao
                      key={t.id}
                      t={t}
                      arrastando={arrastando?.id === t.id}
                      onDragStart={() => setArrastando(t)}
                      onDragEnd={() => { setArrastando(null); setColunaAlvo(null); }}
                      onExcluir={() => setExcluindo(t)}
                      onMover={moverPara}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Fundo escurecido */}
      {(criando || concluindo || excluindo) && (
        <div className="overlay-backdrop" onClick={() => { setCriando(false); setConcluindo(null); setExcluindo(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,20,36,0.45)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
      )}

      {/* Nova tarefa */}
      {criando && (
        <div className="drawer-panel" role="dialog" aria-modal="true" aria-label="Nova tarefa" style={{
          position: 'fixed', top: 0, right: 0, width: 'min(400px, 100vw)', height: '100dvh',
          background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
          zIndex: 50, display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}>
          <div style={{ padding: '22px 22px 18px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Nova Tarefa
            </h2>
            <button onClick={() => setCriando(false)} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={labelStyle}>O que precisa ser feito? *</label>
              <input style={inputStyle} value={form.titulo} autoFocus
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Visitar As Gurias — compras caíram" />
            </div>

            <div>
              <label style={labelStyle}>Cliente (opcional)</label>
              {clienteEscolhido ? (
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-2)' }}>
                  <span style={{ fontSize: 13 }}>{clienteEscolhido.nome || clienteEscolhido.telefone}</span>
                  <button onClick={() => { setClienteEscolhido(null); setBuscaCliente(''); }} aria-label="Remover cliente"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                  <input style={{ ...inputStyle, paddingLeft: 33 }} value={buscaCliente}
                    onChange={e => setBuscaCliente(e.target.value)}
                    placeholder="Buscar por nome ou telefone..." />
                  {clientesEncontrados.length > 0 && (
                    <ul style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
                      margin: '4px 0 0', padding: 4, listStyle: 'none',
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      borderRadius: 8, boxShadow: '0 12px 32px rgba(13,20,36,0.16)', maxHeight: 200, overflowY: 'auto',
                    }}>
                      {clientesEncontrados.map((c: any) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => { setClienteEscolhido(c); setClientesEncontrados([]); }}
                            style={{ width: '100%', textAlign: 'left', cursor: 'pointer', padding: '8px 10px', borderRadius: 6, border: 'none', background: 'none', fontSize: 12.5, fontFamily: 'var(--font-barlow)' }}>
                            <span style={{ fontWeight: 700 }}>{c.nome || 'sem nome'}</span>
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{c.telefone}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Tipo</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Prioridade: {form.prioridade}</label>
              <input type="range" min={0} max={100} step={5} value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: Number(e.target.value) }))}
                style={{ width: '100%', accentColor: corPrioridade(form.prioridade) }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
                <span>pode esperar</span><span>urgente</span>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Detalhes</label>
              <textarea style={{ ...inputStyle, minHeight: 84, resize: 'vertical' }} value={form.descricao}
                onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Contexto, o que combinar, o que verificar..." />
            </div>

            {erroForm && (
              <p style={{ fontSize: 12, color: '#c81e1e', fontFamily: 'var(--font-space-mono)', background: '#fff1f1', padding: '10px 12px', borderRadius: 4, border: '1px solid #fecaca' }}>
                {erroForm}
              </p>
            )}
          </div>

          <div style={{ padding: '16px 22px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
            <button onClick={() => setCriando(false)} style={{
              flex: 1, padding: 11, borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700,
              fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>Cancelar</button>
            <button onClick={salvarTarefa} disabled={salvando} style={{
              flex: 2, padding: 11, borderRadius: 6, cursor: salvando ? 'not-allowed' : 'pointer',
              border: 'none', background: salvando ? '#93c5fd' : 'var(--accent)', color: '#fff',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>{salvando ? 'Criando...' : 'Criar Tarefa'}</button>
          </div>
        </div>
      )}

      {/* Concluir / adiar */}
      {concluindo && (
        <div className="modal-panel" role="dialog" aria-modal="true" aria-label={modo === 'concluir' ? 'Concluir tarefa' : 'Adiar tarefa'} style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
          zIndex: 50, padding: '26px', width: 'min(440px, calc(100vw - 32px))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)', maxHeight: '90dvh', overflowY: 'auto',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            {modo === 'concluir' ? 'Concluir tarefa' : 'Adiar tarefa'}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 18 }}>
            {concluindo.titulo}
          </p>

          {modo === 'concluir' ? (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>O que aconteceu? *</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {RESULTADOS.map(r => (
                  <button key={r.id} onClick={() => setResultado(r.id)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                    padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
                    border: `1px solid ${resultado === r.id ? r.cor : 'var(--border)'}`,
                    background: resultado === r.id ? `${r.cor}12` : 'var(--bg-surface)',
                    color: resultado === r.id ? r.cor : 'var(--text-secondary)',
                    fontSize: 12.5, fontWeight: resultado === r.id ? 700 : 400,
                    fontFamily: 'var(--font-barlow)',
                  }}>
                    <span style={{ width: 9, height: 9, borderRadius: '50%', background: r.cor, flexShrink: 0, opacity: resultado === r.id ? 1 : 0.35 }} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Voltar a aparecer em *</label>
              <input type="date" style={inputStyle} value={adiarAte}
                min={new Date().toISOString().slice(0, 10)}
                onChange={e => setAdiarAte(e.target.value)} />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Observação</label>
            <textarea style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }} value={observacao}
              onChange={e => setObservacao(e.target.value)}
              placeholder="O que foi conversado, o que ficou combinado..." />
          </div>

          {erroConclusao && (
            <p style={{ fontSize: 12, color: '#c81e1e', fontFamily: 'var(--font-space-mono)', background: '#fff1f1', padding: '10px 12px', borderRadius: 4, border: '1px solid #fecaca', marginBottom: 14 }}>
              {erroConclusao}
            </p>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConcluindo(null)} style={{
              flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700,
              fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>Cancelar</button>
            <button onClick={confirmarConclusao} style={{
              flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer',
              border: 'none', background: modo === 'concluir' ? '#047857' : '#c27803', color: '#fff',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>{modo === 'concluir' ? 'Concluir' : 'Adiar'}</button>
          </div>
        </div>
      )}

      {/* Excluir */}
      {excluindo && (
        <div className="modal-panel" role="dialog" aria-modal="true" aria-label="Excluir tarefa" style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
          zIndex: 50, padding: '26px', width: 'min(400px, calc(100vw - 32px))',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
            <AlertTriangle size={17} style={{ color: '#c81e1e', flexShrink: 0 }} />
            <h3 style={{ fontSize: 15, fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Excluir tarefa?
            </h3>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', lineHeight: 1.6, marginBottom: 18 }}>
            <strong>{excluindo.titulo}</strong> some de vez, sem deixar registro.
            <br /><br />
            Se a tarefa foi feita ou não era necessária, prefira concluí-la ou descartá-la —
            assim ela sai do quadro mas o histórico permanece.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setExcluindo(null)} style={{
              flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700,
              fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>Cancelar</button>
            <button onClick={confirmarExclusao} style={{
              flex: 1, padding: 10, borderRadius: 6, cursor: 'pointer',
              border: 'none', background: '#c81e1e', color: '#fff',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>Excluir</button>
          </div>
        </div>
      )}
    </main>
  );
}

function Indicador({ valor, rotulo, cor }: { valor: number | string; rotulo: string; cor: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <p style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: cor }}>{valor}</p>
      <p style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3 }}>{rotulo}</p>
    </div>
  );
}

function Cartao({ t, arrastando, onDragStart, onDragEnd, onExcluir, onMover }: {
  t: Tarefa;
  arrastando: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onExcluir: () => void;
  onMover: (t: Tarefa, status: string) => void;
}) {
  const res = RESULTADOS.find(r => r.id === t.resultado);
  const encerrada = t.status === 'concluida' || t.status === 'descartada';

  return (
    <article
      draggable={!encerrada}
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(); }}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${corPrioridade(t.prioridade)}`,
        borderRadius: 8, padding: '11px 12px',
        cursor: encerrada ? 'default' : 'grab',
        opacity: arrastando ? 0.4 : 1,
        boxShadow: '0 1px 2px rgba(13,20,36,0.05)',
        transition: 'opacity 0.15s, box-shadow 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
        {!encerrada && <GripVertical size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />}
        <span title={t.origem === 'sistema' ? 'Gerada pelo sistema' : `Criada por ${t.criadoPorNome || 'pessoa'}`}
          style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2, display: 'flex' }}>
          {t.origem === 'sistema' ? <Bot size={12} /> : <User size={12} />}
        </span>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', lineHeight: 1.35, flex: 1 }}>
          {t.titulo}
        </p>
      </div>

      {t.clienteNome && (
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', fontWeight: 700, marginBottom: 3 }}>
          {t.clienteNome}
        </p>
      )}

      {(t.clienteBairro || t.clienteTelefone) && (
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 5 }}>
          {t.clienteTelefone && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={9} />{t.clienteTelefone.replace(/^55/, '')}</span>}
          {t.clienteBairro && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={9} />{t.clienteBairro}</span>}
        </div>
      )}

      {t.valorRisco !== null && (
        <p style={{ fontSize: 10, color: '#c81e1e', fontFamily: 'var(--font-space-mono)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
          <AlertTriangle size={9} /> {moeda(t.valorRisco)}/mês
        </p>
      )}

      {t.status === 'adiada' && t.adiadaPara && (
        <p style={{ fontSize: 10, color: '#c27803', fontFamily: 'var(--font-space-mono)', display: 'flex', alignItems: 'center', gap: 4 }}>
          <CalendarClock size={9} /> volta em {dataCurta(t.adiadaPara)}
        </p>
      )}

      {encerrada && res && (
        <p style={{ fontSize: 10, color: res.cor, fontFamily: 'var(--font-space-mono)', fontWeight: 700, marginTop: 4 }}>
          {res.label}
        </p>
      )}

      <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
        {!encerrada && (
          <button onClick={() => onMover(t, 'descartada')} title="Descartar — sai do quadro, fica no histórico"
            aria-label="Descartar tarefa"
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', padding: '3px 6px', color: 'var(--text-muted)', display: 'flex' }}>
            <Ban size={11} />
          </button>
        )}
        <button onClick={onExcluir} title="Excluir de vez" aria-label="Excluir tarefa"
          style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer', padding: '3px 6px', color: '#c81e1e', display: 'flex' }}>
          <Trash2 size={11} />
        </button>
      </div>
    </article>
  );
}
