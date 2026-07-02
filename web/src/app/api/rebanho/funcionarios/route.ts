import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureRebanhoSchema, isUniqueViolation } from '@/lib/db';
import { verifyAdminToken, unauthorized } from '@/lib/rebanho-auth';

export async function GET(request: NextRequest) {
  if (!verifyAdminToken(request)) return unauthorized();
  await ensureRebanhoSchema();

  const { rows } = await pool.query(
    `SELECT id, nome, telefone, ativo, created_at
     FROM public.rebanho_funcionarios
     ORDER BY nome ASC`
  );
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  if (!verifyAdminToken(request)) return unauthorized();
  await ensureRebanhoSchema();

  const body = await request.json().catch(() => null);
  const nome = body?.nome?.toString().trim();
  const telefone = body?.telefone?.toString().replace(/\D/g, '');
  const senha = body?.senha?.toString();

  if (!nome || !telefone) {
    return NextResponse.json({ error: 'Nome e telefone são obrigatórios' }, { status: 400 });
  }
  if (!senha || senha.length < 4) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 4 caracteres' }, { status: 400 });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO public.rebanho_funcionarios (nome, telefone, senha_hash)
       VALUES ($1, $2, crypt($3, gen_salt('bf')))
       RETURNING id, nome, telefone, ativo, created_at`,
      [nome, telefone, senha]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      return NextResponse.json({ error: 'Já existe um funcionário com esse telefone' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Erro ao criar funcionário' }, { status: 500 });
  }
}
