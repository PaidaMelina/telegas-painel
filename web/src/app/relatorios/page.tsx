'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface Resumo {
  totalPedidos: number; receita: number; entregues: number;
  cancelados: number; tempoMedio: number; taxaConclusao: number; ticketMedio: number;
  deltas: { totalPedidos: number | null; receita: number | null; entregues: number | null };
}
interface Serie      { dia: string; pedidos: number; receita: number; entregues: number }
interface Produto    { produto: string; qtd: number; receita: number }
interface Entregador { nome: string; total: number; entregues: number; cancelados: number; tempoMedio: number }
interface Bairro     { bairro: string; pedidos: number; receita: number }

const PERIODOS = [
  { id: 'hoje', label: 'Hoje'     },
  { id: '7d',   label: '7 dias'   },
  { id: '30d',  label: '30 dias'  },
  { id: 'mes',  label: 'Este mês' },
];

/* ── animated counter ──────────────────────────────── */
function useCountUp(target: number, duration = 900): number {
  const [val, setVal] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return val;
}

/* ── SVG area chart ─────────────────────────────────── */
function AreaChart({ data, field, color }: {
  data: Serie[]; field: 'receita' | 'pedidos'; color: string;
}) {
  const W = 800, H = 140, PL = 8, PR = 8, PT = 16, PB = 24;
  const vals = data.map(d => d[field] as number);
  const max  = Math.max(...vals, 1);

  if (data.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
        <text x={W / 2} y={H / 2} textAnchor="middle"
          fill="rgba(74,85,104,0.4)" fontSize="13" fontFamily="monospace">
          Sem dados para o período
        </text>
      </svg>
    );
  }

  const xOf   = (i: number) => PL + (i / Math.max(data.length - 1, 1)) * (W - PL - PR);
  const yOf   = (v: number) => PT + (1 - v / max) * (H - PT - PB);
  const pts   = data.map((d, i) => `${xOf(i)},${yOf(d[field] as number)}`).join(' L ');
  const areaD = `M ${pts} L ${xOf(data.length - 1)},${H - PB} L ${xOf(0)},${H - PB} Z`;
  const id    = `grad-${field}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(p => (
        <line key={p} x1={PL} x2={W - PR}
          y1={PT + (1 - p) * (H - PT - PB)} y2={PT + (1 - p) * (H - PT - PB)}
          stroke="rgba(13,20,36,0.06)" strokeWidth="1" />
      ))}
      <path d={areaD} fill={`url(#${id})`} />
      <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 2000, strokeDashoffset: 2000, animation: 'drawLine 1.2s ease forwards' }} />
      {data.map((d, i) => {
        if (data.length > 14 && i % 3 !== 0) return null;
        const label = new Date(d.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return (
          <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle"
            fill="rgba(13,20,36,0.3)" fontSize="9" fontFamily="monospace">
            {label}
          </text>
        );
      })}
      {data.map((d, i) => {
        if (data.length > 10 && i % 2 !== 0) return null;
        return <circle key={i} cx={xOf(i)} cy={yOf(d[field] as number)} r="3" fill={color} opacity="0.8" />;
      })}
    </svg>
  );
}

/* ── Delta badge ────────────────────────────────────── */
function Delta({ v }: { v: number | null }) {
  if (v === null) {
    return <span style={{ color: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font-space-mono)' }}>—</span>;
  }
  const up = v >= 0;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 2,
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
      color:      up ? 'var(--green)' : 'var(--red)',
      background: up ? 'rgba(4,120,87,0.08)' : 'rgba(200,30,30,0.08)',
      border:     `1px solid ${up ? 'rgba(4,120,87,0.2)' : 'rgba(200,30,30,0.2)'}`,
      borderRadius: 4, padding: '2px 6px',
    }}>
      {up ? '▲' : '▼'} {Math.abs(v)}%
    </span>
  );
}

/* ── KPI card ───────────────────────────────────────── */
function KpiCard({ label, value, format, delta, accent }: {
  label: string; value: number; delta?: number | null;
  format: (v: number) => string; accent: string;
}) {
  const animated = useCountUp(value);
  return (
    <div className="kpi-card" style={{ borderTop: `2px solid ${accent}`, padding: '20px 24px' }}>
      <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: 12 }}>
        {label}
      </p>
      <p style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', marginBottom: 8 }}>
        {format(animated)}
      </p>
      {delta !== undefined && <Delta v={delta ?? null} />}
    </div>
  );
}

/* ── Panel wrapper ──────────────────────────────────── */
function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '22px' }}>
      <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: 2 }}>
        {title}
      </p>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 14 }}>
        {sub}
      </p>
      {children}
    </div>
  );
}

