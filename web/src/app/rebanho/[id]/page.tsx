'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { rebanhoApi, AnimalDetalhe } from '@/lib/rebanho-client';
import { ArrowLeft, Plus, X } from 'lucide-react';

/* ── SVG weight evolution chart (same approach as relatorios/page.tsx) ── */
function PesoChart({ pesagens }: { pesagens: AnimalDetalhe['pesagens'] }) {
  const W = 800, H = 220, PL = 8, PR = 8, PT = 16, PB = 24;

  if (pesagens.length === 0) {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
        <text x={W / 2} y={H / 2} textAnchor="middle" fill="rgba(74,85,104,0.4)" fontSize="13" fontFamily="monospace">
          Sem pesagens registradas
        </text>
      </svg>
    );
  }

  const vals = pesagens.map(p => p.peso);
  const min = Math.min(...vals);
  const max = Math.max(...vals, min + 1);

  const xOf = (i: number) => PL + (i / Math.max(pesagens.length - 1, 1)) * (W - PL - PR);
  const yOf = (v: number) => PT + (1 - (v - min) / (max - min)) * (H - PT - PB);
  const pts = pesagens.map((p, i) => `${xOf(i)},${yOf(p.peso)}`).join(' L ');
  const areaD = `M ${pts} L ${xOf(pesagens.length - 1)},${H - PB} L ${xOf(0)},${H - PB} Z`;
  const color = '#22c55e';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="grad-peso" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map(p => (
        <line key={p} x1={PL} x2={W - PR}
          y1={PT + (1 - p) * (H - PT - PB)} y2={PT + (1 - p) * (H - PT - PB)}
          stroke="rgba(13,20,36,0.06)" strokeWidth="1" />
      ))}
      <path d={areaD} fill="url(#grad-peso)" />
      <path d={`M ${pts}`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pesagens.map((p, i) => (
        <circle key={p.id} cx={xOf(i)} cy={yOf(p.peso)} r="3" fill={color} />
      ))}
      {pesagens.map((p, i) => {
        if (pesagens.length > 10 && i % Math.ceil(pesagens.length / 10) !== 0) return null;
        const label = new Date(p.dataPesagem).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return (
          <text key={p.id} x={xOf(i)} y={H - 4} textAnchor="middle" fill="rgba(13,20,36,0.3)" fontSize="9" fontFamily="monospace">
            {label}
          </text>
        );
      })}
    </svg>
  );
}

