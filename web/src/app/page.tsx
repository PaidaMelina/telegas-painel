import { api } from '@/lib/api';
import { Package, CheckCircle2, Truck, AlertTriangle, ArrowRight, TrendingUp, Clock, Users } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 30;

const STATUS_LABELS: Record<string, string> = {
  atribuido: 'Atribuído',
  saiu_para_entrega: 'Em Rota',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  novo: 'Novo',
};

const STATUS_COLORS: Record<string, string> = {
  atribuido: '#fbbf24',
  saiu_para_entrega: '#60a5fa',
  entregue: '#34d399',
  cancelado: '#f87171',
  novo: '#555',
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
}

export default async function DashboardPage() {
  let summary = { hoje: { total: 0, entregues: 0 }, emAberto: 0 };
  let pedidos: Pedido[] = [];
  let metrics = { ticketMedio: 0, tempoMedioAtribuicao: 0, tempoMedioEntrega: 0, pedidosAtrasados: 0 };
  let statusDist: { status: string; count: number }[] = [];
  let byBairro: { bairro: string; count: number; total: number }[] = [];
  let byEntregador: { nome: string; emAberto: number; entreguesHoje: number; tempoMedio: number }[] = [];
  let apiError = false;

  const [summaryResult, pedidosResult, metricsResult, statusDistResult, byBairroResult, byEntregadorResult] =
    await Promise.allSettled([
      api.getDashboardSummary(),
      api.getPedidos({ limit: '20' }),
      api.getDashboardMetrics(),
      api.getDashboardStatusDistribution(),
      api.getDashboardByBairro(),
      api.getDashboardByEntregador(),
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

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '32px 28px', maxWidth: '1160px' }}>

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

        <div className="kpi-card" style={{ borderTop: '2px solid #34d399' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Entregues Hoje</p>
            <CheckCircle2 size={13} style={{ color: '#34d399', opacity: 0.7 }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '64px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#34d399' }}>
            {summary.hoje.entregues}
          </p>
          {taxaConclusao !== null ? (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>taxa de conclusão</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#34d399', fontFamily: 'var(--font-space-mono)' }}>{taxaConclusao}%</span>
              </div>
              <div style={{ height: '4px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${taxaConclusao}%`, background: '#34d399', borderRadius: '2px', transition: 'width 0.6s ease' }} />
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

        <div className={`kpi-card${metrics.pedidosAtrasados > 0 ? ' kpi-card-accent' : ''}`} style={{ borderTop: metrics.pedidosAtrasados > 0 ? '2px solid #f87171' : '2px solid var(--border)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <AlertTriangle size={13} style={{ color: metrics.pedidosAtrasados > 0 ? '#f87171' : 'var(--text-muted)', opacity: 0.8 }} strokeWidth={1.5} />
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Atrasados</p>
          </div>
          <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: metrics.pedidosAtrasados > 0 ? '#f87171' : 'var(--text-primary)' }}>
            {metrics.pedidosAtrasados}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>em aberto há mais de 60min</p>
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
              {/* Stacked overview bar */}
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
                    <td style={{ padding: '12px 18px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: '#34d399', fontWeight: 700 }}>
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
                {['#', 'Produtos', 'Endereço', 'Total', 'Status'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 18px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
                    Nenhum pedido encontrado
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => {
                  const produtosStr = Array.isArray(p.produtos)
                    ? p.produtos.map((pr) => `${pr.qtd}× ${pr.produto}`).join(', ')
                    : '—';
                  return (
                    <tr key={p.id} className="orders-row" style={{ background: 'var(--bg-surface)' }}>
                      <td style={{ padding: '13px 18px', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--accent)', borderLeft: `3px solid ${STATUS_COLORS[p.status] ?? '#333'}` }}>#{p.id}</td>
                      <td style={{ padding: '13px 18px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '240px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{produtosStr}</span>
                      </td>
                      <td style={{ padding: '13px 18px', fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.endereco}{p.bairro ? ` — ${p.bairro}` : ''}
                        </span>
                      </td>
                      <td style={{ padding: '13px 18px', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        R$ {parseFloat(p.total).toFixed(2)}
                      </td>
                      <td style={{ padding: '13px 18px' }}>
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
  );
}
