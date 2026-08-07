import fastify from 'fastify';
import jwt from '@fastify/jwt';
import { setupRoutes } from './routes';

const server = fastify({ logger: true });

// Sem fallback: um segredo padrão em código permite que qualquer pessoa que
// leia o repositório forje um token válido e entre no painel como admin.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error(
    'JWT_SECRET não definido. Gere um valor aleatório (openssl rand -base64 48) ' +
    'e configure a variável de ambiente antes de subir a API.'
  );
  process.exit(1);
}
server.register(jwt, { secret: JWT_SECRET });

// Aceita corpo vazio em requisições application/json.
//
// Várias rotas de ação (concluir pedido, aceitar, entregar) não recebem dados,
// e é comum o cliente mandar o cabeçalho application/json mesmo assim. O
// comportamento padrão do Fastify é responder 400 nesse caso, o que aparece
// como falha inexplicável na tela. Aqui o corpo vazio vira {}.
server.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (_req, body: string | Buffer, done) => {
    const texto = typeof body === 'string' ? body : body.toString();
    if (!texto || texto.trim() === '') return done(null, {});
    try {
      done(null, JSON.parse(texto));
    } catch (err) {
      done(err as Error);
    }
  }
);

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
    url === '/api/entregador/login' ||
    url === '/api/entregador/vapid-key' ||
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

// Ajustes de schema aplicados na subida. Falham sem derrubar o processo: um
// banco temporariamente fora não pode impedir a API de atender /api/health,
// senão o orquestrador reinicia em laço e o serviço nunca fica de pé.
const migrations = [
  'ALTER TABLE public.telegas_pedidos ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7)',
  'ALTER TABLE public.telegas_pedidos ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7)',
];

async function applyMigrations() {
  const { pool } = await import('./db');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      server.log.error({ err, sql }, 'Falha ao aplicar ajuste de schema');
    }
  }
}

const start = async () => {
  const port = parseInt(process.env.PORT || '3333', 10);

  try {
    await server.listen({ port, host: '0.0.0.0' });
    server.log.info(`Server listening on port ${port}`);
  } catch (err) {
    // Só aqui vale abortar: sem porta, o processo não tem o que fazer.
    server.log.error(err, 'Não foi possível abrir a porta');
    process.exit(1);
  }

  await applyMigrations();
};

start();
