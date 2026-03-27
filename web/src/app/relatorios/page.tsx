'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

/* ─── Types ─────────────────────────────────────────── */
interface Resumo {
  totalPedidos: number; receita: number; entregues: number;
  cancelados: number; tempoMedio: number; taxaConclusao: number; ticketMedio: number;
  deltas: { totalPedidos: number | null; receita: number | null; entregues: number | null };
}
interface Serie    { dia: string; pedidos: number; receita: number; entregues: number }
interface Produto  { produto: string; qtd: number; receita: number }
interface Entregador { nome: string; total: number; entregues: number; cancelados: number; tempoMedio: number }
interface Bairro   { bairro: string; pedidos: number; receita: number }

/* ─── Period config ──────────────────────────────────── */
const PERIODOS = [
  { id: 'hoje', label: 'Hoje' },
  { id: '7d',   label: '7 dias' },
  { id: '30d',  label: '30 dias' },
  { id: 'mes',  label: 'Este mês' },
];

/* ─── Animated counter hook ──────────────────────────── */
function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(from + (target - from) * ease);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

/* ─── SVG area chart ─────────────────────────────────── */
function AreaChart({ data, field, color }: { data: Serie[]; field: 'receita' | 'pedidos'; color: string }) {
  const W = 800, H = 140, PL = 8, PR = 8, PT = 16, PB = 24;
  const vals = data.map(d => d[field] as number);
  const max = Math.max(...vals, 1);

  if (data.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="13" fontFamily="monospace">
          Sem dados para o período
        </text>
      </svg>
    );
  }

  const xOf = (i: number) => PL + (i / Math.max(data.length - 1, 1)) * (W - PL - PR);
  const yOf = (v: number) => PT + (1 - v / max) * (H - PT - PB);

  const pts = data.map((d, i) => `${xOf(i)},${yOf(d[field] as number)}`).join(' L ');
  const areaD = `M ${pts} L ${xOf(data.length - 1)},${H - PB} L ${xOf(0)},${H - PB} Z`;
  const lineD = `M ${pts}`;
  const id = `grad-${field}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <filter id={`glow-${field}`}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map(p => (
        <line key={p} x1={PL} x2={W - PR} y1={PT + (1 - p) * (H - PT - PB)} y2={PT + (1 - p) * (H - PT - PB)}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}

      {/* Area */}
      <path d={areaD} fill={`url(#${id})`} />

      {/* Line */}
      <path d={lineD} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
        filter={`url(#glow-${field})`}
        style={{
          strokeDasharray: 2000,
          strokeDashoffset: 2000,
          animation: 'drawLine 1.2s ease forwards',
        }}
      />

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (data.length > 14 && i % 3 !== 0) return null;
        const label = new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return (
          <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
            fill="rgba(255,255,255,0.22)" fontSize="9" fontFamily="monospace">
            {label}
          </text>
        );
      })}

      {/* Dots at data points (sparse) */}
      {data.map((d, i) => {
        if (data.length > 10 && i % 2 !== 0) return null;
        return (
          <circle key={i} cx={xOf(i)} cy={yOf(d[field] as number)} r="3"
            fill={color} opacity="0.7" />
        );
      })}
    </svg>
  );
}

