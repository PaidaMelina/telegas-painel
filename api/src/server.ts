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
    url === '/api/migracoes' ||
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

// Migrações aplicadas na subida, a partir de db/migrations. Falham sem
// derrubar o processo: um banco temporariamente fora não pode impedir a API de
// atender /api/health, senão o orquestrador reinicia em laço e o serviço nunca
// fica de pé.
async function applyMigrations() {
  try {
    const { aplicarMigracoes, marcarComoAplicadas } = await import('./migrar');

    // Aplicadas manualmente no pgweb antes de existir este mecanismo.
    await marcarComoAplicadas([
      '001_corrige_integridade.sql',
      '002_metas_cliente.sql',
      '003_estoque_preserva_movimento.sql',
      '004_tarefas.sql',
      '005_corrige_trigger_tarefas.sql',
      '006_tarefas_recorrentes.sql',
      '007_precos_moeda.sql',
    ]);

    await aplicarMigracoes({
      info: (m) => server.log.info(m),
      warn: (m) => server.log.warn(m),
      error: (m) => server.log.error(m),
    });
  } catch (err) {
    // Antes, uma falha aqui era silenciosa e o sintoma só aparecia na tela,
    // como coluna inexistente. Agora o motivo fica explícito no log.
    server.log.error({ err }, 'Falha ao aplicar migrações — veja /api/migracoes');
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
