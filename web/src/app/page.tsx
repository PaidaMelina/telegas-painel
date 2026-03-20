import { api } from '@/lib/api';
import { Flame, Package, CheckCircle2, Truck, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const revalidate = 30;

const STATUS_LABELS: Record<string, string> = {
  atribuido: 'Atribuído',
  saiu_para_entrega: 'Em Rota',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

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
  let apiError = false;

  const [summaryResult, pedidosResult] = await Promise.allSettled([
    api.getDashboardSummary(),
    api.getPedidos({ limit: '20' }),
  ]);

  if (summaryResult.status === 'fulfilled') {
    summary = summaryResult.value;
  } else {
    apiError = true;
  }

  if (pedidosResult.status === 'fulfilled') {
    pedidos = pedidosResult.value.data ?? [];
  }

  const taxaConclusao =
    summary.hoje.total > 0
      ? Math.round((summary.hoje.entregues / summary.hoje.total) * 100)
      : null;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '40px 32px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '48px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
            <Flame
              size={30}
              strokeWidth={1.5}
              style={{ color: 'var(--accent)', flexShrink: 0 }}
            />
            <h1
              style={{
                fontSize: '52px',
                fontWeight: 900,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--text-primary)',
                lineHeight: 1,
                fontFamily: 'var(--font-barlow)',
              }}
            >
              TeleGás
            </h1>
          </div>
          <p
            style={{
              fontSize: '11px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-space-mono)',
              marginLeft: '42px',
            }}
          >
            Painel de Operações
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginBottom: '6px' }}>
            <span className="live-dot" />
            <span
              style={{
                fontSize: '10px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                fontFamily: 'var(--font-space-mono)',
              }}
            >
              Ao Vivo
            </span>
          </div>
          <p
            style={{
              fontSize: '28px',
              fontWeight: 700,
              fontFamily: 'var(--font-space-mono)',
              color: 'var(--text-primary)',
              lineHeight: 1,
            }}
          >
            {timeStr}
          </p>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', textTransform: 'capitalize' }}>
            {dateStr}
          </p>
        </div>
      </header>

      {/* ── Error Banner ── */}
      {apiError && (
        <div
          className="fade-up-1"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '14px 18px',
            borderRadius: '6px',
            border: '1px solid rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.07)',
            color: '#f87171',
            marginBottom: '32px',
            fontSize: '13px',
          }}
        >
          <AlertTriangle size={15} strokeWidth={2} />
          <span>Backend inacessível. Verifique se o serviço está rodando na porta 3333 e o banco conectado.</span>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div
        className="fade-up-1"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '48px' }}
      >
        {/* Pedidos Hoje */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p
              style={{
                fontSize: '10px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-space-mono)',
              }}
            >
              Pedidos Hoje
            </p>
            <Package size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p
            style={{
              fontSize: '72px',
              fontWeight: 900,
              lineHeight: 1,
              fontFamily: 'var(--font-barlow)',
              color: 'var(--text-primary)',
            }}
          >
            {summary.hoje.total}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>
            pedidos recebidos
          </p>
        </div>

        {/* Entregues */}
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p
              style={{
                fontSize: '10px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-space-mono)',
              }}
            >
              Entregues Hoje
            </p>
            <CheckCircle2 size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p
            style={{
              fontSize: '72px',
              fontWeight: 900,
              lineHeight: 1,
              fontFamily: 'var(--font-barlow)',
              color: '#34d399',
            }}
          >
            {summary.hoje.entregues}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>
            {taxaConclusao !== null ? `${taxaConclusao}% de conclusão` : 'sem pedidos hoje'}
          </p>
        </div>

        {/* Em Aberto */}
        <div className={`kpi-card${summary.emAberto > 0 ? ' kpi-card-accent' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p
              style={{
                fontSize: '10px',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-space-mono)',
              }}
            >
              Em Aberto
            </p>
            <Truck size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p
            style={{
              fontSize: '72px',
              fontWeight: 900,
              lineHeight: 1,
              fontFamily: 'var(--font-barlow)',
              color: summary.emAberto > 0 ? 'var(--accent)' : 'var(--text-primary)',
            }}
          >
            {summary.emAberto}
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>
            aguardando entrega
          </p>
        </div>
      </div>

      {/* ── Orders Table ── */}
      <div className="fade-up-2">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <h2
              style={{
                fontSize: '10px',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-space-mono)',
              }}
            >
              Pedidos Recentes
            </h2>
            <Link 
              href="/pedidos"
              className="link-accent"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '10px',
                padding: '3px 10px',
                borderRadius: '3px',
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                fontFamily: 'var(--font-space-mono)',
                letterSpacing: '0.06em',
                textDecoration: 'none',
                transition: 'all 0.2s ease'
              }}
            >
              VER TODOS <ArrowRight size={12} />
            </Link>
          </div>

        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: '8px',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Produtos', 'Endereço', 'Total', 'Status'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '12px 20px',
                      fontSize: '10px',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-space-mono)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pedidos.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: 'center',
                      padding: '48px',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                      fontFamily: 'var(--font-space-mono)',
                    }}
                  >
                    Nenhum pedido encontrado
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => {
                  const produtosStr = Array.isArray(p.produtos)
                    ? p.produtos.map((pr) => `${pr.qtd}× ${pr.produto}`).join(', ')
                    : '—';

                  return (
                    <tr
                      key={p.id}
                      className="orders-row"
                      style={{ background: 'var(--bg-surface)' }}
                    >
                      <td
                        style={{
                          padding: '14px 20px',
                          fontSize: '13px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-space-mono)',
                          color: 'var(--accent)',
                        }}
                      >
                        #{p.id}
                      </td>
                      <td
                        style={{
                          padding: '14px 20px',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          maxWidth: '260px',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {produtosStr}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '14px 20px',
                          fontSize: '13px',
                          color: 'var(--text-secondary)',
                          maxWidth: '200px',
                        }}
                      >
                        <span
                          style={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.endereco}
                          {p.bairro ? ` — ${p.bairro}` : ''}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: '14px 20px',
                          fontSize: '13px',
                          fontWeight: 700,
                          fontFamily: 'var(--font-space-mono)',
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        R$ {parseFloat(p.total).toFixed(2)}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className={`status-badge status-${p.status}`}>
                          <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor">
                            <circle cx="2.5" cy="2.5" r="2.5" />
                          </svg>
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
        <p
          style={{
            fontSize: '10px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-space-mono)',
          }}
        >
          TeleGás Ops · Atualização automática a cada 30s
        </p>
      </footer>
    </main>
  );
}
