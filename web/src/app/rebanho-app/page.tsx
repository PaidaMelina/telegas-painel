'use client';

import { useState, useEffect, useRef } from 'react';
import { rebanhoApi } from '@/lib/rebanho-client';
import { Beef, LogOut, Search, Check, Download, Loader2 } from 'lucide-react';

interface AnimalBusca {
  id: number;
  brinco: string;
  categoria: string | null;
  pesoAtual: number | null;
  ultimaPesagemEm: string | null;
}

interface Lancamento {
  brinco: string;
  peso: number;
  horario: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
}

export default function RebanhoAppPage() {
  const [token, setToken] = useState<string | null>(() => (typeof window === 'undefined' ? null : localStorage.getItem('rebanho_token')));
  const [nome, setNome] = useState<string | null>(() => (typeof window === 'undefined' ? null : localStorage.getItem('rebanho_nome')));

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw-rebanho.js').catch(() => {});
    }
  }, []);

  if (!token) {
    return <LoginScreen onLogin={(t, n) => { setToken(t); setNome(n); }} />;
  }

  return <PesagemScreen nome={nome} onLogout={() => { rebanhoApi.funcionarioLogout(); setToken(null); setNome(null); }} />;
}

function LoginScreen({ onLogin }: { onLogin: (token: string, nome: string) => void }) {
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await rebanhoApi.funcionarioLogin(telefone, senha);
      onLogin(data.token, data.funcionario.nome);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#0d1a10' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(180,138,73,0.15)' }}>
            <Beef size={30} style={{ color: '#c99a4f' }} />
          </div>
          <h1 className="text-white text-2xl font-black uppercase tracking-wide">Rebanho</h1>
          <p className="text-sm mt-1" style={{ color: '#6b8f6f' }}>Lançamento de peso</p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            value={telefone}
            onChange={e => setTelefone(e.target.value)}
            placeholder="Telefone"
            inputMode="tel"
            className="w-full rounded-xl px-4 py-4 text-lg text-white placeholder-white/30 outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          <input
            value={senha}
            onChange={e => setSenha(e.target.value)}
            placeholder="Senha"
            type="password"
            className="w-full rounded-xl px-4 py-4 text-lg text-white placeholder-white/30 outline-none"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
          />
          {error && <p className="text-sm text-center" style={{ color: '#f87171' }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wide text-white mt-2 disabled:opacity-60"
            style={{ background: '#3f7a4a' }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}

function PesagemScreen({ nome, onLogout }: { nome: string | null; onLogout: () => void }) {
  const [brinco, setBrinco] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [animal, setAnimal] = useState<AnimalBusca | null>(null);
  const [buscaError, setBuscaError] = useState('');

  const [peso, setPeso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvoOk, setSalvoOk] = useState(false);
  const [salvarError, setSalvarError] = useState('');

  const [historico, setHistorico] = useState<Lancamento[]>([]);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const pesoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (!brinco.trim()) return;
    setBuscando(true);
    setBuscaError('');
    setAnimal(null);
    setSalvoOk(false);
    try {
      const found = await rebanhoApi.buscarAnimalPorBrinco(brinco.trim());
      setAnimal(found);
      setTimeout(() => pesoInputRef.current?.focus(), 50);
    } catch (err) {
      setBuscaError(err instanceof Error ? err.message : 'Animal não encontrado');
    } finally {
      setBuscando(false);
    }
  }

  async function handleSalvar() {
    if (!animal) return;
    const pesoNum = Number(peso);
    if (!pesoNum || pesoNum <= 0) {
      setSalvarError('Informe um peso válido.');
      return;
    }
    setSalvando(true);
    setSalvarError('');
    try {
      await rebanhoApi.lancarPesoFuncionario(animal.id, pesoNum);
      setHistorico(h => [{ brinco: animal.brinco, peso: pesoNum, horario: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...h]);
      setSalvoOk(true);
      setPeso('');
      setAnimal(null);
      setBrinco('');
    } catch (err) {
      setSalvarError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0d1a10' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex items-center gap-2">
          <Beef size={20} style={{ color: '#c99a4f' }} />
          <div>
            <p className="text-white font-bold text-sm leading-none">Rebanho</p>
            {nome && <p className="text-xs mt-0.5" style={{ color: '#6b8f6f' }}>{nome}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {installPrompt && (
            <button
              onClick={() => { installPrompt.prompt(); setInstallPrompt(null); }}
              className="p-2 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.06)', color: '#6b8f6f' }}
              title="Instalar app"
            >
              <Download size={16} />
            </button>
          )}
          <button onClick={onLogout} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)', color: '#6b8f6f' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-5 py-6 flex flex-col gap-6">
        {/* Busca por brinco */}
        <form onSubmit={handleBuscar} className="flex flex-col gap-3">
          <label className="text-xs uppercase tracking-wide" style={{ color: '#6b8f6f' }}>Número do brinco</label>
          <div className="flex gap-2">
            <input
              value={brinco}
              onChange={e => setBrinco(e.target.value)}
              inputMode="numeric"
              placeholder="Ex: 123"
              className="flex-1 rounded-xl px-4 py-5 text-3xl font-black text-white text-center outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              type="submit"
              disabled={buscando}
              className="rounded-xl px-5 flex items-center justify-center disabled:opacity-60"
              style={{ background: '#3f7a4a' }}
            >
              {buscando ? <Loader2 size={22} className="animate-spin text-white" /> : <Search size={22} className="text-white" />}
            </button>
          </div>
          {buscaError && <p className="text-sm text-center" style={{ color: '#f87171' }}>{buscaError}</p>}
        </form>

        {/* Animal encontrado */}
        {animal && (
          <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-xl font-black">#{animal.brinco}</p>
                {animal.categoria && <p className="text-xs uppercase tracking-wide mt-1" style={{ color: '#6b8f6f' }}>{animal.categoria}</p>}
              </div>
              {animal.pesoAtual != null && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide" style={{ color: '#6b8f6f' }}>Último peso</p>
                  <p className="text-white text-lg font-bold">{animal.pesoAtual} kg</p>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs uppercase tracking-wide" style={{ color: '#6b8f6f' }}>Novo peso (kg)</label>
              <input
                ref={pesoInputRef}
                value={peso}
                onChange={e => setPeso(e.target.value)}
                inputMode="decimal"
                placeholder="Ex: 210"
                className="rounded-xl px-4 py-5 text-3xl font-black text-white text-center outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {salvarError && <p className="text-sm text-center" style={{ color: '#f87171' }}>{salvarError}</p>}

            <button
              onClick={handleSalvar}
              disabled={salvando}
              className="w-full rounded-xl py-4 text-lg font-bold uppercase tracking-wide text-white disabled:opacity-60"
              style={{ background: '#3f7a4a' }}
            >
              {salvando ? 'Salvando...' : 'Salvar peso'}
            </button>
          </div>
        )}

        {salvoOk && (
          <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(63,122,74,0.2)', border: '1px solid rgba(63,122,74,0.4)' }}>
            <Check size={18} style={{ color: '#7fd18a' }} />
            <p className="text-sm" style={{ color: '#7fd18a' }}>Peso registrado com sucesso.</p>
          </div>
        )}

        {/* Histórico da sessão */}
        {historico.length > 0 && (
          <div className="flex flex-col gap-2 mt-2">
            <p className="text-xs uppercase tracking-wide" style={{ color: '#6b8f6f' }}>Lançados agora</p>
            {historico.map((h, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-white text-sm font-bold">#{h.brinco}</span>
                <span className="text-sm" style={{ color: '#6b8f6f' }}>{h.peso} kg</span>
                <span className="text-xs" style={{ color: '#6b8f6f' }}>{h.horario}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
