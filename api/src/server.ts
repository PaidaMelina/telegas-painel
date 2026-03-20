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
    const port = parseInt(process.env.PORT || '3333', 10);
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
