import { FastifyInstance } from 'fastify';
import { pedidosRoutes } from './pedidos';
import { dashboardRoutes } from './dashboard';

export async function setupRoutes(server: FastifyInstance) {
  server.get('/api/health', async () => {
    return { status: 'ok' };
  });

  server.register(pedidosRoutes, { prefix: '/api/pedidos' });
  server.register(dashboardRoutes, { prefix: '/api/dashboard' });
}
