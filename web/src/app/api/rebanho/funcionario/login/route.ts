import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureRebanhoSchema } from '@/lib/db';
import { signFuncionarioToken } from '@/lib/rebanho-auth';

export async function POST(request: NextRequest) {
  await ensureRebanhoSchema();

  const body = await request.json().catch(() => null);
  const telefone = body?.telefone?.toString().replace(/\D/g, '');
  const senha = body?.senha?.toString();

  if (!telefone || !senha) {
    return NextResponse.json({ error: 'Telefone e senha são obrigatórios' }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT id, nome, telefone
     FROM public.rebanho_funcionarios
     WHERE telefone = $1 AND ativo = true AND senha_hash = crypt($2, senha_hash)`,
    [telefone, senha]
  );

  if (!rows.length) {
    return NextResponse.json({ error: 'Telefone ou senha incorretos' }, { status: 401 });
  }

  const funcionario = rows[0];
  const token = signFuncionarioToken({
    id: funcionario.id,
    nome: funcionario.nome,
    telefone: funcionario.telefone,
    role: 'rebanho_funcionario',
  });

  return NextResponse.json({
    token,
    funcionario: { id: funcionario.id, nome: funcionario.nome, telefone: funcionario.telefone },
  });
}
