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
    const res = await fetch(`${API_URL}/pedidos?${query}`, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('Failed to fetch pedidos');
    return res.json();
  },

  getPedidoDetails: async (id: string) => {
    const res = await fetch(`${API_URL}/pedidos/${id}`, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('Failed to fetch pedido details');
    return res.json();
  },

  getPedidoHistory: async (id: string) => {
    const res = await fetch(`${API_URL}/pedidos/${id}/history`, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('Failed to fetch pedido history');
    return res.json();
  },

  updatePedidoStatus: async (id: number, status: string) => {
    const res = await fetch(`${API_URL}/pedidos/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Failed to update status');
    return res.json();
  },

  getEntregadores: async () => {
    const res = await fetch(`${API_URL}/entregadores`, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error('Failed to fetch entregadores');
    return res.json();
  },
};
