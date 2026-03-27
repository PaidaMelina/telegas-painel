'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, Bot, User, RefreshCw, Clock } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';
const POLL_INTERVAL = 15000; // 15 seconds

interface Mensagem {
  type: 'human' | 'ai';
  content: string;
}

interface Conversa {
  sessionId: string;
  lastMessage: Mensagem;
  lastId: number;
  msgsCount: number;
}

interface MensagemDetalhe {
  id: number;
  message: Mensagem;
}

function formatPhone(sessionId: string): string {
  const num = sessionId.replace(/@.*/, '');
  const local = num.startsWith('55') ? num.slice(2) : num;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return local;
}

function truncate(text: string, max = 72): string {
  const clean = text.replace(/\n+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

function ConversaDetail({ conversa, onClose }: { conversa: Conversa; onClose: () => void }) {
  const [msgs, setMsgs] = useState<MensagemDetalhe[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMsgs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/conversas/${encodeURIComponent(conversa.sessionId)}`, { cache: 'no-store' });
      if (res.ok) setMsgs(await res.json());
    } catch {}
    setLoading(false);
  }, [conversa.sessionId]);

  useEffect(() => {
    fetchMsgs();
    const t = setInterval(fetchMsgs, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchMsgs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface-2)', flexShrink: 0 }}>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', fontSize: '14px', borderRadius: '4px', lineHeight: 1 }}
        >
          ←
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>
            {formatPhone(conversa.sessionId)}
          </p>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
            {conversa.msgsCount} mensagens recentes
          </p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-space-mono)' }}>
            Carregando…
          </div>
        ) : msgs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-space-mono)' }}>
            Sem mensagens
          </div>
        ) : (
          msgs.map((m) => {
            const isAI = m.message.type === 'ai';
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: isAI ? 'row' : 'row-reverse', gap: '7px', alignItems: 'flex-end' }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
                  background: isAI ? 'var(--accent-dim)' : 'var(--bg-surface-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isAI
                    ? <Bot size={11} style={{ color: 'var(--accent)' }} />
                    : <User size={11} style={{ color: 'var(--text-muted)' }} />
                  }
                </div>
                <div style={{
                  maxWidth: '80%',
                  padding: '7px 10px',
                  borderRadius: isAI ? '2px 10px 10px 10px' : '10px 2px 10px 10px',
                  background: isAI ? 'var(--accent-dim)' : 'var(--bg-surface-3)',
                  border: `1px solid ${isAI ? 'rgba(37,87,231,0.12)' : 'var(--border)'}`,
                }}>
                  <p style={{ fontSize: '11px', color: 'var(--text-primary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
                    {m.message.content}
                  </p>
                  <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'var(--font-space-mono)', textAlign: isAI ? 'left' : 'right' }}>
                    #{m.id}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function ConversasPanel() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selected, setSelected] = useState<Conversa | null>(null);

  const fetchConversas = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/conversas/ativas`, { cache: 'no-store' });
      if (res.ok) {
        setConversas(await res.json());
        setLastUpdate(new Date());
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversas();
    const t = setInterval(fetchConversas, POLL_INTERVAL);
    return () => clearInterval(t);
  }, [fetchConversas]);

  if (selected) {
    return <ConversaDetail conversa={selected} onClose={() => setSelected(null)} />;
  }

  return (
    <>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <RefreshCw size={20} style={{ color: 'var(--text-muted)', opacity: 0.4, margin: '0 auto 10px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>Carregando…</p>
          </div>
        ) : conversas.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <MessageCircle size={28} style={{ color: 'var(--text-muted)', opacity: 0.25, margin: '0 auto 12px' }} />
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', lineHeight: 1.6 }}>
              Nenhuma conversa<br />recente
            </p>
          </div>
        ) : (
          conversas.map((c, i) => {
            const isAI = c.lastMessage?.type === 'ai';
            const preview = truncate(c.lastMessage?.content ?? '');
            return (
              <button
                key={c.sessionId}
                onClick={() => setSelected(c)}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: i < conversas.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                  display: 'block',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-surface-2)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {/* Phone + msg count */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <User size={13} style={{ color: 'var(--accent)' }} />
                    </div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-space-mono)' }}>
                      {formatPhone(c.sessionId)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                    <Clock size={9} style={{ color: 'var(--text-muted)' }} />
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
                      {c.msgsCount} msgs
                    </span>
                  </div>
                </div>

                {/* Last message preview */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', paddingLeft: '36px' }}>
                  {isAI
                    ? <Bot size={10} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: '2px' }} />
                    : <User size={10} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: '2px' }} />
                  }
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {preview}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', flexShrink: 0, animation: 'sidebar-live-pulse 2.5s ease-in-out infinite' }} />
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)' }}>
          {lastUpdate
            ? `${lastUpdate.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'atualizando…'}
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-space-mono)', marginLeft: 'auto' }}>
          a cada 15s
        </span>
      </div>
    </>
  );
}
