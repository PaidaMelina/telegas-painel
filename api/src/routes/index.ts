import { FastifyInstance } from 'fastify';
import { pedidosRoutes } from './pedidos';
import { dashboardRoutes } from './dashboard';
import { entregadoresRoutes } from './entregadores';
import { pool } from '../db';

export async function setupRoutes(server: FastifyInstance) {
  server.get('/api/health', async () => {
    return { status: 'ok' };
  });

  server.get('/api/db-check', async () => {
    try {
      const result = await pool.query('SELECT NOW() as time, current_database() as db');
      return { status: 'connected', ...result.rows[0] };
    } catch (err: any) {
      return { status: 'error', message: err.message, code: err.code };
    }
  });

  server.get('/api/db-tables', async () => {
    try {
      const result = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
      return { tables: result.rows.map((r: any) => r.table_name) };
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  });

  server.register(pedidosRoutes, { prefix: '/api/pedidos' });
  server.register(dashboardRoutes, { prefix: '/api/dashboard' });
  server.register(entregadoresRoutes, { prefix: '/api/entregadores' });
}
