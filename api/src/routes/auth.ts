import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function authRoutes(server: FastifyInstance) {
  server.post('/login', async (request, reply) => {
    const { email, senha } = request.body as { email: string; senha: string };

    if (!email || !senha) {
      return reply.status(400).send({ error: 'Email e senha são obrigatórios' });
    }

    try {
      const result = await pool.query(
        `SELECT id, nome, email
         FROM telegas_usuarios
         WHERE email = $1
           AND senha_hash = crypt($2, senha_hash)
           AND ativo = true`,
        [email, senha]
      );

      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Email ou senha incorretos' });
      }

      const user = result.rows[0];
      const token = (server as any).jwt.sign(
        { id: user.id, email: user.email, nome: user.nome },
        { expiresIn: '24h' }
      );

      return reply.send({ token, user: { id: user.id, email: user.email, nome: user.nome } });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro interno' });
    }
  });

  server.get('/me', async (request, reply) => {
    try {
      await (request as any).jwtVerify();
      return reply.send({ user: (request as any).user });
    } catch {
      return reply.status(401).send({ error: 'Token inválido' });
    }
  });
}
