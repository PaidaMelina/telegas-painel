import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureRebanhoSchema, isUniqueViolation } from '@/lib/db';
import { verifyAdminToken, unauthorized } from '@/lib/rebanho-auth';

export async function GET(request: NextRequest) {
  if (!verifyAdminToken(request)) return unauthorized();
  await ensureRebanhoSchema();

  const search = request.nextUrl.searchParams.get('search')?.trim();
  const params: string[] = [];
  let where = 'WHERE a.ativo = true';
  if (search) {
    params.push(`%${search}%`);
    where += ` AND a.brinco ILIKE $${params.length}`;
  }

  const { rows } = await pool.query(
    `SELECT
       a.id, a.brinco, a.categoria, a.peso_inicial, a.observacoes, a.ativo, a.created_at,
       ultima.peso AS peso_atual,
       ultima.data_pesagem AS ultima_pesagem_em
     FROM public.rebanho_animais a
     LEFT JOIN LATERAL (
       SELECT peso, data_pesagem
       FROM public.rebanho_pesagens
       WHERE animal_id = a.id
       ORDER BY data_pesagem DESC, id DESC
       LIMIT 1
     ) ultima ON true
     ${where}
     ORDER BY a.brinco ASC`,
    params
  );

  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      brinco: r.brinco,
      categoria: r.categoria,
      pesoInicial: r.peso_inicial ? parseFloat(r.peso_inicial) : null,
      pesoAtual: r.peso_atual ? parseFloat(r.peso_atual) : null,
      ultimaPesagemEm: r.ultima_pesagem_em,
      observacoes: r.observacoes,
      ativo: r.ativo,
      createdAt: r.created_at,
    }))
  );
}

export async function POST(request: NextRequest) {
  if (!verifyAdminToken(request)) return unauthorized();
  await ensureRebanhoSchema();

  const body = await request.json().catch(() => null);
  const brinco = body?.brinco?.toString().trim();
  if (!brinco) {
    return NextResponse.json({ error: 'Brinco é obrigatório' }, { status: 400 });
  }

  const categoria = body?.categoria?.toString().trim() || null;
  const pesoInicial = body?.pesoInicial != null ? Number(body.pesoInicial) : null;
  const observacoes = body?.observacoes?.toString().trim() || null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.rebanho_animais (brinco, categoria, peso_inicial, observacoes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, brinco, categoria, peso_inicial, observacoes, ativo, created_at`,
      [brinco, categoria, pesoInicial, observacoes]
    );
    const a = rows[0];
    return NextResponse.json(
      {
        id: a.id,
        brinco: a.brinco,
        categoria: a.categoria,
        pesoInicial: a.peso_inicial ? parseFloat(a.peso_inicial) : null,
        observacoes: a.observacoes,
        ativo: a.ativo,
        createdAt: a.created_at,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'Já existe um animal com esse brinco' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Erro ao criar animal' }, { status: 500 });
  }
}
