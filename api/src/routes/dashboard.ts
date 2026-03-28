import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function dashboardRoutes(server: FastifyInstance) {
  server.get('/summary', async (_request, reply) => {
    try {
      const [totalRes, entreguesRes, abertosRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM public.telegas_pedidos WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`),
        pool.query(`SELECT COUNT(*) FROM public.telegas_pedidos WHERE status = 'entregue' AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`),
        pool.query(`SELECT COUNT(*) FROM public.telegas_pedidos WHERE status NOT IN ('entregue','cancelado') AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`),
      ]);
      return {
        hoje: {
          total: parseInt(totalRes.rows[0].count, 10),
          entregues: parseInt(entreguesRes.rows[0].count, 10),
        },
        emAberto: parseInt(abertosRes.rows[0].count, 10),
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar consolidado' });
    }
  });

  server.get('/metrics', async (_request, reply) => {
    try {
      const [ticketRes, tempoEntregaRes, atrasadosRes] = await Promise.all([
        pool.query(`
          SELECT COALESCE(AVG(total::numeric), 0) as ticket_medio
          FROM public.telegas_pedidos
          WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
            AND status != 'cancelado'
        `),
        pool.query(`
          SELECT COALESCE(
            AVG(EXTRACT(EPOCH FROM (entregue_em - atribuido_em)) / 60)
            FILTER (WHERE entregue_em IS NOT NULL AND atribuido_em IS NOT NULL
              AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE),
            0
          ) as minutos
          FROM public.telegas_pedidos
        `),
        pool.query(`
          SELECT COUNT(*) as count FROM public.telegas_pedidos
          WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
            AND (
              (status = 'atribuido' AND atribuido_em IS NOT NULL AND atribuido_em < NOW() - INTERVAL '15 minutes')
              OR
              (status = 'saiu_para_entrega' AND saiu_entrega_em IS NOT NULL AND saiu_entrega_em < NOW() - INTERVAL '45 minutes')
            )
        `),
      ]);
      return {
        ticketMedio: parseFloat(ticketRes.rows[0].ticket_medio) || 0,
        tempoMedioEntrega: parseFloat(tempoEntregaRes.rows[0].minutos) || 0,
        pedidosAtrasados: parseInt(atrasadosRes.rows[0].count, 10) || 0,
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar métricas' });
    }
  });

  server.get('/status-distribution', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM public.telegas_pedidos
        WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
        GROUP BY status
        ORDER BY count DESC
      `);
      return rows.map((r: any) => ({ status: r.status, count: parseInt(r.count, 10) }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar distribuição' });
    }
  });

  server.get('/by-bairro', async (request, reply) => {
    try {
      const { periodo = 'hoje' } = request.query as { periodo?: string };
      let whereClause: string;
      if (periodo === 'semana') {
        whereClause = `created_at AT TIME ZONE 'America/Sao_Paulo' >= (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '7 days'`;
      } else if (periodo === 'mes') {
        whereClause = `created_at AT TIME ZONE 'America/Sao_Paulo' >= (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '30 days'`;
      } else if (periodo === 'total') {
        whereClause = '1=1';
      } else {
        whereClause = `DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`;
      }
      const { rows } = await pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') as bairro,
          COUNT(*) as count,
          COALESCE(SUM(total::numeric), 0) as total
        FROM public.telegas_pedidos
        WHERE ${whereClause}
        GROUP BY bairro
        ORDER BY count DESC
        LIMIT 20
      `);
      return rows.map((r: any) => ({
        bairro: r.bairro,
        count: parseInt(r.count, 10),
        total: parseFloat(r.total),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar por bairro' });
    }
  });

  server.get('/produtos-hoje', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          CASE
            WHEN LOWER(item->>'produto') LIKE '%azul%'
              OR LOWER(item->>'produto') LIKE '%ultragaz%'   THEN 'gas_azul'
            WHEN LOWER(item->>'produto') LIKE '%cinza%'
              OR LOWER(item->>'produto') LIKE '%nacional%'
              OR LOWER(item->>'produto') LIKE '%branco%'     THEN 'gas_nacional'
            WHEN LOWER(item->>'produto') LIKE '%agua%'
              OR LOWER(item->>'produto') LIKE '%água%'       THEN 'agua'
            ELSE 'outros'
          END AS categoria,
          SUM((item->>'qtd')::int)                                         AS qtd,
          SUM((item->>'qtd')::int * (item->>'preco')::numeric)             AS receita
        FROM public.telegas_pedidos,
             jsonb_array_elements(produtos::jsonb) AS item
        WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
          AND status != 'cancelado'
        GROUP BY categoria
      `);

      const map: Record<string, { qtd: number; receita: number }> = {};
      for (const r of rows) {
        map[r.categoria] = { qtd: parseInt(r.qtd), receita: parseFloat(r.receita) };
      }
      const zero = { qtd: 0, receita: 0 };
      return {
        gasAzul:     map['gas_azul']     ?? zero,
        gasNacional: map['gas_nacional'] ?? zero,
        agua:        map['agua']         ?? zero,
        outros:      map['outros']       ?? zero,
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar produtos' });
    }
  });

  server.get('/by-entregador', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COALESCE(e.nome, 'Não atribuído') as nome,
          COUNT(p.id) FILTER (WHERE p.status IN ('atribuido','saiu_para_entrega') AND DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE) as em_aberto,
          COUNT(p.id) FILTER (WHERE p.status = 'entregue'
            AND DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE) as entregues_hoje,
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (p.entregue_em - p.atribuido_em)) / 60)
            FILTER (WHERE p.entregue_em IS NOT NULL AND p.atribuido_em IS NOT NULL
              AND DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE),
            0
          ) as tempo_medio
        FROM public.telegas_pedidos p
        LEFT JOIN public.telegas_entregadores e ON e.id = p.entregador_id
        WHERE DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
        GROUP BY e.id, e.nome
        ORDER BY entregues_hoje DESC
      `);
      return rows.map((r: any) => ({
        nome: r.nome,
        emAberto: parseInt(r.em_aberto, 10) || 0,
        entreguesHoje: parseInt(r.entregues_hoje, 10) || 0,
        tempoMedio: parseFloat(r.tempo_medio) || 0,
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar por entregador' });
    }
  });

  server.get('/heatmap-addresses', async (request, reply) => {
    try {
      const { periodo = 'mes' } = request.query as { periodo?: string };
      let whereClause: string;
      if (periodo === 'semana') {
        whereClause = `created_at AT TIME ZONE 'America/Sao_Paulo' >= (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '7 days'`;
      } else if (periodo === 'mes') {
        whereClause = `created_at AT TIME ZONE 'America/Sao_Paulo' >= (NOW() AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '30 days'`;
      } else if (periodo === 'total') {
        whereClause = '1=1';
      } else {
        whereClause = `DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`;
      }

      // Step 1: Geocodificação reativa (Lazy Geocoding)
      // Pega até 10 pedidos recentes sem latitude para tentar converter agora
      const missingCoordsRes = await pool.query(`
        SELECT id, endereco 
        FROM public.telegas_pedidos 
        WHERE latitude IS NULL 
          AND endereco IS NOT NULL 
          AND TRIM(endereco) != ''
          AND ${whereClause}
        ORDER BY created_at DESC 
        LIMIT 50
      `);

      const apiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBY8YkjuUbLuODVYwlD8mNzO-72nMlJupY';

      if (missingCoordsRes.rows.length > 0 && apiKey) {
        for (const row of missingCoordsRes.rows) {
          const q = encodeURIComponent(`${row.endereco}, Jaguarão, RS, Brasil`);
          try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${apiKey}`;
            const req = await fetch(url);
            const data = await req.json();
            
            if (data.status === 'OK' && data.results && data.results.length > 0) {
              const location = data.results[0].geometry.location;
              await pool.query(
                `UPDATE public.telegas_pedidos SET latitude = $1, longitude = $2 WHERE id = $3`,
                [location.lat, location.lng, row.id]
              );
            } else {
              // Mark as invalid (using 0 bounds to avoid re-fetching, or just leave it)
              // Just to prevent infinite loop for invalid addresses:
              await pool.query(`UPDATE public.telegas_pedidos SET latitude = 0, longitude = 0 WHERE id = $1`, [row.id]);
            }
          } catch (e) {
            server.log.error('Erro Geocoding Google: ' + e);
          }
        }
      }

      // Step 2: Buscar e retornar todos com coordenadas válidas
      const { rows } = await pool.query(`
        SELECT 
          latitude, 
          longitude,
          COUNT(*) as count
        FROM public.telegas_pedidos
        WHERE latitude IS NOT NULL 
          AND latitude != 0 
          AND longitude != 0
          AND ${whereClause}
        GROUP BY latitude, longitude
      `);

      return rows.map((r: any) => ({
        lat: parseFloat(r.latitude),
        lng: parseFloat(r.longitude),
        count: parseInt(r.count, 10),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar heatmap' });
    }
  });
}