/* ─── Delta badge ────────────────────────────────────── */
function Delta({ v }: { v: number | null }) {
  if (v === null) return <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, fontFamily: 'monospace' }}>—</span>;
  const up = v >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
      color: up ? '#10b981' : '#ef4444',
      background: up ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
      border: `1px solid ${up ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
      borderRadius: 4, padding: '2px 6px',
    }}>
      {up ? '▲' : '▼'} {Math.abs(v)}%
    </span>
  );
}

/* ─── KPI card ───────────────────────────────────────── */
function KpiCard({ label, value, format, delta, accent }: {
  label: string; value: number; delta?: number | null;
  format: (v: number) => string; accent: string;
}) {
  const animated = useCountUp(value);
  return (
    <div style={{
      background: '#0c1220',
      border: `1px solid rgba(255,255,255,0.07)`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 12,
      padding: '20px 22px',
      display: 'flex', flexDirection: 'column', gap: 8,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse at top left, ${accent}0d 0%, transparent 60%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1, color: '#e8edf5', fontFamily: 'var(--font-barlow)' }}>
        {format(animated)}
      </div>
      {delta !== undefined && <Delta v={delta ?? null} />}
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────── */
export default function RelatoriosPage() {
  const [periodo, setPeriodo]         = useState('7d');
  const [loading, setLoading]         = useState(true);
  const [resumo, setResumo]           = useState<Resumo | null>(null);
  const [serie, setSerie]             = useState<Serie[]>([]);
  const [produtos, setProdutos]       = useState<Produto[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [bairros, setBairros]         = useState<Bairro[]>([]);
  const [chartField, setChartField]   = useState<'receita' | 'pedidos'>('receita');

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const [r, s, prod, ent, bairro] = await Promise.all([
        api.getRelatorioResumo(p),
        api.getRelatorioSerie(p),
        api.getRelatorioProdutos(p),
        api.getRelatorioEntregadores(p),
        api.getRelatorioBairros(p),
      ]);
      setResumo(r);
      setSerie(s);
      setProdutos(prod);
      setEntregadores(ent);
      setBairros(bairro);
    } catch (_) {
      setResumo(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(periodo); }, [periodo, load]);

  const maxProdQtd  = Math.max(...produtos.map(p => p.qtd), 1);
  const maxEntQtd   = Math.max(...entregadores.map(e => e.entregues), 1);
  const maxBairroQtd = Math.max(...bairros.map(b => b.pedidos), 1);

  return (
    <>
      <style>{`
        @keyframes drawLine { to { stroke-dashoffset: 0; } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .rel-section { animation: fadeUp 0.5s ease both; }
        .rel-section:nth-child(1) { animation-delay: 0.05s; }
        .rel-section:nth-child(2) { animation-delay: 0.12s; }
        .rel-section:nth-child(3) { animation-delay: 0.18s; }
        .rel-section:nth-child(4) { animation-delay: 0.24s; }
        .rel-section:nth-child(5) { animation-delay: 0.30s; }
        .period-btn { transition: all 0.15s ease; cursor: pointer; }
        .period-btn:hover { border-color: rgba(136,170,255,0.4) !important; color: #88aaff !important; }
        .chart-tab { cursor: pointer; transition: all 0.15s ease; }
        .chart-tab:hover { opacity: 0.8; }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#07090f',
        padding: '28px',
        color: '#e8edf5',
      }}>

        {/* ── Header ── */}
        <div className="rel-section" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(136,170,255,0.6)', fontFamily: 'monospace', textTransform: 'uppercase', marginBottom: 6 }}>
              Inteligência Operacional
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0, color: '#e8edf5', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
              Relatórios
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
            {PERIODOS.map(p => (
              <button key={p.id} className="period-btn" onClick={() => setPeriodo(p.id)}
                style={{
                  padding: '7px 16px', borderRadius: 7, border: 'none',
                  background: periodo === p.id ? 'rgba(37,87,231,0.5)' : 'transparent',
                  color: periodo === p.id ? '#88aaff' : 'rgba(255,255,255,0.4)',
                  fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                  letterSpacing: '0.06em',
                  boxShadow: periodo === p.id ? '0 0 12px rgba(37,87,231,0.3)' : 'none',
                }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="rel-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
          <KpiCard label="Receita Total"    value={resumo?.receita ?? 0}       format={v => `R$ ${v.toFixed(0)}`}       delta={resumo?.deltas.receita}      accent="#2557e7" />
          <KpiCard label="Pedidos"          value={resumo?.totalPedidos ?? 0}  format={v => Math.round(v).toString()}   delta={resumo?.deltas.totalPedidos} accent="#88aaff" />
          <KpiCard label="Entregues"        value={resumo?.entregues ?? 0}     format={v => Math.round(v).toString()}   delta={resumo?.deltas.entregues}    accent="#10b981" />
          <KpiCard label="Ticket Médio"     value={resumo?.ticketMedio ?? 0}   format={v => `R$ ${v.toFixed(0)}`}       accent="#f59e0b" />
        </div>
        <div className="rel-section" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          <KpiCard label="Taxa de Conclusão" value={resumo?.taxaConclusao ?? 0} format={v => `${Math.round(v)}%`} accent="#10b981" />
          <KpiCard label="Cancelados"        value={resumo?.cancelados ?? 0}    format={v => Math.round(v).toString()} accent="#ef4444" />
          <KpiCard label="Tempo Médio"       value={resumo?.tempoMedio ?? 0}    format={v => `${Math.round(v)} min`} accent="#f59e0b" />
        </div>

        {/* ── Chart ── */}
        <div className="rel-section" style={{
          background: '#0c1220',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14,
          padding: '20px 24px',
          marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
              Evolução · {PERIODOS.find(p => p.id === periodo)?.label}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {([['receita', '#2557e7', 'Receita'], ['pedidos', '#10b981', 'Pedidos']] as const).map(([f, c, l]) => (
                <button key={f} className="chart-tab" onClick={() => setChartField(f)}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 10, fontFamily: 'monospace',
                    fontWeight: 700, letterSpacing: '0.06em', border: 'none', cursor: 'pointer',
                    background: chartField === f ? `${c}22` : 'transparent',
                    color: chartField === f ? c : 'rgba(255,255,255,0.3)',
                    borderBottom: chartField === f ? `2px solid ${c}` : '2px solid transparent',
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ height: 140, position: 'relative' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace', fontSize: 12 }}>
                Carregando…
              </div>
            ) : (
              <AreaChart key={`${periodo}-${chartField}`} data={serie} field={chartField} color={chartField === 'receita' ? '#2557e7' : '#10b981'} />
            )}
          </div>
        </div>

        {/* ── Bottom grid ── */}
        <div className="rel-section" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>

          {/* Top Produtos */}
          <Panel title="Top Produtos" sub="por unidades vendidas">
            {produtos.length === 0 ? <Empty /> : produtos.map((p, i) => (
              <BarRow key={p.produto} rank={i + 1} label={p.produto}
                value={p.qtd} suffix="un" ratio={p.qtd / maxProdQtd}
                sub={`R$ ${p.receita.toFixed(0)}`} color="#88aaff" />
            ))}
          </Panel>

          {/* Top Entregadores */}
          <Panel title="Entregadores" sub="desempenho no período">
            {entregadores.length === 0 ? <Empty /> : entregadores.map((e, i) => (
              <div key={e.nome} style={{
                padding: '10px 0',
                borderBottom: i < entregadores.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10, fontFamily: 'monospace', color: i === 0 ? '#88aaff' : 'rgba(255,255,255,0.25)', width: 16 }}>
                      #{i + 1}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e8edf5' }}>{e.nome}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#10b981', fontWeight: 700 }}>{e.entregues}</span>
                    {e.tempoMedio > 0 && (
                      <span style={{ fontSize: 10, fontFamily: 'monospace', color: 'rgba(255,255,255,0.3)' }}>{e.tempoMedio}min</span>
                    )}
                  </div>
                </div>
                <div style={{ marginLeft: 24, display: 'flex', gap: 6, alignItems: 'center' }}>
                  <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(e.entregues / maxEntQtd) * 100}%`, background: '#10b981', borderRadius: 2, transition: 'width 0.6s ease' }} />
                  </div>
                  {e.cancelados > 0 && (
                    <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#ef4444' }}>{e.cancelados} cancel.</span>
                  )}
                </div>
              </div>
            ))}
          </Panel>

          {/* Top Bairros */}
          <Panel title="Top Bairros" sub="por volume de pedidos">
            {bairros.length === 0 ? <Empty /> : bairros.map((b, i) => (
              <BarRow key={b.bairro} rank={i + 1} label={b.bairro}
                value={b.pedidos} suffix="ped" ratio={b.pedidos / maxBairroQtd}
                sub={`R$ ${b.receita.toFixed(0)}`} color="#f59e0b" />
            ))}
          </Panel>
        </div>

      </div>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────── */
function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0c1220',
      border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 14,
      padding: '18px 20px',
    }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', fontFamily: 'monospace' }}>
          {title}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', marginTop: 2 }}>
          {sub}
        </div>
      </div>
      {children}
    </div>
  );
}

function BarRow({ rank, label, value, suffix, ratio, sub, color }: {
  rank: number; label: string; value: number; suffix: string;
  ratio: number; sub: string; color: string;
}) {
  return (
    <div style={{ paddingBottom: 10, marginBottom: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 9, fontFamily: 'monospace', color: rank === 1 ? color : 'rgba(255,255,255,0.2)', width: 14, flexShrink: 0 }}>
            #{rank}
          </span>
          <span style={{ fontSize: 12, color: '#e8edf5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color }}>{value}</span>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{suffix}</span>
        </div>
      </div>
      <div style={{ marginLeft: 22, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${ratio * 100}%`, background: color, opacity: 0.7, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>{sub}</span>
      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace', paddingTop: 8 }}>Sem dados</div>;
}
