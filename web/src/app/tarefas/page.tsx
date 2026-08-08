'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  ClipboardList, Plus, X, MapPin, Phone, Check, Clock, CalendarClock,
  Ban, AlertTriangle, Bot, User, Search, Trash2,
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

// Quantas cabem numa semana de trabalho. O que passar disso fica abaixo da
// linha, visível mas fora da pauta — uma lista que nunca esvazia deixa de ser
// lista de tarefas e vira ruído de fundo.
const PAUTA_SEMANAL = 10;

const TIPOS = [
  { id: 'visita',      label: 'Visita' },
  { id: 'cobranca',    label: 'Cobrança' },
  { id: 'cadastro',    label: 'Cadastro' },
  { id: 'follow_up',   label: 'Retorno' },
  { id: 'oportunidade',label: 'Oportunidade' },
  { id: 'outro',       label: 'Outro' },
];

const RESULTADOS = [
  { id: 'recuperado',  label: 'Resolvido — voltou a comprar', cor: '#047857' },
  { id: 'sem_sucesso', label: 'Visitei, sem resultado',        cor: '#c27803' },
  { id: 'nao_estava',  label: 'Não encontrei / fechado',       cor: '#4a5568' },
  { id: 'perdido',     label: 'Perdido para concorrente',      cor: '#c81e1e' },
  { id: 'engano',      label: 'Alarme falso',                  cor: '#4a5568' },
];

function corPrioridade(p: number) {
  if (p >= 75) return '#c81e1e';
  if (p >= 50) return '#c27803';
  return '#4a5568';
}

