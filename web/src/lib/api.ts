const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api';

export const api = {
  getDashboardSummary: async () => {
    const res = await fetch(`${API_URL}/dashboard/summary`, { next: { revalidate: 30 } }); // Basic cache testing
    if (!res.ok) throw new Error('Failed to fetch summary');
    return res.json();
  },
  
  getPedidos: async (params?: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_URL}/pedidos?${query}`, { next: { revalidate: 0 } }); // No cache for live lists
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
  }
};
