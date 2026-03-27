import fastify from 'fastify';
import cors from '@fastify/cors';
import { setupRoutes } from './routes';

const server = fastify({ logger: true });

server.register(cors, {
  origin: '*',
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