export default function AnimalDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [animal, setAnimal] = useState<AnimalDetalhe | null>(null);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [peso, setPeso] = useState('');
  const [observacao, setObservacao] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const reload = useCallback(() => {
    rebanhoApi.getAnimal(Number(id)).then(setAnimal).catch(console.error);
  }, [id]);

  useEffect(() => {
    reload();
    setLoading(false);
  }, [reload]);

  async function handleSave() {
    const pesoNum = Number(peso);
    if (!pesoNum || pesoNum <= 0) {
      setFormError('Informe um peso válido.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await rebanhoApi.lancarPesoAdmin(Number(id), pesoNum, observacao.trim() || undefined);
      setDrawerOpen(false);
      setPeso('');
      setObservacao('');
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '6px',
    border: '1px solid var(--border)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'var(--font-barlow)',
    outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: '10px', letterSpacing: '0.14em', textTransform: 'uppercase',
    color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px', display: 'block',
  };

  if (loading || !animal) {
    return (
      <main style={{ padding: '32px 28px' }}>
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
          Carregando...
        </div>
      </main>
    );
  }

  const ultimoPeso = animal.pesagens.length ? animal.pesagens[animal.pesagens.length - 1].peso : null;
  const variacao = ultimoPeso != null && animal.pesoInicial != null ? ultimoPeso - animal.pesoInicial : null;

  return (
    <main className="min-h-screen relative z-10" style={{ padding: '32px 28px', width: '100%' }}>
      <button onClick={() => router.push('/rebanho')} style={{
        display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
        letterSpacing: '0.06em', marginBottom: '20px', padding: 0,
      }}>
        <ArrowLeft size={13} /> Voltar
      </button>

      <header className="fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginBottom: '6px' }}>
            {animal.categoria || 'Animal'}
          </p>
          <h1 style={{ fontSize: '30px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-barlow)', lineHeight: 1 }}>
            Brinco #{animal.brinco}
          </h1>
        </div>
        <button onClick={() => { setDrawerOpen(true); setFormError(''); }} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '7px 16px', borderRadius: '4px', border: 'none', cursor: 'pointer',
          background: 'var(--accent)', color: '#fff',
          fontSize: '11px', fontWeight: 700, fontFamily: 'var(--font-space-mono)',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>
          <Plus size={13} strokeWidth={2.5} /> Lançar peso
        </button>
      </header>

      {/* ── KPI Strip ── */}
      <div className="fade-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
        <div className="kpi-card" style={{ borderTop: '2px solid var(--accent)', padding: '20px 24px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: '12px' }}>Peso Atual</p>
          <p style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)' }}>{ultimoPeso != null ? `${ultimoPeso} kg` : '—'}</p>
        </div>
        <div className="kpi-card" style={{ borderTop: '2px solid var(--border)', padding: '20px 24px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: '12px' }}>Peso Inicial</p>
          <p style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)' }}>{animal.pesoInicial != null ? `${animal.pesoInicial} kg` : '—'}</p>
        </div>
        <div className="kpi-card" style={{ borderTop: `2px solid ${variacao == null ? 'var(--border)' : variacao >= 0 ? '#047857' : '#c81e1e'}`, padding: '20px 24px' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: '12px' }}>Variação</p>
          <p style={{ fontSize: '36px', fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-barlow)', color: variacao == null ? 'var(--text-primary)' : variacao >= 0 ? '#047857' : '#c81e1e' }}>
            {variacao == null ? '—' : `${variacao >= 0 ? '+' : ''}${variacao.toFixed(1)} kg`}
          </p>
        </div>
      </div>

      {/* ── Chart ── */}
      <div className="kpi-card fade-up-2" style={{ padding: '20px 24px', marginBottom: '28px', height: '260px' }}>
        <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)', marginBottom: '12px' }}>
          Evolução de peso
        </p>
        <PesoChart pesagens={animal.pesagens} />
      </div>

      {/* ── History table ── */}
      <div className="kpi-card fade-up-2" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: '10px', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>
            Histórico de pesagens
          </p>
        </div>
        {animal.pesagens.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'var(--font-space-mono)' }}>
            Nenhuma pesagem registrada.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[...animal.pesagens].reverse().map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '12px 24px', fontSize: '12px', fontFamily: 'var(--font-space-mono)', color: 'var(--text-secondary)' }}>
                    {new Date(p.dataPesagem).toLocaleDateString('pt-BR')}
                  </td>
                  <td style={{ padding: '12px 24px', fontSize: '14px', fontWeight: 700, fontFamily: 'var(--font-barlow)' }}>
                    {p.peso} kg
                  </td>
                  <td style={{ padding: '12px 24px', fontSize: '12px', fontFamily: 'var(--font-space-mono)', color: 'var(--text-muted)' }}>
                    {p.funcionarioNome || '—'}
                  </td>
                  <td style={{ padding: '12px 24px', fontSize: '12px', fontFamily: 'var(--font-space-mono)', color: 'var(--text-muted)' }}>
                    {p.observacao || ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Backdrop ── */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,20,36,0.45)', zIndex: 40, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* ── Lançar peso Drawer ── */}
      {drawerOpen && (
        <div style={{
          position: 'fixed', top: 0, right: 0, width: '360px', height: '100vh',
          background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)',
          zIndex: 50, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: '20px',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 800, fontFamily: 'var(--font-barlow)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Lançar peso
            </h2>
            <button onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
              <X size={18} />
            </button>
          </div>

          <div>
            <label style={labelStyle}>Peso em kg</label>
            <input type="number" style={inputStyle} value={peso} onChange={e => setPeso(e.target.value)} placeholder="Ex: 210" autoFocus />
          </div>

          <div>
            <label style={labelStyle}>Observação (opcional)</label>
            <input style={inputStyle} value={observacao} onChange={e => setObservacao(e.target.value)} />
          </div>

          {formError && (
            <p style={{ fontSize: '12px', color: '#c81e1e', fontFamily: 'var(--font-space-mono)', background: '#fff1f1', padding: '10px 12px', borderRadius: '4px', border: '1px solid #fecaca' }}>
              {formError}
            </p>
          )}

          <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
            <button onClick={() => setDrawerOpen(false)} style={{
              flex: 1, padding: '11px', borderRadius: '6px', cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg-surface)',
              color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 700,
              fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving} style={{
              flex: 2, padding: '11px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer',
              border: 'none', background: saving ? '#93c5fd' : 'var(--accent)', color: '#fff',
              fontSize: '12px', fontWeight: 700, fontFamily: 'var(--font-space-mono)', textTransform: 'uppercase',
            }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
