import { FastifyInstance } from 'fastify';
import { pool } from '../db';

const SYSTEM_FILTERS = [
  '%=== CONTEXTO INTERNO%',
  '%NAMESPACE:%',
  '%=== DADOS DO CLIENTE%',
  '%=== INSTRUÇÃO%',
  '%tool_call%',
  '%tool_result%',
];

function buildExclude(col: string): string {
  return SYSTEM_FILTERS.map(f => `(${col}) NOT ILIKE '${f}'`).join(' AND ');
}

export async function conversasRoutes(server: FastifyInstance) {
  // GET /api/conversas/ativas
  // "Recent" = sessions whose last message is within the last 300 rows globally
  server.get('/ativas', async (_request, reply) => {
    try {
      const exclude = buildExclude("t.message->>'content'");

      const { rows } = await pool.query(`
        WITH global_max AS (
          SELECT COALESCE(MAX(id), 0) AS max_id FROM public.telegas_memoria_chat
        ),
        recent_sessions AS (
          SELECT session_id, MAX(id) AS last_id
          FROM public.telegas_memoria_chat, global_max
          WHERE id > global_max.max_id - 300
          GROUP BY session_id
        ),
        last_visible AS (
          SELECT DISTINCT ON (t.session_id)
            t.session_id,
            t.message,
            rs.last_id
          FROM public.telegas_memoria_chat t
          JOIN recent_sessions rs ON rs.session_id = t.session_id
          WHERE ${exclude}
          ORDER BY t.session_id, t.id DESC
        ),
        msg_counts AS (
          SELECT session_id, COUNT(*) AS cnt
          FROM public.telegas_memoria_chat, global_max
          WHERE id > global_max.max_id - 300
            AND ${buildExclude("message->>'content'")}
          GROUP BY session_id
        )
        SELECT
          lv.session_id,
          lv.message,
          lv.last_id,
          COALESCE(mc.cnt, 0) AS msgs_count
        FROM last_visible lv
        LEFT JOIN msg_counts mc ON mc.session_id = lv.session_id
        ORDER BY lv.last_id DESC
        LIMIT 12
      `);

      return rows.map((r: any) => ({
        sessionId:   r.session_id,
        lastMessage: r.message,
        lastId:      parseInt(r.last_id),
        msgsCount:   parseInt(r.msgs_count),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar conversas ativas' });
    }
  });

  // GET /api/conversas/:sessionId — last 8 visible messages
  server.get('/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const exclude = buildExclude("message->>'content'");
    try {
      const { rows } = await pool.query(`
        SELECT id, message
        FROM public.telegas_memoria_chat
        WHERE session_id = $1
          AND ${exclude}
        ORDER BY id DESC
        LIMIT 8
      `, [sessionId]);

      return rows.reverse().map((r: any) => ({
        id:      r.id,
        message: r.message,
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar mensagens' });
    }
  });
}
