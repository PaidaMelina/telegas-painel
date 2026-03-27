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

function buildExcludeWhere(col: string): string {
  return SYSTEM_FILTERS.map(f => `(${col}) NOT ILIKE '${f}'`).join(' AND ');
}

export async function conversasRoutes(server: FastifyInstance) {
  // GET /api/conversas/ativas — sessions with activity in the last 30 min
  server.get('/ativas', async (_request, reply) => {
    try {
      const exclude = buildExcludeWhere("t.message->>'content'");
      const excludeC = buildExcludeWhere("c.message->>'content'");

      const { rows } = await pool.query(`
        WITH recent_sessions AS (
          SELECT
            session_id,
            MAX(created_at) AS last_activity,
            MAX(id)         AS last_id
          FROM public.telegas_memoria_chat
          WHERE created_at > NOW() - INTERVAL '30 minutes'
          GROUP BY session_id
        ),
        last_visible AS (
          SELECT DISTINCT ON (t.session_id)
            t.session_id,
            t.message,
            rs.last_activity
          FROM public.telegas_memoria_chat t
          JOIN recent_sessions rs ON rs.session_id = t.session_id
          WHERE ${exclude}
          ORDER BY t.session_id, t.id DESC
        )
        SELECT
          lv.session_id,
          lv.message,
          lv.last_activity,
          (
            SELECT COUNT(*)
            FROM public.telegas_memoria_chat c
            WHERE c.session_id = lv.session_id
              AND c.created_at > NOW() - INTERVAL '30 minutes'
              AND ${excludeC}
          ) AS msgs_count
        FROM last_visible lv
        ORDER BY lv.last_activity DESC
        LIMIT 12
      `);

      return rows.map((r: any) => ({
        sessionId:    r.session_id,
        lastMessage:  r.message,
        lastActivity: r.last_activity,
        msgsCount:    parseInt(r.msgs_count),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar conversas ativas' });
    }
  });

  // GET /api/conversas/:sessionId — last N messages of a session (for preview)
  server.get('/:sessionId', async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const exclude = buildExcludeWhere("message->>'content'");
    try {
      const { rows } = await pool.query(`
        SELECT message, created_at
        FROM public.telegas_memoria_chat
        WHERE session_id = $1
          AND ${exclude}
        ORDER BY id DESC
        LIMIT 6
      `, [sessionId]);

      return rows.reverse().map((r: any) => ({
        message:   r.message,
        createdAt: r.created_at,
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar mensagens' });
    }
  });
}
