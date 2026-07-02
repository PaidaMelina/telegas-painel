import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureRebanhoSchema } from '@/lib/db';
import { verifyAdminToken, verifyFuncionarioToken, unauthorized } from '@/lib/rebanho-auth';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = verifyAdminToken(request);
  const funcionario = admin ? null : verifyFuncionarioToken(request);
  if (!admin && !funcionario) return unauthorized();

  await ensureRebanhoSchema();

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const peso = body?.peso != null ? Number(body.peso) : null;
  if (!peso || peso <= 0) {
    return NextResponse.json({ error: 'Peso inválido' }, { status: 400 });
  }
  const observacao = body?.observacao?.toString().trim() || null;

  const { rows: animalRows } = await pool.query(
    `SELECT id FROM public.rebanho_animais WHERE id = $1 AND ativo = true`,
    [id]
  );
  if (!animalRows.length) {
    return NextResponse.json({ error: 'Animal não encontrado' }, { status: 404 });
  }

  const { rows } = await pool.query(
    `INSERT INTO public.rebanho_pesagens (animal_id, peso, funcionario_id, observacao)
     VALUES ($1, $2, $3, $4)
     RETURNING id, peso, data_pesagem, observacao, created_at`,
    [id, peso, funcionario?.id ?? null, observacao]
  );
  const p = rows[0];

  return NextResponse.json(
    {
      id: p.id,
      peso: parseFloat(p.peso),
      dataPesagem: p.data_pesagem,
      observacao: p.observacao,
      funcionarioNome: funcionario?.nome ?? null,
      createdAt: p.created_at,
    },
    { status: 201 }
  );
}
