const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

export const api = {
  getDashboardSummary: async () => {
    const res = await fetch(`${API_URL}/dashboard/summary`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error('Failed to fetch summary');
    return res.json();
  },

  getDashboardMetrics: async () => {
    const res = await fetch(`${API_URL}/dashboard/metrics`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error('Failed to fetch metrics');
    return res.json();
  },

  getDashboardStatusDistribution: async () => {
    const res = await fetch(`${API_URL}/dashboard/status-distribution`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error('Failed to fetch status distribution');
    return res.json();
  },

  getDashboardByBairro: async () => {
    const res = await fetch(`${API_URL}/dashboard/by-bairro`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error('Failed to fetch by bairro');
    return res.json();
  },

  getDashboardByEntregador: async () => {
    const res = await fetch(`${API_URL}/dashboard/by-entregador`, { next: { revalidate: 30 } });
    if (!res.ok) throw new Error('Failed to fetch by entregador');
    return res.json();
  },

  getPedidos: async (params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_URL}/pedidos?${query}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch pedidos');
    return res.json();
  },

  getPedidoDetails: async (id: string) => {
    const res = await fetch(`${API_URL}/pedidos/${id}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch pedido details');
    return res.json();
  },

  getPedidoHistory: async (id: string) => {
    const res = await fetch(`${API_URL}/pedidos/${id}/history`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch pedido history');
    return res.json();
  },

  concluirPedido: async (id: number) => {
    const res = await fetch(`${API_URL}/pedidos/${id}/concluir`, {
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
    const res = await fetch(`${API_URL}/pedidos/${id}/cancelar`, {
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
    const res = await fetch(`${API_URL}/entregadores`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch entregadores');
    return res.json();
  },

  criarEntregador: async (data: { nome: string; telefone: string }) => {
    const res = await fetch(`${API_URL}/entregadores`, {
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
    const res = await fetch(`${API_URL}/entregadores/${id}`, {
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
    const res = await fetch(`${API_URL}/entregadores/${id}/folga`, {
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
    const res = await fetch(`${API_URL}/clientes/retencao`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch retencao');
    return res.json();
  },

  getClientes: async (params?: Record<string, string>) => {
    const query = params ? new URLSearchParams(params).toString() : '';
    const res = await fetch(`${API_URL}/clientes${query ? `?${query}` : ''}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch clientes');
    return res.json();
  },

  atualizarCliente: async (id: number, data: { nome?: string; endereco?: string; bairro?: string; etiquetas?: string[] }) => {
    const res = await fetch(`${API_URL}/clientes/${id}`, {
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

  excluirEntregador: async (id: number) => {
    const res = await fetch(`${API_URL}/entregadores/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Erro ao excluir entregador');
    }
    return res.json();
  },
};
