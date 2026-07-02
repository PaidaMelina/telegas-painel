import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureRebanhoSchema, isUniqueViolation } from '@/lib/db';
import { verifyAdminToken, unauthorized } from '@/lib/rebanho-auth';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminToken(request)) return unauthorized();
  await ensureRebanhoSchema();

  const { id } = await context.params;

  const { rows: animalRows } = await pool.query(
    `SELECT id, brinco, categoria, peso_inicial, observacoes, ativo, created_at
     FROM public.rebanho_animais WHERE id = $1`,
    [id]
  );
  if (!animalRows.length) {
    return NextResponse.json({ error: 'Animal não encontrado' }, { status: 404 });
  }
  const a = animalRows[0];

  const { rows: pesagens } = await pool.query(
    `SELECT p.id, p.peso, p.data_pesagem, p.observacao, p.created_at,
            f.nome AS funcionario_nome
     FROM public.rebanho_pesagens p
     LEFT JOIN public.rebanho_funcionarios f ON f.id = p.funcionario_id
     WHERE p.animal_id = $1
     ORDER BY p.data_pesagem ASC, p.id ASC`,
    [id]
  );

  return NextResponse.json({
    id: a.id,
    brinco: a.brinco,
    categoria: a.categoria,
    pesoInicial: a.peso_inicial ? parseFloat(a.peso_inicial) : null,
    observacoes: a.observacoes,
    ativo: a.ativo,
    createdAt: a.created_at,
    pesagens: pesagens.map((p) => ({
      id: p.id,
      peso: parseFloat(p.peso),
      dataPesagem: p.data_pesagem,
      observacao: p.observacao,
      funcionarioNome: p.funcionario_nome,
      createdAt: p.created_at,
    })),
  });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminToken(request)) return unauthorized();
  await ensureRebanhoSchema();

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Corpo inválido' }, { status: 400 });

  const sets: string[] = [];
  const params: (string | boolean | null)[] = [];

  if (body.brinco !== undefined) { params.push(body.brinco.toString().trim()); sets.push(`brinco = $${params.length}`); }
  if (body.categoria !== undefined) { params.push(body.categoria?.toString().trim() || null); sets.push(`categoria = $${params.length}`); }
  if (body.observacoes !== undefined) { params.push(body.observacoes?.toString().trim() || null); sets.push(`observacoes = $${params.length}`); }
  if (body.ativo !== undefined) { params.push(!!body.ativo); sets.push(`ativo = $${params.length}`); }

  if (!sets.length) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE public.rebanho_animais SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $${params.length}
       RETURNING id, brinco, categoria, peso_inicial, observacoes, ativo, created_at`,
      params
    );
    if (!rows.length) return NextResponse.json({ error: 'Animal não encontrado' }, { status: 404 });
    const a = rows[0];
    return NextResponse.json({
      id: a.id,
      brinco: a.brinco,
      categoria: a.categoria,
      pesoInicial: a.peso_inicial ? parseFloat(a.peso_inicial) : null,
      observacoes: a.observacoes,
      ativo: a.ativo,
      createdAt: a.created_at,
    });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'Já existe um animal com esse brinco' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Erro ao atualizar animal' }, { status: 500 });
  }
}
