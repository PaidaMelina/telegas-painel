import React from 'react';
import { api } from '@/lib/api';
import { Package, CheckCircle2, Truck, AlertTriangle, ArrowRight, TrendingUp, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import ConversasPanel from '@/components/ConversasPanel';

export const revalidate = 30;

const STATUS_LABELS: Record<string, string> = {
  atribuido: 'Atribuído',
  saiu_para_entrega: 'Em Rota',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  novo: 'Novo',
};

const STATUS_COLORS: Record<string, string> = {
  atribuido: '#c27803',
  saiu_para_entrega: '#2557e7',
  entregue: '#047857',
  cancelado: '#c81e1e',
  novo: '#94a3b8',
};

const STATUS_ORDER = ['atribuido', 'saiu_para_entrega', 'entregue', 'cancelado', 'novo'];

interface Produto {
  qtd: number;
  produto: string;
  preco: number;
}

interface Pedido {
  id: number;
  telefone_cliente: string;
  produtos: Produto[];
  total: string;
  endereco: string;
  bairro: string;
  status: string;
  created_at: string;
  atribuido_em: string | null;
  entregue_em: string | null;
  cancelado_em: string | null;
  entregador_nome: string | null;
  tempo_entrega_min: number | null;
}

const ACTIVE_STATUSES = new Set(['novo', 'atribuido', 'saiu_para_entrega']);

function fmtHHMM(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
}

function elapsedMin(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function urgencyRowStyle(p: Pedido): React.CSSProperties {
  if (!ACTIVE_STATUSES.has(p.status)) return {};
  const mins = elapsedMin(p.created_at);
  if (mins >= 60) return { background: 'rgba(220,38,38,0.07)' };
  if (mins >= 30) return { background: 'rgba(217,119,6,0.07)' };
  return {};
}

interface ProdutoStat { qtd: number; receita: number; }
interface ProdutosHoje { gasAzul: ProdutoStat; gasNacional: ProdutoStat; agua: ProdutoStat; outros: ProdutoStat; }

export default async function DashboardPage() {
  let summary = { hoje: { total: 0, entregues: 0 }, emAberto: 0 };
  let pedidos: Pedido[] = [];
  let metrics = { ticketMedio: 0, tempoMedioEntrega: 0, pedidosAtrasados: 0 };
  let statusDist: { status: string; count: number }[] = [];
  let byBairro: { bairro: string; count: number; total: number }[] = [];
  let byEntregador: { nome: string; emAberto: number; entreguesHoje: number; tempoMedio: number }[] = [];
  const zero: ProdutoStat = { qtd: 0, receita: 0 };
  let produtos: ProdutosHoje = { gasAzul: zero, gasNacional: zero, agua: zero, outros: zero };
  let apiError = false;

  const [summaryResult, pedidosResult, metricsResult, statusDistResult, byBairroResult, byEntregadorResult, produtosResult] =
    await Promise.allSettled([
      api.getDashboardSummary(),
      api.getPedidos({ limit: '20' }),
      api.getDashboardMetrics(),
      api.getDashboardStatusDistribution(),
      api.getDashboardByBairro(),
      api.getDashboardByEntregador(),
      api.getDashboardProdutosHoje(),
    ]);

  if (summaryResult.status === 'fulfilled') {
    summary = summaryResult.value;
  } else {
    apiError = true;
  }
  if (pedidosResult.status === 'fulfilled') pedidos = pedidosResult.value.data ?? [];
  if (metricsResult.status === 'fulfilled') metrics = metricsResult.value;
  if (statusDistResult.status === 'fulfilled') statusDist = statusDistResult.value;
  if (byBairroResult.status === 'fulfilled') byBairro = byBairroResult.value;
  if (byEntregadorResult.status === 'fulfilled') byEntregador = byEntregadorResult.value;
  if (produtosResult.status === 'fulfilled') produtos = produtosResult.value;

  const taxaConclusao =
    summary.hoje.total > 0
      ? Math.round((summary.hoje.entregues / summary.hoje.total) * 100)
      : null;

  const now = new Date();
  const TZ = 'America/Sao_Paulo';
  const dateStr = now.toLocaleDateString('pt-BR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  const timeStr = now.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

  const maxBairroCount = byBairro[0]?.count || 1;
  const statusDistTotal = statusDist.reduce((acc, s) => acc + s.count, 0) || 1;
  const sortedStatusDist = [...statusDist].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  );
  const maxEntregadorAberto = Math.max(...byEntregador.map(e => e.emAberto), 1);

  const totalUnid = produtos.gasAzul.qtd + produtos.gasNacional.qtd + produtos.agua.qtd + produtos.outros.qtd || 1;
  const totalReceita = produtos.gasAzul.receita + produtos.gasNacional.receita + produtos.agua.receita + produtos.outros.receita;

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', minHeight: '100vh' }}>

      {/* ── Left: Main Content ── */}
      <main className="relative z-10" style={{ flex: 1, minWidth: 0, padding: '32px 28px', overflowX: 'hidden' }}>

        {/* ── Page Header ── */}
        <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px' }}>
              Painel de Operações
            </p>
            <h1 style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1, fontFamily: 'var(--font-barlow)' }}>
              Resumo do Dia
            </h1>
          </div>
          <div style={{ textAlign: 'right', paddingBottom: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '6px' }}>
              <span className="live-dot" />
              <span style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'var(--font-space-mono)' }}>
                Ao Vivo
              </span>
            </div>
            <p style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
              {timeStr}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'capitalize', fontFamily: 'var(--font-space-mono)' }}>
              {dateStr}
            </p>
          </div>
        </header>

        {/* ── Error Banner ── */}
        {apiError && (
          <div className="fade-up-1" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#f87171', marginBottom: '24px', fontSize: '13px' }}>
            <AlertTriangle size={15} strokeWidth={2} />
            <span>Backend inacessível. Verifique se o serviço está rodando na porta 3333 e o banco conectado.</span>
          </div>
        )}

        {/* ── KPI Row 1 — Operacional ── */}
        <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>

          <div className="kpi-card" style={{ borderTop: '2px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Pedidos Hoje</p>
              <Package size={13} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>
              {summary.hoje.total}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>pedidos recebidos</p>
          </div>

          <div className="kpi-card" style={{ borderTop: '2px solid #047857' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Entregues Hoje</p>
              <CheckCircle2 size={13} style={{ color: '#047857', opacity: 0.7 }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#047857' }}>
              {summary.hoje.entregues}
            </p>
            {taxaConclusao !== null ? (
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>taxa de conclusão</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#047857', fontFamily: 'var(--font-space-mono)' }}>{taxaConclusao}%</span>
                </div>
                <div style={{ height: '4px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${taxaConclusao}%`, background: '#047857', borderRadius: '2px', transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>sem pedidos hoje</p>
            )}
          </div>

          <div className={`kpi-card${summary.emAberto > 0 ? ' kpi-card-accent' : ''}`} style={{ borderTop: summary.emAberto > 0 ? '2px solid var(--accent)' : '2px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Em Aberto</p>
              <Truck size={13} style={{ color: summary.emAberto > 0 ? 'var(--accent)' : 'var(--text-muted)', opacity: 0.8 }} strokeWidth={1.5} />
            </div>
            <p style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: summary.emAberto > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
              {summary.emAberto}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>aguardando entrega</p>
          </div>
        </div>

        {/* ── KPI Row 2 — Métricas ── */}
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>

          <div className="kpi-card" style={{ borderTop: '2px solid var(--border)', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <TrendingUp size={13} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
              <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Ticket Médio</p>
            </div>
            <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>
              R$ {metrics.ticketMedio.toFixed(0)}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>valor médio por pedido</p>
          </div>

          <div className="kpi-card" style={{ borderTop: '2px solid var(--border)', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Clock size={13} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
              <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Tempo de Entrega</p>
            </div>
            <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>
              {metrics.tempoMedioEntrega > 0 ? `${Math.round(metrics.tempoMedioEntrega)}min` : '—'}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>média atribuição → entregue</p>
          </div>

          <div className={`kpi-card${metrics.pedidosAtrasados > 0 ? ' kpi-card-accent' : ''}`} style={{ borderTop: metrics.pedidosAtrasados > 0 ? '2px solid #c81e1e' : '2px solid var(--border)', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <AlertTriangle size={13} style={{ color: metrics.pedidosAtrasados > 0 ? '#c81e1e' : 'var(--text-muted)', opacity: 0.8 }} strokeWidth={1.5} />
              <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Atrasados</p>
            </div>
            <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: metrics.pedidosAtrasados > 0 ? '#c81e1e' : 'var(--text-primary)' }}>
              {metrics.pedidosAtrasados}
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>em aberto há mais de 60min</p>
          </div>
        </div>

        {/* ── Mix de Produtos · Hoje ── */}
        <div className="fade-up-2" style={{ marginBottom: '28px' }}>
          {/* Section label + stacked bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>
              Mix de Produtos · Hoje
            </p>
            <p style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)' }}>
              {totalUnid === 1 && produtos.gasAzul.qtd === 0 ? '—' : `${totalUnid} unid`}
              <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: '8px' }}>
                R$ {totalReceita.toFixed(0)}
              </span>
            </p>
          </div>

          {/* Stacked proportion bar */}
          <div style={{ height: '6px', borderRadius: '4px', overflow: 'hidden', display: 'flex', marginBottom: '14px', background: 'var(--bg-surface-3)', gap: '1px' }}>
            {[
              { pct: (produtos.gasAzul.qtd / totalUnid) * 100, color: '#2557e7' },
              { pct: (produtos.gasNacional.qtd / totalUnid) * 100, color: '#64748b' },
              { pct: (produtos.agua.qtd / totalUnid) * 100, color: '#0891b2' },
              { pct: (produtos.outros.qtd / totalUnid) * 100, color: '#94a3b8' },
            ].filter(s => s.pct > 0).map((s, i) => (
              <div key={i} style={{ width: `${s.pct}%`, background: s.color, height: '100%', borderRadius: '2px', transition: 'width 0.5s ease' }} />
            ))}
          </div>

          {/* 4-column product cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            {[
              { label: 'Gás Azul', sub: 'Ultragaz', data: produtos.gasAzul, color: '#2557e7', bg: 'rgba(37,87,231,0.06)', icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2557e7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 7 4 11 4 14a8 8 0 0016 0c0-3-2.5-7-8-12z"/><path d="M12 12v4"/></svg>
              )},
              { label: 'Gás Nacional', sub: 'Granel / Cinza', data: produtos.gasNacional, color: '#475569', bg: 'rgba(71,85,105,0.06)', icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2C6.5 7 4 11 4 14a8 8 0 0016 0c0-3-2.5-7-8-12z"/><path d="M12 12v4"/></svg>
              )},
              { label: 'Água', sub: '20 Litros', data: produtos.agua, color: '#0891b2', bg: 'rgba(8,145,178,0.06)', icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>
              )},
              { label: 'Outros', sub: 'Produtos', data: produtos.outros, color: '#94a3b8', bg: 'rgba(148,163,184,0.06)', icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              )},
            ].map(({ label, sub, data, color, bg, icon }) => {
              const pct = Math.round((data.qtd / totalUnid) * 100);
              return (
                <div key={label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '10px', borderTop: `2px solid ${color}`, padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
                  {/* Background tint */}
                  <div style={{ position: 'absolute', inset: 0, background: bg, pointerEvents: 'none' }} />
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px', position: 'relative' }}>
                    <div>
                      <p style={{ fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color, fontFamily: 'var(--font-space-mono)' }}>{label}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginTop: '1px' }}>{sub}</p>
                    </div>
                    <div style={{ opacity: 0.7 }}>{icon}</div>
                  </div>
                  {/* Big number */}
                  <p style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: data.qtd > 0 ? color : 'var(--text-muted)', position: 'relative', marginBottom: '4px' }}>
                    {data.qtd}
                  </p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '12px', position: 'relative' }}>
                    unidades vendidas
                  </p>
                  {/* Revenue */}
                  <p style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-secondary)', position: 'relative', marginBottom: '10px' }}>
                    R$ {data.receita.toFixed(2)}
                  </p>
                  {/* Progress bar */}
                  <div style={{ height: '4px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '2px', transition: 'width 0.5s ease', opacity: data.qtd > 0 ? 0.7 : 0 }} />
                  </div>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginTop: '4px', position: 'relative' }}>
                    {data.qtd > 0 ? `${pct}% do total` : '—'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Analytics Row ── */}
        <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>

          {/* Status Distribution */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-surface)', padding: '22px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: '16px' }}>
              Distribuição por Status · Hoje
            </p>
            {sortedStatusDist.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Sem dados</p>
            ) : (
              <>
                <div style={{ height: '8px', borderRadius: '4px', overflow: 'hidden', display: 'flex', marginBottom: '18px', background: 'var(--bg-surface-3)' }}>
                  {sortedStatusDist.map((s) => (
                    <div
                      key={s.status}
                      title={`${STATUS_LABELS[s.status] ?? s.status}: ${s.count}`}
                      style={{
                        width: `${Math.round((s.count / statusDistTotal) * 100)}%`,
                        background: STATUS_COLORS[s.status] ?? '#555',
                        height: '100%',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sortedStatusDist.map((s) => {
                    const pct = Math.round((s.count / statusDistTotal) * 100);
                    return (
                      <div key={s.status}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <span className={`status-badge status-${s.status}`}>
                            <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                            {STATUS_LABELS[s.status] ?? s.status}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>
                            {s.count} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span>
                          </span>
                        </div>
                        <div style={{ height: '5px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: STATUS_COLORS[s.status] ?? '#555', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* By Bairro */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-surface)', padding: '22px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: '16px' }}>
              Pedidos por Bairro · Hoje
            </p>
            {byBairro.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Sem dados</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {byBairro.map((b, i) => {
                  const pct = Math.round((b.count / maxBairroCount) * 100);
                  const opacity = i === 0 ? 1 : Math.max(0.35, 1 - i * 0.09);
                  return (
                    <div key={b.bairro}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: i === 0 ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', width: '16px', textAlign: 'right', flexShrink: 0 }}>
                            {i + 1}
                          </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '155px' }}>{b.bairro}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>{b.count}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>R${b.total.toFixed(0)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <div style={{ width: '24px', flexShrink: 0 }} />
                        <div style={{ flex: 1, height: '4px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', opacity, borderRadius: '2px' }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── By Entregador ── */}
        {byEntregador.length > 0 && (
          <div className="fade-up-3" style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>
                Desempenho por Entregador · Hoje
              </p>
              <Link href="/entregadores" className="link-accent" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', padding: '3px 10px', borderRadius: '3px', background: 'var(--accent-dim)', color: 'var(--accent)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', textDecoration: 'none', transition: 'all 0.2s ease' }}>
                VER TODOS <ArrowRight size={12} />
              </Link>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Entregador', 'Em Rota', 'Entregues', 'Tempo Médio', 'Carga'].map((h) => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 18px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byEntregador.map((e) => (
                    <tr key={e.nome} className="orders-row" style={{ background: 'var(--bg-surface)' }}>
                      <td style={{ padding: '12px 18px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Users size={12} style={{ color: 'var(--text-muted)' }} />
                          {e.nome}
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: e.emAberto > 0 ? 'var(--accent)' : 'var(--text-muted)', fontWeight: e.emAberto > 0 ? 700 : 400 }}>
                        {e.emAberto}
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: '#047857', fontWeight: 700 }}>
                        {e.entreguesHoje}
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: 'var(--text-secondary)' }}>
                        {e.tempoMedio > 0 ? `${Math.round(e.tempoMedio)} min` : '—'}
                      </td>
                      <td style={{ padding: '12px 18px', width: '120px' }}>
                        <div style={{ height: '5px', background: 'var(--bg-surface-3)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.round((e.emAberto / maxEntregadorAberto) * 100)}%`, background: 'var(--accent)', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Orders Table ── */}
        <div className="fade-up-4">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>
              Pedidos Recentes
            </h2>
            <Link href="/pedidos" className="link-accent" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', padding: '3px 10px', borderRadius: '3px', background: 'var(--accent-dim)', color: 'var(--accent)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', textDecoration: 'none', transition: 'all 0.2s ease' }}>
              VER TODOS <ArrowRight size={12} />
            </Link>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border)' }}>
                  {['#', 'Produtos', 'Entregador', 'Criado', 'Concluído', 'Total', 'Status'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
                      Nenhum pedido encontrado
                    </td>
                  </tr>
                ) : (
                  pedidos.map((p) => {
                    const produtosStr = Array.isArray(p.produtos)
                      ? p.produtos.map((pr) => `${pr.qtd}× ${pr.produto}`).join(', ')
                      : '—';
                    const isActive = ACTIVE_STATUSES.has(p.status);
                    const rowUrgency = urgencyRowStyle(p);
                    const conclusaoTime = fmtHHMM(p.entregue_em ?? p.cancelado_em ?? null);
                    return (
                      <tr key={p.id} className="orders-row" style={{ background: rowUrgency.background ?? 'var(--bg-surface)', ...rowUrgency }}>
                        <td style={{ padding: '11px 14px', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--accent)', borderLeft: `3px solid ${STATUS_COLORS[p.status] ?? '#333'}` }}>#{p.id}</td>
                        <td style={{ padding: '11px 14px', fontSize: '12px', color: 'var(--text-primary)', maxWidth: '200px' }}>
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{produtosStr}</span>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {p.entregador_nome ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: '11px', fontFamily: 'var(--font-space-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {fmtHHMM(p.created_at)}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: '11px', fontFamily: 'var(--font-space-mono)', whiteSpace: 'nowrap' }}>
                          {isActive ? (
                            <span style={{ color: 'var(--text-muted)' }}>em aberto</span>
                          ) : (
                            <span style={{ color: p.status === 'entregue' ? '#047857' : '#c81e1e', fontWeight: 600 }}>
                              {conclusaoTime}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                          R$ {parseFloat(p.total).toFixed(2)}
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          <span className={`status-badge status-${p.status}`}>
                            <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                            {STATUS_LABELS[p.status] ?? p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="fade-up-5" style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
            TeleGás Ops · Atualização automática a cada 30s
          </p>
        </footer>
      </main>

      {/* ── Right: Conversas ao Vivo ── */}
      <aside style={{
        width: '300px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        height: '100vh',
        borderLeft: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Panel Header */}
        <div style={{
          padding: '24px 20px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-surface-2)',
          flexShrink: 0,
        }}>
          <p style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '4px' }}>
            Ao Vivo · 30 min
          </p>
          <h2 style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
            Conversas
          </h2>
        </div>

        <ConversasPanel />
      </aside>

    </div>
  );
}
