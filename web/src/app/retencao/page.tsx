'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Flame, Phone, MapPin, Gift, Clock, AlertTriangle, TrendingUp, RefreshCw } from 'lucide-react';

/* ── Types ── */
interface Fidelidade {
  progresso: number;
  ciclo: number;
  recompensas: number;
  faltam: number;
}

interface ClienteRetencao {
  id: number;
  nome: string | null;
  telefone: string;
  endereco: string | null;
  bairro: string | null;
  etiquetas: string[];
  totalCompras: number;
  ultimaCompra: string | null;
  mediaDias: number;
  diasDesdeUltima: number;
  ratio: number;
  statusRetencao: 'atrasado' | 'proximo' | 'normal' | 'sem_dados';
  fidelidade: Fidelidade;
}

/* ── Helpers ── */
function formatTel(t: string) {
  const d = t.replace(/\D/g, '').replace(/^55/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return d;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const STATUS_CONFIG = {
  atrasado:  { label: 'Gás acabando', color: '#c81e1e', bg: '#fee2e2', border: '#fca5a5', icon: AlertTriangle },
  proximo:   { label: 'Em breve',     color: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: Clock },
  normal:    { label: 'Normal',       color: '#065f46', bg: '#d1fae5', border: '#6ee7b7', icon: TrendingUp },
  sem_dados: { label: 'Pouco histórico', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: Clock },
} as const;

type Filter = 'todos' | 'atrasado' | 'proximo' | 'normal';

/* ── Cycle Ring SVG ── */
function CycleRing({ ratio, dias, media, size = 68 }: { ratio: number; dias: number; media: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(ratio, 1.5);
  const offset = circ - (pct / 1.5) * circ;
  const color = ratio >= 1.2 ? '#c81e1e' : ratio >= 0.75 ? '#c27803' : '#047857';

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border-subtle)" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 16, fontWeight: 900, color, fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
          {dias}
        </span>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {media > 0 ? `de ${Math.round(media)}` : 'dias'}
        </span>
      </div>
    </div>
  );
}

/* ── Loyalty Dots ── */
function LoyaltyDots({ progresso, ciclo, recompensas }: Fidelidade) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {Array.from({ length: ciclo }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: i < progresso ? '#c27803' : 'var(--border)',
              border: `1.5px solid ${i < progresso ? '#fcd34d' : 'var(--border)'}`,
              transition: 'all 0.3s ease',
              transitionDelay: `${i * 30}ms`,
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
          {progresso}/{ciclo}
        </span>
        {recompensas > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            padding: '1px 7px', borderRadius: 3,
            background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
            fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
            textTransform: 'uppercase',
          }}>
            <Gift size={9} /> {recompensas}x
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function RetencaoPage() {
  const [data, setData] = useState<ClienteRetencao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todos');

  async function load() {
    setLoading(true);
    try {
      setData(await api.getRetencao());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === 'todos' ? data : data.filter(c => c.statusRetencao === filter);

  // KPIs
  const precisam = data.filter(c => c.statusRetencao === 'atrasado').length;
  const proximos = data.filter(c => c.statusRetencao === 'proximo').length;
  const recompensasPendentes = data.filter(c => c.fidelidade.progresso >= c.fidelidade.ciclo - 1).length;
  const cicloMedio = data.length > 0
    ? Math.round(data.filter(c => c.mediaDias > 0).reduce((a, c) => a + c.mediaDias, 0) / (data.filter(c => c.mediaDias > 0).length || 1))
    : 0;

  const FILTERS: { key: Filter; label: string; count: number }[] = [
    { key: 'todos', label: 'Todos', count: data.length },
    { key: 'atrasado', label: 'Precisam de gás', count: precisam },
    { key: 'proximo', label: 'Em breve', count: proximos },
    { key: 'normal', label: 'Normal', count: data.filter(c => c.statusRetencao === 'normal').length },
  ];

  return (
    <main className="min-h-screen" style={{ padding: '32px 28px', width: '100%' }}>

      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 6 }}>
            Inteligência de Vendas
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Flame size={20} style={{ color: '#c27803' }} />
            <h1 style={{ fontSize: 30, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
              Retenção & Fidelidade
            </h1>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: 6 }}>
            ciclo de consumo · programa de pontos
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
          padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)',
          background: 'var(--bg-surface)', cursor: 'pointer', fontSize: 10,
          fontFamily: 'var(--font-space-mono)', fontWeight: 700,
          textTransform: 'uppercase', color: 'var(--text-secondary)',
        }}>
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Atualizar
        </button>
      </header>

      {/* ── KPIs ── */}
      <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="kpi-card" style={{ borderTop: '2px solid #c81e1e', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <AlertTriangle size={13} style={{ color: '#c81e1e' }} />
            <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Gás Acabando</p>
          </div>
          <p style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#c81e1e' }}>{precisam}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>precisam de lembrete</p>
        </div>

        <div className="kpi-card" style={{ borderTop: '2px solid #c27803', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Clock size={13} style={{ color: '#c27803' }} />
            <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Em Breve</p>
          </div>
          <p style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#c27803' }}>{proximos}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>nos próximos dias</p>
        </div>

        <div className="kpi-card" style={{ borderTop: '2px solid #fcd34d', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <Gift size={13} style={{ color: '#92400e' }} />
            <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Quase Prêmio</p>
          </div>
          <p style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#92400e' }}>{recompensasPendentes}</p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>falta 1 para bonificação</p>
        </div>

        <div className="kpi-card" style={{ borderTop: '2px solid var(--border)', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
            <TrendingUp size={13} style={{ color: 'var(--text-muted)' }} />
            <p style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Ciclo Médio</p>
          </div>
          <p style={{ fontSize: 36, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>{cicloMedio}<span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)' }}>d</span></p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-space-mono)' }}>dias entre compras</p>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="fade-up-2" style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
            fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-space-mono)',
            textTransform: 'uppercase', letterSpacing: '0.05em',
            background: filter === f.key ? 'var(--accent)' : 'var(--bg-surface)',
            color: filter === f.key ? '#fff' : 'var(--text-secondary)',
            border: `1px solid ${filter === f.key ? 'var(--accent)' : 'var(--border)'}`,
            transition: 'all 0.15s',
          }}>
            {f.label} <span style={{ opacity: 0.7 }}>({f.count})</span>
          </button>
        ))}
      </div>

      {/* ── Cards Grid ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', fontSize: 13 }}>
          <span className="live-dot" style={{ marginRight: 10, display: 'inline-block' }} /> Calculando ciclos...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', fontSize: 13 }}>
          Nenhum cliente encontrado para este filtro.
        </div>
      ) : (
        <div className="fade-up-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {filtered.map(c => {
            const cfg = STATUS_CONFIG[c.statusRetencao];
            const StatusIcon = cfg.icon;

            return (
              <div key={c.id} className="kpi-card" style={{
                padding: '18px 20px',
                borderLeft: `3px solid ${cfg.border}`,
                borderTop: 'none',
              }}>
                {/* Top: Name + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.nome || 'Sem nome'}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Phone size={10} color="var(--text-muted)" />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{formatTel(c.telefone)}</span>
                    </div>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 9px', borderRadius: 4,
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)',
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                    flexShrink: 0,
                  }}>
                    <StatusIcon size={10} /> {cfg.label}
                  </span>
                </div>

                {/* Middle: Cycle Ring + Info + Loyalty */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  {/* Cycle ring */}
                  <CycleRing
                    ratio={c.ratio}
                    dias={c.diasDesdeUltima}
                    media={c.mediaDias}
                  />

                  {/* Info column */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Stats */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', marginBottom: 10 }}>
                      <div>
                        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Compras</span>
                        <p style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-barlow)', lineHeight: 1, color: 'var(--text-primary)' }}>{c.totalCompras}</p>
                      </div>
                      <div>
                        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Ciclo</span>
                        <p style={{ fontSize: 18, fontWeight: 900, fontFamily: 'var(--font-barlow)', lineHeight: 1, color: 'var(--text-primary)' }}>
                          {c.mediaDias > 0 ? `${Math.round(c.mediaDias)}d` : '—'}
                        </p>
                      </div>
                    </div>

                    {/* Loyalty dots */}
                    <LoyaltyDots {...c.fidelidade} />
                  </div>
                </div>

                {/* Bottom: Address + Last purchase */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
                    <MapPin size={10} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.endereco || c.bairro || '—'}
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', flexShrink: 0, marginLeft: 8 }}>
                    Último: {formatDate(c.ultimaCompra)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <footer style={{ marginTop: 32, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
          TeleGás Ops · {data.length} clientes com histórico · Fidelidade: a cada 10 compras
        </p>
      </footer>
    </main>
  );
}
