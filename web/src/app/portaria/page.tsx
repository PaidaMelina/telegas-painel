'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, UserPlus, X, Plus, Minus, ShoppingCart, CheckCircle, ChevronRight, Package } from 'lucide-react';

import { API_URL, api } from '@/lib/api';
import BuscaEndereco from '@/components/BuscaEndereco';
import type { SugestaoEndereco } from '@/lib/enderecos';

interface Cliente {
  id: number;
  nome: string;
  telefone: string;
  endereco: string;
  bairro: string;
}

interface Produto {
  id: number;
  nome: string;
  preco: number;
  unidade: string;
  quantidade: number;
  estoqueBaixo: boolean;
}

interface PrecoCliente {
  produtoId: number;
  precoBrl: number;
  precoMoeda: number | null;
  moeda: string | null;
  simbolo: string | null;
  cotacao: number | null;
  especial: boolean;
  etiqueta: string | null;
}

interface ItemCarrinho {
  produto: Produto;
  qtd: number;
}

interface FormaPagamento {
  id: number;
  nome: string;
  slug: string;
  aceitaTroco: boolean;
  ativo?: boolean;
}

function formatPhone(v: string): string {
  const d = v.replace(/\D/g, '');
  const local = d.startsWith('55') ? d.slice(2) : d;
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return local || v;
}

