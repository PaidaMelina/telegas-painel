'use client';

import { useEffect, useRef, useState } from 'react';
import { buscarEnderecos, type SugestaoEndereco } from '@/lib/enderecos';

interface Props {
  value: string;
  onChange: (valor: string) => void;
  /** Chamado quando o usuário escolhe uma sugestão da lista. */
  onSelect: (sugestao: SugestaoEndereco) => void;
  placeholder?: string;
  autoFocus?: boolean;
  inputStyle?: React.CSSProperties;
  /** Rótulo acessível quando não houver <label> associado. */
  ariaLabel?: string;
}

/**
 * Campo de endereço com sugestões do OpenStreetMap.
 *
 * Usado na Portaria e no cadastro de clientes — as duas telas que capturam
 * endereço. A busca só dispara depois que a digitação para, para não gerar
 * uma requisição por tecla.
 */
export default function BuscaEndereco({
  value,
  onChange,
  onSelect,
  placeholder = 'Digite a rua...',
  autoFocus,
  inputStyle,
  ariaLabel,
}: Props) {
  const [sugestoes, setSugestoes] = useState<SugestaoEndereco[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function handleChange(valor: string) {
    onChange(valor);
    if (timer.current) clearTimeout(timer.current);
    if (valor.trim().length < 3) {
      setSugestoes([]);
      setAberto(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await buscarEnderecos(valor);
        setSugestoes(res);
        setAberto(res.length > 0);
      } catch {
        setSugestoes([]);
      } finally {
        setBuscando(false);
      }
    }, 400);
  }

  function escolher(s: SugestaoEndereco) {
    onSelect(s);
    setSugestoes([]);
    setAberto(false);
  }

  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (sugestoes.length > 0) setAberto(true); }}
        // O atraso deixa o clique na sugestão acontecer antes do fechamento.
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        onKeyDown={e => { if (e.key === 'Escape') setAberto(false); }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-label={ariaLabel}
        style={inputStyle}
      />

      {buscando && (
        <span style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)',
          pointerEvents: 'none',
        }}>
          buscando…
        </span>
      )}

      {aberto && sugestoes.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
          margin: '4px 0 0', padding: 4, listStyle: 'none',
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 12px 32px rgba(13,20,36,0.16)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {sugestoes.map((s, i) => (
            <li key={`${s.lat}-${s.lng}-${i}`}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); escolher(s); }}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '8px 10px', borderRadius: 6,
                  border: 'none', background: 'none',
                  fontSize: 12.5, color: 'var(--text-primary)',
                  fontFamily: 'var(--font-barlow)', lineHeight: 1.4,
                }}
                onMouseOver={e => (e.currentTarget.style.background = 'var(--bg-surface-3)')}
                onMouseOut={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontWeight: 700 }}>
                  {s.rua}{s.numero && `, ${s.numero}`}
                </span>
                <span style={{
                  display: 'block', fontSize: 11, fontFamily: 'var(--font-space-mono)',
                  color: s.uruguai ? '#9a3412' : 'var(--text-muted)',
                }}>
                  {[s.bairro, s.cidade].filter(Boolean).join(' · ') || 'sem bairro'}
                  {s.uruguai && ' · 🇺🇾 Uruguai'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
