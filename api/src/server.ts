import fastify from 'fastify';
import jwt from '@fastify/jwt';
import { setupRoutes } from './routes';

const server = fastify({ logger: true });

const JWT_SECRET = process.env.JWT_SECRET || 'telegas-secret-key-change-in-production';
server.register(jwt, { secret: JWT_SECRET });

// CORS + Auth — tudo no mesmo hook, CORS headers sempre primeiro
server.addHook('onRequest', async (request, reply) => {
  const origin = request.headers.origin || '*';
  reply.header('Access-Control-Allow-Origin', origin);
  reply.header('Access-Control-Allow-Credentials', 'true');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Preflight — responde imediatamente com os headers acima
  if (request.method === 'OPTIONS') {
    return reply.status(204).send();
  }

  // Rotas públicas
  const url = request.url;
  if (
    url === '/api/health' ||
    url === '/api/version' ||
    url.startsWith('/api/auth/') ||
    url.startsWith('/api/produtos') ||
    url.startsWith('/api/formas-pagamento')
  ) return;

  // Todas as outras rotas exigem JWT
  try {
    await (request as any).jwtVerify();
  } catch {
    return reply.status(401).send({ error: 'Não autorizado' });
  }
});

setupRoutes(server);

const start = async () => {
  try {
    const { pool } = require('./db');
    await pool.query('ALTER TABLE public.telegas_pedidos ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)');
    await pool.query('ALTER TABLE public.telegas_pedidos ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)');
    
    const port = parseInt(process.env.PORT || '3333', 10);
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