export default function PortariaPage() {
  const [step, setStep] = useState<'cliente' | 'pedido' | 'sucesso'>('cliente');

  // Cliente
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<Cliente[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [showNovoForm, setShowNovoForm] = useState(false);
  const [novoCliente, setNovoCliente] = useState({ nome: '', telefone: '', endereco: '', numero: '', complemento: '', bairro: '' });
  const [novoClienteCoords, setNovoClienteCoords] = useState<{lat: number, lng: number} | null>(null);
  const [criandoCliente, setCriandoCliente] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enderecoInputRef = useRef<HTMLInputElement>(null);
  const enderecoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [buscandoEndereco, setBuscandoEndereco] = useState(false);

  // Produtos e carrinho
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [carrinho, setCarrinho] = useState<Record<number, ItemCarrinho>>({});
  // Preços válidos para o cliente escolhido — clientes do Uruguai têm preço
  // próprio em alguns produtos. Vem do servidor, que é quem decide o valor.
  const [precosCliente, setPrecosCliente] = useState<Map<number, PrecoCliente>>(new Map());

  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [pagamento, setPagamento] = useState<FormaPagamento | null>(null);
  const [troco, setTroco] = useState('');
  const [submetendo, setSubmetendo] = useState(false);
  const [pedidoId, setPedidoId] = useState<number | null>(null);
  const [entregadorNome, setEntregadorNome] = useState('');

  // Entregadores disponíveis
  const [entregadoresDisponiveis, setEntregadoresDisponiveis] = useState<{ id: number; nome: string; pedidosAtivos: number }[]>([]);
  const [entregadorSelecionado, setEntregadorSelecionado] = useState<number | null>(null); // null = automático

  useEffect(() => {
    api.getProdutos()
      .then(setProdutos)
      .catch(() => {});
  }, []);

  // Formas de pagamento vêm do cadastro. A primeira ativa fica pré-selecionada.
  useEffect(() => {
    api.getFormasPagamento()
      .then((res: FormaPagamento[]) => {
        const ativas = res.filter(f => f.ativo !== false);
        setFormasPagamento(ativas);
        setPagamento(p => p ?? ativas[0] ?? null);
      })
      .catch(err => console.error('Falha ao carregar formas de pagamento:', err));
  }, []);

  // Buscar entregadores ao entrar na tela de pedido
  useEffect(() => {
    if (step !== 'pedido') return;
    api.getEntregadoresDisponiveis()
      .then(setEntregadoresDisponiveis)
      .catch(() => {});
  }, [step]);

  function escolherEndereco(s: SugestaoEndereco) {
    setNovoCliente(prev => ({
      ...prev,
      endereco: s.rua,
      numero: s.numero || prev.numero,
      bairro: s.bairro || prev.bairro,
    }));
    setNovoClienteCoords({ lat: s.lat, lng: s.lng });
  }

  const buscarClientes = useCallback((q: string) => {
    if (q.length < 2) { setResultados([]); return; }
    setBuscando(true);
    api.getClientes({ search: q, limit: '6' })
      .then(d => setResultados(d.data || []))
      .catch(() => setResultados([]))
      .finally(() => setBuscando(false));
  }, []);

  function handleBusca(v: string) {
    setBusca(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => buscarClientes(v), 280);
  }

  function selecionarCliente(c: Cliente) {
    setClienteSelecionado(c);
    setBusca('');
    setResultados([]);
    setShowNovoForm(false);
    setStep('pedido');

    // Carrega os preços deste cliente: as etiquetas dele podem dar preço
    // diferente em alguns produtos.
    api.getPrecosCliente(c.id, c.telefone)
      .then((res: PrecoCliente[]) => setPrecosCliente(new Map(res.map(p => [p.produtoId, p]))))
      .catch(err => console.error('Falha ao carregar preços do cliente:', err));
  }

  async function criarNovoCliente() {
    if (!novoCliente.nome || !novoCliente.telefone) return;
    setCriandoCliente(true);
    try {
      const enderecoCompleto = novoCliente.numero 
        ? `${novoCliente.endereco}, ${novoCliente.numero}${novoCliente.complemento ? ' - ' + novoCliente.complemento : ''}`
        : novoCliente.endereco;

      const payload = {
        nome: novoCliente.nome,
        telefone: novoCliente.telefone,
        endereco: enderecoCompleto,
        bairro: novoCliente.bairro
      };

      const c = await api.criarCliente(payload);
      selecionarCliente(c);
    } finally {
      setCriandoCliente(false);
    }
  }

  function alterarQtd(produto: Produto, delta: number) {
    setCarrinho(prev => {
      const atual = prev[produto.id]?.qtd || 0;
      const nova = Math.max(0, atual + delta);
      if (nova === 0) {
        const { [produto.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [produto.id]: { produto, qtd: nova } };
    });
  }

  const itens = Object.values(carrinho);
  function precoDe(prod: Produto): PrecoCliente {
    return precosCliente.get(prod.id) ?? {
      produtoId: prod.id, precoBrl: prod.preco, precoMoeda: null,
      moeda: null, simbolo: null, cotacao: null, especial: false, etiqueta: null,
    };
  }

  const total = itens.reduce((s, i) => s + precoDe(i.produto).precoBrl * i.qtd, 0);

  // Total na moeda estrangeira, quando algum item é cobrado assim.
  // Soma o preço em moeda de cada item em vez de converter o total de reais:
  // converter de volta daria $770,04 onde o preço combinado é $770,00.
  const moedaAtiva = itens.map(i => precoDe(i.produto)).find(p => p.moeda) ?? null;
  const totalMoeda = moedaAtiva
    ? itens.reduce((s, i) => {
        const pr = precoDe(i.produto);
        return s + (pr.precoMoeda
          ? i.qtd * pr.precoMoeda
          : i.qtd * pr.precoBrl * (moedaAtiva.cotacao || 0));
      }, 0)
    : null;
  const qtdTotal = itens.reduce((s, i) => s + i.qtd, 0);

  async function confirmarPedido() {
    if (!clienteSelecionado || !itens.length) return;
    setSubmetendo(true);
    try {
      const d = await api.criarPedidoPortaria({
        clienteId: clienteSelecionado.id,
        telefone: clienteSelecionado.telefone,
        nome: clienteSelecionado.nome,
        endereco: clienteSelecionado.endereco,
        bairro: clienteSelecionado.bairro,
        produtos: itens.map(i => ({ id: i.produto.id, nome: i.produto.nome, qtd: i.qtd, preco: precoDe(i.produto).precoBrl })),
        formaPagamento: pagamento?.slug ?? '',
        trocoPara: pagamento?.aceitaTroco && troco ? parseFloat(troco) : null,
        entregadorId: entregadorSelecionado,
      });
      setPedidoId(d.pedidoId);
      setEntregadorNome(d.entregador);
      setStep('sucesso');
    } finally {
      setSubmetendo(false);
    }
  }

  function novoPedido() {
    setStep('cliente');
    setClienteSelecionado(null);
    setCarrinho({});
    setPagamento(formasPagamento[0] ?? null);
    setTroco('');
    setPedidoId(null);
    setBusca('');
    setResultados([]);
    setShowNovoForm(false);
    setNovoCliente({ nome: '', telefone: '', endereco: '', numero: '', complemento: '', bairro: '' });
    setNovoClienteCoords(null);
    setSugestoes([]);
    setEntregadorSelecionado(null);
    setEntregadoresDisponiveis([]);
  }

  // ─── Tela de sucesso ───────────────────────────────────
  if (step === 'sucesso') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', gap: 20, padding: 40 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #6ee7b7' }}>
          <CheckCircle size={36} style={{ color: '#047857' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Pedido #{pedidoId} criado!
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            Entregador: <strong>{entregadorNome}</strong> · Total: <strong>R$ {total.toFixed(2)}</strong>
          </p>
        </div>
        <button
          onClick={novoPedido}
          style={{ marginTop: 12, padding: '12px 32px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'var(--font-space-mono)' }}
        >
          Novo Pedido
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ShoppingCart size={18} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Portaria</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Pedido manual com seleção de entregador</p>
        </div>
        {step === 'pedido' && clienteSelecionado && (
          <button
            onClick={() => { setStep('cliente'); setClienteSelecionado(null); setCarrinho({}); }}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}
          >
            <X size={12} /> Trocar cliente
          </button>
        )}
      </div>

      {/* Breadcrumb steps */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {[{ key: 'cliente', label: '1. Cliente' }, { key: 'pedido', label: '2. Pedido' }].map((s, i) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em',
              background: step === s.key ? 'var(--accent)' : step === 'pedido' && s.key === 'cliente' ? 'var(--accent-dim)' : 'var(--bg-surface-3)',
              color: step === s.key ? '#fff' : step === 'pedido' && s.key === 'cliente' ? 'var(--accent)' : 'var(--text-muted)',
              border: `1px solid ${step === s.key ? 'var(--accent)' : 'var(--border)'}`,
            }}>
              {s.label}
            </span>
            {i === 0 && <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
          </div>
        ))}
        {clienteSelecionado && (
          <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
            — {clienteSelecionado.nome || formatPhone(clienteSelecionado.telefone)}
          </span>
        )}
      </div>

      {/* ─── STEP 1: Cliente ─────────────────────────── */}
      {step === 'cliente' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, flex: 1, alignItems: 'start' }}>

          {/* Busca */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Buscar cliente</p>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                autoFocus
                value={busca}
                onChange={e => handleBusca(e.target.value)}
                placeholder="Nome, telefone ou endereço..."
                style={{
                  width: '100%', padding: '10px 12px 10px 36px', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-surface-2)',
                  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            {buscando && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-space-mono)' }}>Buscando…</p>
            )}

            {resultados.map(c => (
              <button
                key={c.id}
                onClick={() => selecionarCliente(c)}
                style={{
                  width: '100%', textAlign: 'left', padding: '12px 14px', border: '1px solid var(--border)',
                  borderRadius: 10, background: 'var(--bg-surface-2)', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-dim)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
              >
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 3px' }}>
                  {c.nome || '—'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-space-mono)' }}>
                  {formatPhone(c.telefone)}{c.endereco ? ` · ${c.endereco}` : ''}
                </p>
              </button>
            ))}

            {busca.length >= 2 && !buscando && resultados.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-space-mono)' }}>
                Nenhum cliente encontrado.
              </p>
            )}
          </div>

          {/* Novo cliente */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserPlus size={14} style={{ color: 'var(--accent)' }} />
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Novo cliente</p>
            </div>
            {(['nome', 'telefone'] as const).map(field => (
              <div key={field}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  {field === 'nome' ? 'Nome *' : 'Telefone *'}
                </label>
                <input
                  value={novoCliente[field]}
                  onChange={e => setNovoCliente(prev => ({ ...prev, [field]: e.target.value }))}
                  placeholder={field === 'telefone' ? '(53) 9xxxx-xxxx' : ''}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-surface-2)',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1.5 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Endereço {novoClienteCoords && <span style={{ color: 'var(--green)', marginLeft: 4 }}>✓ GPS</span>}
                </label>
                <BuscaEndereco
                  value={novoCliente.endereco}
                  onChange={valor => { setNovoCliente(prev => ({ ...prev, endereco: valor })); setNovoClienteCoords(null); }}
                  onSelect={escolherEndereco}
                  ariaLabel="Endereço do cliente"
                  inputStyle={{
                    width: '100%', padding: '9px 12px', border: `1px solid ${novoClienteCoords ? 'var(--green)' : 'var(--border)'}`,
                    borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-surface-2)',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 0.8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Número
                </label>
                <input
                  value={novoCliente.numero}
                  onChange={e => setNovoCliente(prev => ({ ...prev, numero: e.target.value }))}
                  placeholder="123, S/N"
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-surface-2)',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Complemento
                </label>
                <input
                  value={novoCliente.complemento}
                  onChange={e => setNovoCliente(prev => ({ ...prev, complemento: e.target.value }))}
                  placeholder="Apto, Casa 2..."
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-surface-2)',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: 5 }}>
                  Bairro
                </label>
                <input
                  value={novoCliente.bairro}
                  onChange={e => setNovoCliente(prev => ({ ...prev, bairro: e.target.value }))}
                  style={{
                    width: '100%', padding: '9px 12px', border: '1px solid var(--border)',
                    borderRadius: 8, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-surface-2)',
                    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
            <button
              onClick={criarNovoCliente}
              disabled={!novoCliente.nome || !novoCliente.telefone || criandoCliente}
              style={{
                padding: '10px 0', background: novoCliente.nome && novoCliente.telefone ? 'var(--accent)' : 'var(--bg-surface-3)',
                color: novoCliente.nome && novoCliente.telefone ? '#fff' : 'var(--text-muted)',
                border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                cursor: novoCliente.nome && novoCliente.telefone ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-space-mono)', transition: 'all 0.15s',
              }}
            >
              {criandoCliente ? 'Criando…' : 'Cadastrar e Continuar →'}
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Pedido ──────────────────────────── */}
      {step === 'pedido' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, flex: 1, minHeight: 0 }}>

          {/* Produtos */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, overflowY: 'auto' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
              <Package size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
              Produtos
            </p>
            {produtos.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Nenhum produto cadastrado.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {produtos.map(p => {
                  const qtd = carrinho[p.id]?.qtd || 0;
                  return (
                    <div key={p.id} style={{
                      border: `1px solid ${qtd > 0 ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 10, padding: '14px 14px 12px',
                      background: qtd > 0 ? 'var(--accent-dim)' : 'var(--bg-surface-2)',
                      transition: 'all 0.15s',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>{p.nome}</p>
                          {(() => {
                            const pr = precoDe(p);
                            return (
                              <>
                                <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, margin: 0, fontFamily: 'var(--font-space-mono)' }}>
                                  {pr.moeda
                                    ? `${pr.simbolo}${pr.precoMoeda?.toFixed(2)}`
                                    : `R$ ${pr.precoBrl.toFixed(2)}`}
                                  {pr.moeda && (
                                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                                      {' '}· R$ {pr.precoBrl.toFixed(2)}
                                    </span>
                                  )}
                                </p>
                                {/* Deixa claro que o preço não é o de tabela —
                                    do contrário parece erro de cadastro. */}
                                {pr.especial && (
                                  <p style={{ fontSize: 9, color: '#9a3412', background: '#ffedd5', border: '1px solid #fdba74', borderRadius: 3, padding: '1px 5px', display: 'inline-block', marginTop: 3, fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    preço {pr.etiqueta}
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {p.estoqueBaixo && (
                          <span style={{ fontSize: 9, background: '#fef8ec', color: '#92400e', border: '1px solid #fcd97d', borderRadius: 4, padding: '2px 5px', fontFamily: 'var(--font-space-mono)', fontWeight: 700, letterSpacing: '0.06em', flexShrink: 0 }}>
                            BAIXO
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-space-mono)' }}>
                          Estoque: {p.quantidade}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            onClick={() => alterarQtd(p, -1)}
                            style={{ width: 26, height: 26, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)', cursor: qtd > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: qtd > 0 ? 1 : 0.3 }}
                          >
                            <Minus size={11} style={{ color: 'var(--text-secondary)' }} />
                          </button>
                          <span style={{ fontSize: 14, fontWeight: 700, color: qtd > 0 ? 'var(--accent)' : 'var(--text-muted)', minWidth: 16, textAlign: 'center', fontFamily: 'var(--font-space-mono)' }}>
                            {qtd}
                          </span>
                          <button
                            onClick={() => alterarQtd(p, 1)}
                            style={{ width: 26, height: 26, border: '1px solid var(--accent)', borderRadius: 6, background: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Plus size={11} style={{ color: '#fff' }} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resumo + pagamento */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14, position: 'sticky', top: 0, maxHeight: '80vh', overflowY: 'auto' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Resumo</p>

            {/* Cliente */}
            <div style={{ padding: '10px 12px', background: 'var(--bg-surface-2)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 2px', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cliente</p>
              <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{clienteSelecionado?.nome || '—'}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', fontFamily: 'var(--font-space-mono)' }}>
                {clienteSelecionado?.endereco || 'Sem endereço'}
              </p>
            </div>

            {/* Itens */}
            <div style={{ flex: 1 }}>
              {itens.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', margin: 0 }}>Nenhum item adicionado</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {itens.map(i => (
                    <div key={i.produto.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{i.qtd}× {i.produto.nome}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>
                        R$ {(i.qtd * precoDe(i.produto).precoBrl).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Divisor + total */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total ({qtdTotal} {qtdTotal === 1 ? 'item' : 'itens'})</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>
                  {moedaAtiva && totalMoeda !== null
                    ? `${moedaAtiva.simbolo}${totalMoeda.toFixed(2)}`
                    : `R$ ${total.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Pagamento */}
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pagamento</p>
              {/* Vem do cadastro de Pagamentos: formas novas aparecem aqui
                  sozinhas, sem precisar mexer no código. */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {formasPagamento.length === 0 ? (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', fontStyle: 'italic' }}>
                    Nenhuma forma de pagamento ativa — cadastre em Pagamentos.
                  </p>
                ) : formasPagamento.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setPagamento(p)}
                    style={{
                      flex: '1 1 auto', minWidth: 88, padding: '7px 10px',
                      border: `1px solid ${pagamento?.id === p.id ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 7, background: pagamento?.id === p.id ? 'var(--accent-dim)' : 'var(--bg-surface-2)',
                      color: pagamento?.id === p.id ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-space-mono)',
                      transition: 'all 0.15s',
                    }}
                  >{p.nome}</button>
                ))}
              </div>
            </div>

            {/* Troco segue a marcação do cadastro, em vez de presumir que só
                dinheiro aceita — pagamento em pesos também precisa. */}
            {pagamento?.aceitaTroco && (
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 }}>
                  Troco para (opcional)
                </label>
                <input
                  type="number"
                  value={troco}
                  onChange={e => setTroco(e.target.value)}
                  placeholder="R$ 0,00"
                  style={{
                    width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
                    borderRadius: 7, fontSize: 13, color: 'var(--text-primary)', background: 'var(--bg-surface-2)',
                    outline: 'none', fontFamily: 'var(--font-space-mono)', boxSizing: 'border-box',
                  }}
                />
              </div>
            )}

            {/* Entregador */}
            <div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Entregador</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <button
                  onClick={() => setEntregadorSelecionado(null)}
                  style={{
                    width: '100%', padding: '8px 12px', textAlign: 'left',
                    border: `1px solid ${entregadorSelecionado === null ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 7, background: entregadorSelecionado === null ? 'var(--accent-dim)' : 'var(--bg-surface-2)',
                    color: entregadorSelecionado === null ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-space-mono)',
                    transition: 'all 0.15s',
                  }}
                >
                  ⚡ Automático (menor carga)
                </button>
                {entregadoresDisponiveis.map(e => (
                  <button
                    key={e.id}
                    onClick={() => setEntregadorSelecionado(e.id)}
                    style={{
                      width: '100%', padding: '8px 12px', textAlign: 'left',
                      border: `1px solid ${entregadorSelecionado === e.id ? 'var(--accent)' : 'var(--border)'}`,
                      borderRadius: 7, background: entregadorSelecionado === e.id ? 'var(--accent-dim)' : 'var(--bg-surface-2)',
                      color: entregadorSelecionado === e.id ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <span>🛵 {e.nome}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-space-mono)', opacity: 0.7 }}>
                      {e.pedidosAtivos} ativo{e.pedidosAtivos !== 1 ? 's' : ''}
                    </span>
                  </button>
                ))}
                {entregadoresDisponiveis.length === 0 && (
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', margin: 0 }}>
                    Nenhum disponível — será atribuído automaticamente
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={confirmarPedido}
              disabled={!itens.length || submetendo}
              style={{
                padding: '13px 0', background: itens.length ? 'var(--accent)' : 'var(--bg-surface-3)',
                color: itens.length ? '#fff' : 'var(--text-muted)',
                border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14,
                cursor: itens.length && !submetendo ? 'pointer' : 'not-allowed',
                fontFamily: 'var(--font-space-mono)', transition: 'all 0.15s',
                letterSpacing: '0.04em',
              }}
            >
              {submetendo ? 'Enviando…' : 'Confirmar Pedido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
