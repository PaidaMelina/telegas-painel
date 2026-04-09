import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { setupRoutes } from './routes';

const server = fastify({ logger: true });

server.register(cors, {
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

const JWT_SECRET = process.env.JWT_SECRET || 'telegas-secret-key-change-in-production';
server.register(jwt, { secret: JWT_SECRET });

// Protege todas rotas /api/* exceto /api/auth/* e OPTIONS (preflight CORS)
server.addHook('onRequest', async (request, reply) => {
  // Preflight OPTIONS nunca precisa de auth — CORS responde por si só
  if (request.method === 'OPTIONS') return;

  const url = request.url;
  const isPublic =
    url === '/api/health' ||
    url === '/api/version' ||
    url.startsWith('/api/auth/');

  if (isPublic) return;

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
