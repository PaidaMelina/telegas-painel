'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { MapPin, TrendingUp, Package, DollarSign, RefreshCw } from 'lucide-react';

const MapaCalor = dynamic(() => import('@/components/MapaCalor'), { ssr: false });

interface BairroDado {
  bairro: string;
  count: number;
  total: number;
}

const PERIODOS = [
  { id: 'hoje',   label: 'Hoje' },
  { id: 'semana', label: '7 dias' },
  { id: 'mes',    label: '30 dias' },
  { id: 'total',  label: 'Total' },
];

/* bairros conhecidos no mapa */
const COORDS_KEYS = [
  'centro','são marcos','jardim','parque','bairro novo',
  'lacerdinha','são cristóvão','ponche verde','vila nova','progresso','aparecida','cohab',
];
function isOnMap(bairro: string): boolean {
  const b = bairro.toLowerCase().trim();
  return COORDS_KEYS.some(k => k === b || b.includes(k) || k.includes(b));
}

export default function MapaPage() {
  const [dados, setDados]     = useState<BairroDado[]>([]);
  const [periodo, setPeriodo] = useState('hoje');
  const [loading, setLoading] = useState(true);
  const [mapKey, setMapKey]   = useState(0); // force remount on period change

  async function load(p: string) {
    setLoading(true);
    try {
      const d = await api.getDashboardByBairro(p);
      setDados(d);
      setMapKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(periodo); }, [periodo]);

  const totalPedidos  = dados.reduce((s, d) => s + d.count, 0);
  const totalReceita  = dados.reduce((s, d) => s + d.total, 0);
  const topBairro     = dados[0];
  const naoMapeados   = dados.filter(d => !isOnMap(d.bairro));
  const maxCount      = Math.max(...dados.map(d => d.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* Header */}
      <div style={{
        padding: '24px 28px 0',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <MapPin size={18} style={{ color: 'var(--accent)' }} strokeWidth={1.5} />
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Mapa de Calor
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            Densidade de pedidos por bairro em Jaguarão
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {PERIODOS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                border: `1px solid ${periodo === p.id ? 'var(--accent)' : 'var(--border)'}`,
                background: periodo === p.id ? 'var(--accent-dim)' : 'var(--bg-surface)',
                color: periodo === p.id ? 'var(--accent)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-space-mono)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                letterSpacing: '0.04em',
                transition: 'all 0.15s',
              }}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => load(periodo)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={13} strokeWidth={1.5} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        padding: '16px 28px',
      }}>
        {[
          { icon: Package,     label: 'Total de Pedidos',  value: totalPedidos.toString(),         color: 'var(--accent)' },
          { icon: DollarSign,  label: 'Receita no Período', value: `R$ ${totalReceita.toFixed(0)}`, color: 'var(--green)' },
          { icon: TrendingUp,  label: 'Bairro Top',         value: topBairro?.bairro ?? '—',        color: 'var(--amber)' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="kpi-card" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon size={14} style={{ color }} strokeWidth={1.5} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Map + Sidebar */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 260px',
        gap: 12,
        padding: '0 28px 24px',
        minHeight: 0,
      }}>

        {/* Map */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(240,244,248,0.7)',
              backdropFilter: 'blur(2px)',
            }}>
              <div style={{ fontFamily: 'var(--font-space-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
                Carregando...
              </div>
            </div>
          )}
          <MapaCalor key={mapKey} dados={dados} />
        </div>

        {/* Sidebar ranking */}
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflowY: 'auto',
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            fontFamily: 'var(--font-space-mono)',
            marginBottom: 4,
          }}>
            Ranking por Bairro
          </div>

          {dados.length === 0 && !loading && (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>
              Sem dados nesse período
            </div>
          )}

          {dados.map((d, i) => {
            const ratio = d.count / maxCount;
            const barColor = ratio >= 0.75 ? '#ef4444' : ratio >= 0.5 ? '#f59e0b' : ratio >= 0.25 ? '#06b6d4' : '#2557e7';
            return (
              <div key={d.bairro} style={{
                padding: '10px 12px',
                background: i === 0 ? 'var(--accent-dim)' : 'var(--bg-surface-2)',
                borderRadius: 8,
                border: `1px solid ${i === 0 ? 'var(--accent-glow)' : 'var(--border-subtle)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontFamily: 'var(--font-space-mono)',
                      fontSize: 10,
                      color: i === 0 ? 'var(--accent)' : 'var(--text-muted)',
                      fontWeight: 700,
                      minWidth: 16,
                    }}>
                      #{i + 1}
                    </span>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 120,
                    }}>
                      {d.bairro}
                    </span>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-space-mono)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: barColor,
                  }}>
                    {d.count}
                  </span>
                </div>
                <div style={{ background: 'var(--bg-surface-3)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${ratio * 100}%`,
                    background: barColor,
                    borderRadius: 4,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'var(--font-space-mono)' }}>
                  R$ {d.total.toFixed(0)}
                </div>
              </div>
            );
          })}

          {naoMapeados.length > 0 && (
            <div style={{
              marginTop: 8,
              padding: '8px 10px',
              background: 'var(--bg-surface-3)',
              borderRadius: 8,
              border: '1px dashed var(--border)',
            }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: 4 }}>
                Sem coordenadas no mapa:
              </div>
              {naoMapeados.map(d => (
                <div key={d.bairro} style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                  {d.bairro} <span style={{ color: 'var(--text-muted)' }}>({d.count})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .mapa-tooltip .leaflet-tooltip {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(13,20,36,0.12);
          padding: 8px 12px;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