function moeda(v: number | null) {
  if (v === null) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function TarefasPage() {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [resumo, setResumo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'abertas' | 'concluida' | 'todas'>('abertas');

  // Criação
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({ titulo: '', descricao: '', tipo: 'visita', prioridade: 50, clienteId: null as number | null });
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clientesEncontrados, setClientesEncontrados] = useState<any[]>([]);
  const [clienteEscolhido, setClienteEscolhido] = useState<any>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  // Conclusão
  // Erro de ação (iniciar, descartar, excluir). Antes ia só para o console, e
  // uma falha no banco aparecia para o usuário como "o botão não faz nada".
  const [erroAcao, setErroAcao] = useState('');
  const [excluindo, setExcluindo] = useState<Tarefa | null>(null);

  const [concluindo, setConcluindo] = useState<Tarefa | null>(null);
  const [resultado, setResultado] = useState('');
  const [observacao, setObservacao] = useState('');
  const [adiarAte, setAdiarAte] = useState('');
  const [modo, setModo] = useState<'concluir' | 'adiar'>('concluir');
  const [erroConclusao, setErroConclusao] = useState('');

  const carregar = useCallback(async (f: string) => {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([
        api.getTarefas(f),
        api.getTarefasResumo().catch(() => null),
      ]);
      setTarefas(t);
      setResumo(r);
    } catch (e) {
      console.error('Falha ao carregar tarefas:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregar(filtro); }, [filtro, carregar]);

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

  function abrirCriacao() {
    setForm({ titulo: '', descricao: '', tipo: 'visita', prioridade: 50, clienteId: null });
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
      carregar(filtro);
    } catch (e: any) {
      setErroForm(e.message || 'Erro ao criar tarefa');
    } finally {
      setSalvando(false);
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
      carregar(filtro);
    } catch (e: any) {
      setErroConclusao(e.message || 'Erro ao salvar');
    }
  }

  async function mudarStatus(t: Tarefa, status: string) {
    setErroAcao('');
    try {
      await api.atualizarTarefa(t.id, { status });
      carregar(filtro);
    } catch (e: any) {
      setErroAcao(e.message || 'Não foi possível atualizar a tarefa.');
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setErroAcao('');
    try {
      await api.excluirTarefa(excluindo.id);
      setExcluindo(null);
      carregar(filtro);
    } catch (e: any) {
      setErroAcao(e.message || 'Não foi possível excluir a tarefa.');
      setExcluindo(null);
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

  const naPauta = tarefas.slice(0, PAUTA_SEMANAL);
  const fila = tarefas.slice(PAUTA_SEMANAL);

  return (
    <main className="min-h-screen" style={{ padding: '32px 28px', width: '100%' }}>

      {/* Cabeçalho */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 6 }}>
            Carteira
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: 30, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
              Tarefas
            </h1>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: 6 }}>
            pauta da semana · o que precisa de visita
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {([['abertas', 'Abertas'], ['concluida', 'Concluídas'], ['todas', 'Todas']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFiltro(k)} style={{
              fontSize: 10, padding: '6px 14px', borderRadius: 4,
              background: filtro === k ? 'var(--accent)' : 'var(--bg-surface)',
              color: filtro === k ? '#fff' : 'var(--text-secondary)',
              border: '1px solid', borderColor: filtro === k ? 'var(--accent)' : 'var(--border)',
              fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.05em', cursor: 'pointer',
            }}>
              {label}
            </button>
          ))}
          <button onClick={abrirCriacao} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 5, border: 'none', cursor: 'pointer',
            background: 'var(--accent)', color: '#fff', whiteSpace: 'nowrap',
            fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            <Plus size={13} strokeWidth={2.5} /> Nova Tarefa
          </button>
        </div>
      </header>

      {/* Resumo */}
      {resumo && (
        <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 26 }}>
          <div className="kpi-card" style={{ borderTop: '2px solid var(--accent)', padding: '18px 22px' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: 10 }}>Na Pauta</p>
            <p style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>
              {resumo.pendentes + resumo.emAndamento}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>aguardando ação</p>
          </div>
          <div className="kpi-card" style={{ borderTop: '2px solid #047857', padding: '18px 22px' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: 10 }}>Feitas na Semana</p>
            <p style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#047857' }}>{resumo.concluidasSemana}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>
              {resumo.recuperadosSemana} cliente(s) recuperado(s)
            </p>
          </div>
          <div className="kpi-card" style={{ borderTop: '2px solid #c27803', padding: '18px 22px' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: 10 }}>Adiadas</p>
            <p style={{ fontSize: 38, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#c27803' }}>{resumo.adiadas}</p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>voltam na data marcada</p>
          </div>
        </div>
      )}

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

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: 13, fontFamily: 'var(--font-space-mono)' }}>
          <span className="live-dot" style={{ marginRight: 10, display: 'inline-block' }} /> Carregando...
        </div>
      ) : tarefas.length === 0 ? (
        <div className="kpi-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <ClipboardList size={28} style={{ color: 'var(--text-muted)', opacity: 0.5, marginBottom: 14 }} strokeWidth={1.5} />
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-barlow)', marginBottom: 6 }}>
            {filtro === 'abertas' ? 'Nenhuma tarefa em aberto' : 'Nada por aqui'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 18, lineHeight: 1.6 }}>
            {filtro === 'abertas'
              ? <>Pauta limpa. Crie uma tarefa ou espere o sistema<br />apontar um cliente que precisa de atenção.</>
              : 'Mude o filtro para ver outras tarefas.'}
          </p>
          {filtro === 'abertas' && (
            <button onClick={abrirCriacao} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '9px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#fff',
              fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              <Plus size={13} strokeWidth={2.5} /> Nova Tarefa
            </button>
          )}
        </div>
      ) : (
        <div className="fade-up-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {naPauta.map(t => (
            <CardTarefa key={t.id} t={t} onConcluir={() => abrirConclusao(t, 'concluir')}
              onAdiar={() => abrirConclusao(t, 'adiar')} onStatus={mudarStatus}
              onExcluir={() => setExcluindo(t)} />
          ))}

          {fila.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 6px' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
                  Fora da pauta · {fila.length} para as próximas semanas
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              {fila.map(t => (
                <div key={t.id} style={{ opacity: 0.6 }}>
                  <CardTarefa t={t} onConcluir={() => abrirConclusao(t, 'concluir')}
                    onAdiar={() => abrirConclusao(t, 'adiar')} onStatus={mudarStatus}
                    onExcluir={() => setExcluindo(t)} />
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Fundo escurecido */}
      {(criando || concluindo || excluindo) && (
        <div className="overlay-backdrop" onClick={() => { setCriando(false); setConcluindo(null); setExcluindo(null); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,20,36,0.45)', zIndex: 40, backdropFilter: 'blur(2px)' }} />
      )}

      {/* Confirmar exclusão */}
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
            Se a tarefa foi feita ou não era necessária, prefira <strong>Concluir</strong> ou{' '}
            <strong>Descartar</strong> — assim ela sai da pauta mas o histórico permanece.
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
    </main>
  );
}

function CardTarefa({ t, onConcluir, onAdiar, onStatus, onExcluir }: {
  t: Tarefa;
  onConcluir: () => void;
  onAdiar: () => void;
  onStatus: (t: Tarefa, s: string) => void;
  onExcluir: () => void;
}) {
  const concluida = t.status === 'concluida' || t.status === 'descartada';
  const res = RESULTADOS.find(r => r.id === t.resultado);

  return (
    <div className="kpi-card" style={{ borderLeft: `3px solid ${corPrioridade(t.prioridade)}`, padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
            <span title={t.origem === 'sistema' ? 'Gerada pelo sistema' : 'Criada por pessoa'}
              style={{ display: 'flex', color: 'var(--text-muted)' }}>
              {t.origem === 'sistema' ? <Bot size={13} /> : <User size={13} />}
            </span>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)' }}>
              {t.titulo}
            </p>
            {t.status === 'em_andamento' && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, background: '#ebf1fe', color: '#1e3fa8', border: '1px solid #a5bcf7', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                em andamento
              </span>
            )}
            {t.status === 'adiada' && (
              <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 3, background: '#fef8ec', color: '#92400e', border: '1px solid #fcd97d', fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase' }}>
                adiada
              </span>
            )}
          </div>

          {t.clienteNome && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: 4 }}>
              <span style={{ fontWeight: 700 }}>{t.clienteNome}</span>
              {t.clienteTelefone && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} />{t.clienteTelefone.replace(/^55/, '')}</span>}
              {(t.clienteEndereco || t.clienteBairro) && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)' }}>
                  <MapPin size={10} />{[t.clienteEndereco, t.clienteBairro].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
          )}

          {t.descricao && (
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55, marginTop: 4 }}>{t.descricao}</p>
          )}

          {t.valorRisco !== null && (
            <p style={{ fontSize: 11, color: '#c81e1e', fontFamily: 'var(--font-space-mono)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={11} /> {moeda(t.valorRisco)}/mês em risco
            </p>
          )}

          {concluida && res && (
            <p style={{ fontSize: 11.5, color: res.cor, fontFamily: 'var(--font-space-mono)', marginTop: 8, fontWeight: 700 }}>
              {res.label}
            </p>
          )}
          {concluida && t.observacao && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic' }}>{t.observacao}</p>
          )}
        </div>

        {!concluida && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {t.status === 'pendente' && (
              <button onClick={() => onStatus(t, 'em_andamento')} title="Marcar que começou"
                style={botaoAcao('var(--border)', 'var(--text-secondary)')}>
                <Clock size={12} /> Iniciar
              </button>
            )}
            <button onClick={onConcluir} title="Concluir e registrar o que aconteceu"
              style={botaoAcao('#6ee7b7', '#065f46', '#ecfdf5')}>
              <Check size={12} strokeWidth={2.5} /> Concluir
            </button>
            <button onClick={onAdiar} title="Adiar para outra data"
              style={botaoAcao('#fcd97d', '#92400e', '#fef8ec')}>
              <CalendarClock size={12} /> Adiar
            </button>
            <button onClick={() => onStatus(t, 'descartada')} title="Descartar — não é necessário, mas fica no histórico"
              aria-label="Descartar tarefa" style={botaoAcao('var(--border)', 'var(--text-muted)')}>
              <Ban size={12} />
            </button>
            <button onClick={onExcluir} title="Excluir de vez"
              aria-label="Excluir tarefa" style={botaoAcao('#fecaca', '#c81e1e', '#fff1f1')}>
              <Trash2 size={12} />
            </button>
          </div>
        )}

        {/* Tarefa já fechada continua podendo ser removida de vez */}
        {concluida && (
          <button onClick={onExcluir} title="Excluir de vez" aria-label="Excluir tarefa"
            style={botaoAcao('#fecaca', '#c81e1e', '#fff1f1')}>
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function botaoAcao(borda: string, cor: string, fundo = 'var(--bg-surface)'): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '6px 11px', borderRadius: 5, cursor: 'pointer',
    border: `1px solid ${borda}`, background: fundo, color: cor,
    fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
    textTransform: 'uppercase', letterSpacing: '0.05em',
  };
}
