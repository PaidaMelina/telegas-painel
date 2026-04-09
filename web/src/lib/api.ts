const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('telegas_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    localStorage.removeItem('telegas_token');
    window.location.href = '/login';
  }
  return res;
}

export const auth = {
  login: async (email: string, senha: string) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao fazer login');
    }
    const data = await res.json();
    localStorage.setItem('telegas_token', data.token);
    return data;
  },
  logout: () => {
    localStorage.removeItem('telegas_token');
    window.location.href = '/login';
  },
  isAuthenticated: () => !!getToken(),
};

export const api = {
  getDashboardSummary: async () => {
    const res = await fetchAuth(`${API_URL}/dashboard/summary`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch summary');
    return res.json();
  },

  getDashboardMetrics: async () => {
    const res = await fetchAuth(`${API_URL}/dashboard/metrics`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  },

  getDashboardStatusDistribution: async () => {
    const res = await fetchAuth(`${API_URL}/dashboard/status-distribution`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch status distribution');
    return res.json();
  },

  getDashboardByBairro: async (periodo?: string) => {
    const q = periodo ? `?periodo=${periodo}` : '';
    const res = await fetchAuth(`${API_URL}/dashboard/by-bairro${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch by bairro');
    return res.json();
  },

  getDashboardHeatmapAddresses: async (periodo?: string) => {
    const q = periodo ? `?periodo=${periodo}` : '';
    const res = await fetchAuth(`${API_URL}/dashboard/heatmap-addresses${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch address heatmap');
    return res.json();
  },

  getDashboardProdutosHoje: async () => {
    const res = await fetchAuth(`${API_URL}/dashboard/produtos-hoje`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch produtos hoje');
    return res.json();
  },

  getDashboardByEntregador: async () => {
    const res = await fetchAuth(`${API_URL}/dashboard/by-entregador`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch by entregador');
    return res.json();
  },

  getPedidos: async (params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetchAuth(`${API_URL}/pedidos?${query}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch pedidos');
    return res.json();
  },

  getPedidoDetails: async (id: string) => {
    const res = await fetchAuth(`${API_URL}/pedidos/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch pedido details');
    return res.json();
  },

  getPedidoHistory: async (id: string) => {
    const res = await fetchAuth(`${API_URL}/pedidos/${id}/history`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch pedido history');
    return res.json();
  },

  concluirPedido: async (id: number) => {
    const res = await fetchAuth(`${API_URL}/pedidos/${id}/concluir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao concluir pedido');
    }
    return res.json();
  },

  cancelarPedido: async (id: number, motivo?: string) => {
    const res = await fetchAuth(`${API_URL}/pedidos/${id}/cancelar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo: motivo || null }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao cancelar pedido');
    }
    return res.json();
  },

  getEntregadores: async () => {
    const res = await fetchAuth(`${API_URL}/entregadores`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch entregadores');
    return res.json();
  },

  criarEntregador: async (data: { nome: string; telefone: string }) => {
    const res = await fetchAuth(`${API_URL}/entregadores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao criar entregador');
    }
    return res.json();
  },

  atualizarEntregador: async (id: number, data: { nome: string; telefone: string; ativo: boolean }) => {
    const res = await fetchAuth(`${API_URL}/entregadores/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao atualizar entregador');
    }
    return res.json();
  },

  toggleFolga: async (id: number, emFolga: boolean) => {
    const res = await fetchAuth(`${API_URL}/entregadores/${id}/folga`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emFolga }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao atualizar folga');
    }
    return res.json();
  },

  getRetencao: async () => {
    const res = await fetchAuth(`${API_URL}/clientes/retencao`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch retencao');
    return res.json();
  },

  getClientes: async (params?: Record<string, string>) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    const res = await fetchAuth(`${API_URL}/clientes${query ? `?${query}` : ''}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch clientes');
    return res.json();
  },

  atualizarCliente: async (id: number, data: { nome?: string; endereco?: string; bairro?: string; etiquetas?: string[] }) => {
    const res = await fetchAuth(`${API_URL}/clientes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao atualizar cliente');
    }
    return res.json();
  },

  getRelatorioResumo: async (periodo: string, de?: string, ate?: string) => {
    const q = new URLSearchParams({ periodo, ...(de ? { de } : {}), ...(ate ? { ate } : {}) }).toString();
    const res = await fetchAuth(`${API_URL}/relatorios/resumo?${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch resumo');
    return res.json();
  },

  getRelatorioSerie: async (periodo: string, de?: string, ate?: string) => {
    const q = new URLSearchParams({ periodo, ...(de ? { de } : {}), ...(ate ? { ate } : {}) }).toString();
    const res = await fetchAuth(`${API_URL}/relatorios/serie-temporal?${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch serie');
    return res.json();
  },

  getRelatorioProdutos: async (periodo: string, de?: string, ate?: string) => {
    const q = new URLSearchParams({ periodo, ...(de ? { de } : {}), ...(ate ? { ate } : {}) }).toString();
    const res = await fetchAuth(`${API_URL}/relatorios/top-produtos?${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch produtos');
    return res.json();
  },

  getRelatorioEntregadores: async (periodo: string, de?: string, ate?: string) => {
    const q = new URLSearchParams({ periodo, ...(de ? { de } : {}), ...(ate ? { ate } : {}) }).toString();
    const res = await fetchAuth(`${API_URL}/relatorios/top-entregadores?${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch entregadores relatorio');
    return res.json();
  },

  getRelatorioBairros: async (periodo: string, de?: string, ate?: string) => {
    const q = new URLSearchParams({ periodo, ...(de ? { de } : {}), ...(ate ? { ate } : {}) }).toString();
    const res = await fetchAuth(`${API_URL}/relatorios/top-bairros?${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch bairros relatorio');
    return res.json();
  },

  excluirEntregador: async (id: number) => {
    const res = await fetchAuth(`${API_URL}/entregadores/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao excluir entregador');
    }
    return res.json();
  },

  getConversasAtivas: async () => {
    const res = await fetchAuth(`${API_URL}/conversas/ativas`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch conversas');
    return res.json();
  },

  getConversaMensagens: async (sessionId: string) => {
    const res = await fetchAuth(`${API_URL}/conversas/${encodeURIComponent(sessionId)}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch mensagens');
    return res.json();
  },

  getProdutos: async (all?: boolean) => {
    const q = all ? '?all=true' : '';
    const res = await fetchAuth(`${API_URL}/produtos${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch produtos');
    return res.json();
  },

  atualizarProduto: async (id: number, data: { nome?: string; preco?: number; unidade?: string; quantidadeMinima?: number; ativo?: boolean }) => {
    const res = await fetchAuth(`${API_URL}/produtos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erro ao atualizar produto');
    return res.json();
  },

  getMovimentosProduto: async (id: number) => {
    const res = await fetchAuth(`${API_URL}/produtos/${id}/movimentos`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Erro ao buscar movimentos');
    return res.json();
  },

  criarProduto: async (data: { nome: string; preco: number; unidade?: string; quantidade?: number; quantidadeMinima?: number }) => {
    const res = await fetchAuth(`${API_URL}/produtos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erro ao criar produto');
    return res.json();
  },

  atualizarEstoque: async (id: number, tipo: 'entrada' | 'saida' | 'ajuste', quantidade: number, observacao?: string) => {
    const res = await fetchAuth(`${API_URL}/produtos/${id}/estoque`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, quantidade, observacao }),
    });
    if (!res.ok) throw new Error('Erro ao atualizar estoque');
    return res.json();
  },

  buscarClientes: async (q: string) => {
    const res = await fetchAuth(`${API_URL}/clientes?search=${encodeURIComponent(q)}&limit=8`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Erro ao buscar clientes');
    return res.json();
  },

  criarCliente: async (data: { nome: string; telefone: string; endereco?: string; bairro?: string }) => {
    const res = await fetchAuth(`${API_URL}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Erro ao criar cliente');
    return res.json();
  },

  getFormasPagamento: async () => {
    const res = await fetchAuth(`${API_URL}/formas-pagamento`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Erro ao buscar formas de pagamento');
    return res.json();
  },

  criarFormaPagamento: async (data: { nome: string; slug: string; aceitaTroco: boolean; ativo: boolean; ordem: number }) => {
    const res = await fetchAuth(`${API_URL}/formas-pagamento`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || 'Erro ao criar'); }
    return res.json();
  },

  atualizarFormaPagamento: async (id: number, data: Partial<{ nome: string; slug: string; aceitaTroco: boolean; ativo: boolean; ordem: number }>) => {
    const res = await fetchAuth(`${API_URL}/formas-pagamento/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || 'Erro ao atualizar'); }
    return res.json();
  },

  excluirFormaPagamento: async (id: number) => {
    const res = await fetchAuth(`${API_URL}/formas-pagamento/${id}`, { method: 'DELETE' });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || 'Erro ao excluir'); }
    return res.json();
  },

  criarPedidoPortaria: async (data: {
    clienteId?: number;
    telefone: string;
    nome: string;
    endereco: string;
    bairro?: string;
    produtos: { id: number; nome: string; qtd: number; preco: number }[];
    formaPagamento: string;
    trocoPara?: number | null;
  }) => {
    const res = await fetchAuth(`${API_URL}/portaria/pedido`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao criar pedido');
    }
    return res.json();
  },
};