/* ── Bar row ─────────────────────────────────────────── */
function BarRow({ rank, label, value, suffix, ratio, sub, color }: {
  rank: number; label: string; value: number; suffix: string;
  ratio: number; sub: string; color: string;
}) {
  return (
    <div style={{ paddingBottom: 9 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-space-mono)', color: rank === 1 ? color : 'var(--text-muted)', width: 14, flexShrink: 0 }}>
            #{rank}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 5, flexShrink: 0, marginLeft: 8, alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-space-mono)', color }}>{value}</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{suffix}</span>
        </div>
      </div>
      <div style={{ marginLeft: 22, display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, height: 3, background: 'var(--bg-surface-3)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${ratio * 100}%`, background: color, opacity: 0.75, borderRadius: 2, transition: 'width 0.6s ease' }} />
        </div>
        <span style={{ fontSize: 9, fontFamily: 'var(--font-space-mono)', color: 'var(--text-muted)', flexShrink: 0 }}>{sub}</span>
      </div>
    </div>
  );
}

function Empty() {
  return <p style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', paddingTop: 8 }}>Sem dados</p>;
}

/* ── Page ───────────────────────────────────────────── */
export default function RelatoriosPage() {
  const [periodo, setPeriodo]           = useState('7d');
  const [loading, setLoading]           = useState(true);
  const [erro, setErro]                 = useState('');
  const [resumo, setResumo]             = useState<Resumo | null>(null);
  const [serie, setSerie]               = useState<Serie[]>([]);
  const [produtos, setProdutos]         = useState<Produto[]>([]);
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [bairros, setBairros]           = useState<Bairro[]>([]);
  const [chartField, setChartField]     = useState<'receita' | 'pedidos'>('receita');

  const load = useCallback(async (p: string) => {
    setLoading(true); setErro('');
    const [r, s, prod, ent, bairro] = await Promise.allSettled([
      api.getRelatorioResumo(p),
      api.getRelatorioSerie(p),
      api.getRelatorioProdutos(p),
      api.getRelatorioEntregadores(p),
      api.getRelatorioBairros(p),
    ]);
    const failed = [r, s, prod, ent, bairro].filter(x => x.status === 'rejected');
    if (failed.length > 0) {
      setErro(`Erro ao carregar ${failed.length} seção(ões). Verifique se o backend está acessível.`);
    }
    setResumo(r.status === 'fulfilled' ? r.value : null);
    setSerie(s.status === 'fulfilled' ? s.value : []);
    setProdutos(prod.status === 'fulfilled' ? prod.value : []);
    setEntregadores(ent.status === 'fulfilled' ? ent.value : []);
    setBairros(bairro.status === 'fulfilled' ? bairro.value : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(periodo); }, [periodo, load]);

  const maxProd   = Math.max(...produtos.map(p => p.qtd), 1);
  const maxEnt    = Math.max(...entregadores.map(e => e.entregues), 1);
  const maxBairro = Math.max(...bairros.map(b => b.pedidos), 1);

  return (
    <main style={{ padding: '32px 28px', width: '100%' }}>
      <style>{`
        @keyframes drawLine { to { stroke-dashoffset: 0; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .rel-row { animation: fadeUp 0.45s ease both; }
        .rel-row:nth-child(1){animation-delay:0.04s} .rel-row:nth-child(2){animation-delay:0.10s}
        .rel-row:nth-child(3){animation-delay:0.16s} .rel-row:nth-child(4){animation-delay:0.22s}
        .rel-row:nth-child(5){animation-delay:0.28s}
        .chart-tab { cursor:pointer; transition:all 0.15s; } .chart-tab:hover { opacity:0.7; }
      `}</style>

      {/* Header */}
      <div className="rel-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 6 }}>
            Inteligência Operacional
          </p>
          <h1 style={{ fontSize: 30, fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1, fontFamily: 'var(--font-barlow)', margin: 0 }}>
            Relatórios
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)} style={{
              padding: '6px 14px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
              border: `1px solid ${periodo === p.id ? 'var(--accent)' : 'var(--border)'}`,
              background: periodo === p.id ? 'var(--accent-dim)' : 'var(--bg-surface)',
              color: periodo === p.id ? 'var(--accent)' : 'var(--text-secondary)',
              fontFamily: 'var(--font-space-mono)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fff1f1', color: '#991b1b', marginBottom: 20, fontSize: 13, fontFamily: 'var(--font-space-mono)' }}>
          ⚠ {erro}
        </div>
      )}

      {/* KPIs row 1 */}
      <div className="rel-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <KpiCard label="Receita Total"  value={resumo?.receita ?? 0}       format={v => `R$ ${v.toFixed(0)}`}     delta={resumo?.deltas.receita}      accent="var(--accent)" />
        <KpiCard label="Pedidos"        value={resumo?.totalPedidos ?? 0}  format={v => Math.round(v).toString()} delta={resumo?.deltas.totalPedidos} accent="var(--blue)" />
        <KpiCard label="Entregues"      value={resumo?.entregues ?? 0}     format={v => Math.round(v).toString()} delta={resumo?.deltas.entregues}    accent="var(--green)" />
        <KpiCard label="Ticket Médio"   value={resumo?.ticketMedio ?? 0}   format={v => `R$ ${v.toFixed(0)}`}     accent="var(--amber)" />
      </div>

      {/* KPIs row 2 */}
      <div className="rel-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
        <KpiCard label="Taxa de Conclusão" value={resumo?.taxaConclusao ?? 0} format={v => `${Math.round(v)}%`}           accent="var(--green)" />
        <KpiCard label="Cancelados"        value={resumo?.cancelados ?? 0}    format={v => Math.round(v).toString()}       accent="var(--red)" />
        <KpiCard label="Tempo Médio"       value={resumo?.tempoMedio ?? 0}    format={v => `${Math.round(v)} min`}         accent="var(--amber)" />
      </div>

      {/* Chart */}
      <div className="rel-row" style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '22px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', margin: 0 }}>
            Evolução · {PERIODOS.find(p => p.id === periodo)?.label}
          </p>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['receita', 'pedidos'] as const).map(f => (
              <button key={f} className="chart-tab" onClick={() => setChartField(f)} style={{
                padding: '4px 12px', borderRadius: 6, fontSize: 10, border: 'none', background: 'transparent',
                fontFamily: 'var(--font-space-mono)', fontWeight: 700, letterSpacing: '0.06em',
                color: chartField === f ? (f === 'receita' ? 'var(--accent)' : 'var(--green)') : 'var(--text-muted)',
                borderBottom: `2px solid ${chartField === f ? (f === 'receita' ? 'var(--accent)' : 'var(--green)') : 'transparent'}`,
              }}>
                {f === 'receita' ? 'Receita' : 'Pedidos'}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 140 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', fontSize: 12 }}>
              Carregando…
            </div>
          ) : (
            <AreaChart key={`${periodo}-${chartField}`} data={serie} field={chartField}
              color={chartField === 'receita' ? '#2557e7' : '#047857'} />
          )}
        </div>
      </div>

      {/* Bottom panels */}
      <div className="rel-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

        <Panel title="Top Produtos" sub="por unidades vendidas">
          {produtos.length === 0 ? <Empty /> : produtos.map((p, i) => (
            <BarRow key={p.produto} rank={i + 1} label={p.produto}
              value={p.qtd} suffix="un" ratio={p.qtd / maxProd}
              sub={`R$ ${p.receita.toFixed(0)}`} color="var(--accent)" />
          ))}
        </Panel>

        <Panel title="Entregadores" sub="desempenho no período">
          {entregadores.length === 0 ? <Empty /> : entregadores.map((e, i) => (
            <div key={e.nome} style={{ padding: '10px 0', borderBottom: i < entregadores.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, fontFamily: 'var(--font-space-mono)', color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', width: 16 }}>
                    #{i + 1}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.nome}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-space-mono)', color: 'var(--green)', fontWeight: 700 }}>{e.entregues}</span>
                  {e.tempoMedio > 0 && (
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-space-mono)', color: 'var(--text-muted)' }}>{e.tempoMedio}min</span>
                  )}
                </div>
              </div>
              <div style={{ marginLeft: 24, display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{ flex: 1, height: 3, background: 'var(--bg-surface-3)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(e.entregues / maxEnt) * 100}%`, background: 'var(--green)', borderRadius: 2, transition: 'width 0.6s ease' }} />
                </div>
                {e.cancelados > 0 && (
                  <span style={{ fontSize: 9, fontFamily: 'var(--font-space-mono)', color: 'var(--red)' }}>{e.cancelados} cancel.</span>
                )}
              </div>
            </div>
          ))}
        </Panel>

        <Panel title="Top Bairros" sub="por volume de pedidos">
          {bairros.length === 0 ? <Empty /> : bairros.map((b, i) => (
            <BarRow key={b.bairro} rank={i + 1} label={b.bairro}
              value={b.pedidos} suffix="ped" ratio={b.pedidos / maxBairro}
              sub={`R$ ${b.receita.toFixed(0)}`} color="var(--amber)" />
          ))}
        </Panel>

      </div>
    </main>
  );
}
