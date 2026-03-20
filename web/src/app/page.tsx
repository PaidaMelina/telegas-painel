import { api } from '@/lib/api';
import { Flame, Package, CheckCircle2, Truck, AlertTriangle, ArrowRight, TrendingUp, Clock, Users } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 30;

const STATUS_LABELS: Record<string, string> = {
  atribuido: 'Atribuído',
  saiu_para_entrega: 'Em Rota',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
  novo: 'Novo',
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

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '40px 32px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '48px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <Flame size={30} strokeWidth={1.5} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <h1 style={{ fontSize: '52px', fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-primary)', lineHeight: 1, fontFamily: 'var(--font-barlow)' }}>
              TeleGás
            </h1>
          </div>
          <p style={{ fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginLeft: '42px' }}>
            Painel de Operações
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '6px' }}>
            <span className="live-dot" />
            <span style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'var(--font-space-mono)' }}>
              Ao Vivo
            </span>
          </div>
          <p style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)', lineHeight: 1 }}>
            {timeStr}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'capitalize' }}>
            {dateStr}
          </p>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {apiError && (
        <div className="fade-up-1" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.07)', color: '#f87171', marginBottom: '32px', fontSize: '13px' }}>
          <AlertTriangle size={15} strokeWidth={2} />
          <span>Backend inacessível. Verifique se o serviço está rodando na porta 3333 e o banco conectado.</span>
        </div>
      )}

      {/* ── KPI Cards Row 1 ── */}
      <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Pedidos Hoje</p>
            <Package size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>
            {summary.hoje.total}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>pedidos recebidos</p>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Entregues Hoje</p>
            <CheckCircle2 size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#34d399' }}>
            {summary.hoje.entregues}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>
            {taxaConclusao !== null ? `${taxaConclusao}% de conclusão` : 'sem pedidos hoje'}
          </p>
        </div>

        <div className={`kpi-card${summary.emAberto > 0 ? ' kpi-card-accent' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Em Aberto</p>
            <Truck size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: summary.emAberto > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
            {summary.emAberto}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>aguardando entrega</p>
        </div>
      </div>

      {/* ── KPI Cards Row 2 ── */}
      <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '48px' }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Ticket Médio</p>
            <TrendingUp size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>
            R$ {metrics.ticketMedio.toFixed(0)}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>valor médio por pedido</p>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Tempo de Entrega</p>
            <Clock size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>
            {metrics.tempoMedioEntrega > 0 ? `${Math.round(metrics.tempoMedioEntrega)}min` : '—'}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>média atribuição → entregue</p>
        </div>

        <div className={`kpi-card${metrics.pedidosAtrasados > 0 ? ' kpi-card-accent' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Atrasados</p>
            <AlertTriangle size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '48px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: metrics.pedidosAtrasados > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>
            {metrics.pedidosAtrasados}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>em aberto há mais de 60min</p>
        </div>
      </div>

      {/* ── Analytics Row ── */}
      <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '48px' }}>

        {/* Status Distribution */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-surface)', padding: '24px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: '20px' }}>
            Distribuição por Status · Hoje
          </p>
          {sortedStatusDist.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Sem dados</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    <div style={{ height: '3px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* By Bairro */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-surface)', padding: '24px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: '20px' }}>
            Pedidos por Bairro · Hoje
          </p>
          {byBairro.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Sem dados</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {byBairro.map((b) => {
                const pct = Math.round((b.count / maxBairroCount) * 100);
                return (
                  <div key={b.bairro}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{b.bairro}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', flexShrink: 0, marginLeft: '8px' }}>{b.count}</span>
                    </div>
                    <div style={{ height: '3px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', opacity: 0.7, borderRadius: '2px' }} />
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
        <div className="fade-up-3" style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
                  {['Entregador', 'Em Aberto', 'Entregues Hoje', 'Tempo Médio'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byEntregador.map((e) => (
                  <tr key={e.nome} className="orders-row" style={{ background: 'var(--bg-surface)' }}>
                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={13} style={{ color: 'var(--text-muted)' }} />
                      {e.nome}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: e.emAberto > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {e.emAberto}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: '#34d399' }}>
                      {e.entreguesHoje}
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: 'var(--text-secondary)' }}>
                      {e.tempoMedio > 0 ? `${Math.round(e.tempoMedio)} min` : '—'}
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
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
                  <th key={h} style={{ textAlign: 'left', padding: '12px 20px', fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
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
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--accent)' }}>#{p.id}</td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-primary)', maxWidth: '260px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{produtosStr}</span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.endereco}{p.bairro ? ` — ${p.bairro}` : ''}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        R$ {parseFloat(p.total).toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
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
      <footer className="fade-up-5" style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
          TeleGás Ops · Atualização automática a cada 30s
        </p>
      </footer>
    </main>
  );
}
