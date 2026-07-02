import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureRebanhoSchema, isUniqueViolation } from '@/lib/db';
import { verifyAdminToken, unauthorized } from '@/lib/rebanho-auth';

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
  const params: (string | boolean)[] = [];

  if (body.nome !== undefined) { params.push(body.nome.toString().trim()); sets.push(`nome = $${params.length}`); }
  if (body.telefone !== undefined) { params.push(body.telefone.toString().replace(/\D/g, '')); sets.push(`telefone = $${params.length}`); }
  if (body.ativo !== undefined) { params.push(!!body.ativo); sets.push(`ativo = $${params.length}`); }

  if (!sets.length) {
    return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
  }

  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE public.rebanho_funcionarios SET ${sets.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, nome, telefone, ativo, created_at`,
      params
    );
    if (!rows.length) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'Já existe um funcionário com esse telefone' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Erro ao atualizar funcionário' }, { status: 500 });
  }
}
