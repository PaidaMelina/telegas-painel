'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { ArrowLeft, Users, CheckCircle2, Truck, Clock } from 'lucide-react';
import Link from 'next/link';

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

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '40px 32px', maxWidth: '1280px', margin: '0 auto' }}>

      {/* ── Header ── */}
      <header className="fade-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)', transition: 'all 0.2s ease', textDecoration: 'none' }}>
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} style={{ color: 'var(--accent)' }} />
              <h1 style={{ fontSize: '24px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-barlow)' }}>
                Entregadores
              </h1>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)', marginTop: '4px' }}>
              Equipe de entrega · desempenho hoje
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['todos', 'ativos', 'inativos'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                fontSize: '10px', padding: '6px 14px', borderRadius: '4px',
                background: filter === f ? 'var(--accent)' : 'var(--bg-surface)',
                color: filter === f ? 'var(--bg-base)' : 'var(--text-secondary)',
                border: '1px solid', borderColor: filter === f ? 'var(--accent)' : 'var(--border)',
                fontFamily: 'var(--font-space-mono)', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.05em', cursor: 'pointer', transition: 'all 0.2s ease',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </header>

      {/* ── KPI Summary ── */}
      <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '40px' }}>
        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Ativos Agora</p>
            <Users size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: 'var(--text-primary)' }}>{ativos}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>de {entregadores.length} cadastrados</p>
        </div>

        <div className="kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Entregues Hoje</p>
            <CheckCircle2 size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: '#34d399' }}>{totalEntreguesHoje}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>entregas concluídas</p>
        </div>

        <div className={`kpi-card${totalEmAberto > 0 ? ' kpi-card-accent' : ''}`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>Em Rota Agora</p>
            <Truck size={14} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
          </div>
          <p style={{ fontSize: '72px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: totalEmAberto > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>{totalEmAberto}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-space-mono)' }}>pedidos em andamento</p>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="fade-up-2" style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-surface)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border)' }}>
              {['Nome', 'Telefone', 'Status', 'Em Aberto', 'Entregues Hoje', 'Tempo Médio'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '14px 20px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'var(--font-space-mono)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
                  <span className="live-dot" style={{ marginRight: '10px', display: 'inline-block' }} /> Carregando...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
                  Nenhum entregador encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="orders-row" style={{ background: 'var(--bg-surface)' }}>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={13} style={{ color: 'var(--text-muted)' }} />
                      {e.nome}
                    </div>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>
                    {e.telefone.replace(/^55/, '')}
                  </td>
                  <td style={{ padding: '16px 20px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: '5px',
                      padding: '3px 9px', borderRadius: '3px', fontSize: '10px', fontWeight: 700,
                      letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: 'var(--font-space-mono)',
                      background: e.ativo ? 'rgba(16,185,129,0.10)' : 'rgba(102,102,102,0.10)',
                      color: e.ativo ? '#34d399' : 'var(--text-secondary)',
                      border: `1px solid ${e.ativo ? 'rgba(16,185,129,0.22)' : 'rgba(102,102,102,0.22)'}`,
                    }}>
                      <svg width="5" height="5" viewBox="0 0 5 5" fill="currentColor"><circle cx="2.5" cy="2.5" r="2.5" /></svg>
                      {e.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: e.pedidosAbertos > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {e.pedidosAbertos}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: '#34d399', fontWeight: 700 }}>
                    {e.entreguesHoje}
                  </td>
                  <td style={{ padding: '16px 20px', fontSize: '13px', fontFamily: 'var(--font-space-mono)', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} style={{ color: 'var(--text-muted)' }} />
                      {e.tempoMedioEntrega > 0 ? `${Math.round(e.tempoMedioEntrega)} min` : '—'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <footer style={{ marginTop: '48px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
          TeleGás Ops · {entregadores.length} entregadores cadastrados
        </p>
      </footer>
    </main>
  );
}
