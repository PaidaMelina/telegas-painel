import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureRebanhoSchema } from '@/lib/db';
import { verifyAdminToken, unauthorized } from '@/lib/rebanho-auth';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!verifyAdminToken(request)) return unauthorized();
  await ensureRebanhoSchema();

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const senha = body?.senha?.toString();

  if (!senha || senha.length < 4) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 4 caracteres' }, { status: 400 });
  }

  const { rows } = await pool.query(
    `UPDATE public.rebanho_funcionarios
     SET senha_hash = crypt($1, gen_salt('bf'))
     WHERE id = $2
     RETURNING id, nome`,
    [senha, id]
  );
  if (!rows.length) return NextResponse.json({ error: 'Funcionário não encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, nome: rows[0].nome });
}
