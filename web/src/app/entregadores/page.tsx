'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Users, CheckCircle2, Truck, Clock } from 'lucide-react';

interface Entregador {
  id: number;
  nome: string;
  telefone: string;
  ativo: boolean;
  created_at: string;
  pedidosAbertos: number;
  entreguesHoje: number;
  tempoMedioEntrega: number;
}

export default function EntregadoresPage() {
  const [entregadores, setEntregadores] = useState<Entregador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos');

  useEffect(() => {
    api.getEntregadores()
      .then((data) => setEntregadores(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = entregadores.filter((e) => {
    if (filter === 'ativos') return e.ativo;
    if (filter === 'inativos') return !e.ativo;
    return true;
  });

  const totalEntreguesHoje = entregadores.reduce((acc, e) => acc + e.entreguesHoje, 0);
  const totalEmAberto = entregadores.reduce((acc, e) => acc + e.pedidosAbertos, 0);
  const ativos = entregadores.filter((e) => e.ativo).length;
  const maxAberto = Math.max(...entregadores.map(e => e.pedidosAbertos), 1);

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '32px 28px', maxWidth: '1160px' }}>

      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px' }}>
            Equipe
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={20} style={{ color: 'var(--accent)' }} />
            <h1 style={{ fontSize: '30px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
              Entregadores
            </h1>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: '6px' }}>
            desempenho individual · hoje
          </p>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
          {(['todos', 'ativos', 'inativos'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: '10px', padding: '6px 14px', borderRadius: '4px',
                background: filter === f ? 'var(--accent)' : 'var(--bg-surface)',
                color: filter === f ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid', borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* ── KPI Strip ── */}
      <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <div className="kpi-card" style={{ borderTop: '2px solid var(--border)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Users size={13} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Ativos Agora</p>
          </div>
          <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>{ativos}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>de {entregadores.length} cadastrados</p>
        </div>

        <div className="kpi-card" style={{ borderTop: '2px solid #047857', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <CheckCircle2 size={13} style={{ color: '#047857', opacity: 0.7 }} strokeWidth={1.5} />
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Entregues Hoje</p>
          </div>
          <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#047857' }}>{totalEntreguesHoje}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>entregas concluídas</p>
        </div>

        <div className={`kpi-card${totalEmAberto > 0 ? ' kpi-card-accent' : ''}`} style={{ borderTop: totalEmAberto > 0 ? '2px solid var(--accent)' : '2px solid var(--border)', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Truck size={13} style={{ color: totalEmAberto > 0 ? 'var(--accent)' : 'var(--text-muted)', opacity: 0.8 }} strokeWidth={1.5} />
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Em Rota Agora</p>
          </div>
          <p style={{ fontSize: '40px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: totalEmAberto > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>{totalEmAberto}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontFamily: 'var(--font-space-mono)' }}>pedidos em andamento</p>
        </div>
      </div>

      {/* ── Entregador Cards ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          <span className="live-dot" style={{ marginRight: '10px', display: 'inline-block' }} /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          Nenhum entregador encontrado.
        </div>
      ) : (
        <div className="fade-up-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filtered.map((e) => {
            const cargaPct = maxAberto > 0 ? Math.round((e.pedidosAbertos / maxAberto) * 100) : 0;
            return (
              <div
                key={e.id}
                className="kpi-card"
                style={{
                  borderTop: e.pedidosAbertos > 0 ? '2px solid var(--accent)' : e.ativo ? '2px solid #047857' : '2px solid var(--border)',
                  padding: '20px',
                }}
              >
                {/* Name row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.06em', lineHeight: 1, marginBottom: '4px' }}>{e.nome}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>{e.telefone.replace(/^55/, '')}</p>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '3px 8px', borderRadius: '3px', fontSize: '9px', fontWeight: 700,
                    letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)',
                    background: e.ativo ? '#d1fae5' : '#f1f5f9',
                    color: e.ativo ? '#065f46' : '#4a5568',
                    border: `1px solid ${e.ativo ? '#6ee7b7' : '#cbd5e1'}`,
                    flexShrink: 0,
                  }}>
                    <svg width="4" height="4" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                    {e.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {/* Stats row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                  <div>
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Entregues</p>
                    <p style={{ fontSize: '26px', fontWeight: 900, color: '#047857', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>{e.entreguesHoje}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Em Rota</p>
                    <p style={{ fontSize: '26px', fontWeight: 900, color: e.pedidosAbertos > 0 ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>{e.pedidosAbertos}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Tempo</p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', lineHeight: 1 }}>
                      {e.tempoMedioEntrega > 0 ? `${Math.round(e.tempoMedioEntrega)}m` : '—'}
                    </p>
                  </div>
                </div>

                {/* Workload bar */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Carga atual</span>
                    <span style={{ fontSize: '9px', color: e.pedidosAbertos > 0 ? 'var(--accent)' : 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', fontWeight: 700 }}>
                      {cargaPct}%
                    </span>
                  </div>
                  <div style={{ height: '4px', background: 'var(--bg-surface-3)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${cargaPct}%`, background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer ── */}
      <footer style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
          TeleGás Ops · {entregadores.length} entregadores cadastrados
        </p>
      </footer>
    </main>
  );
}
