import { NextRequest, NextResponse } from 'next/server';
import { pool, ensureRebanhoSchema } from '@/lib/db';
import { verifyAdminToken, verifyFuncionarioToken, unauthorized } from '@/lib/rebanho-auth';

export async function GET(request: NextRequest) {
  const admin = verifyAdminToken(request);
  const funcionario = admin ? null : verifyFuncionarioToken(request);
  if (!admin && !funcionario) return unauthorized();

  await ensureRebanhoSchema();

  const brinco = request.nextUrl.searchParams.get('brinco')?.trim();
  if (!brinco) {
    return NextResponse.json({ error: 'Informe o brinco' }, { status: 400 });
  }

  const { rows } = await pool.query(
    `SELECT
       a.id, a.brinco, a.categoria,
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
     WHERE a.brinco = $1 AND a.ativo = true`,
    [brinco]
  );

  if (!rows.length) {
    return NextResponse.json({ error: 'Animal não encontrado' }, { status: 404 });
  }

  const a = rows[0];
  return NextResponse.json({
    id: a.id,
    brinco: a.brinco,
    categoria: a.categoria,
    pesoAtual: a.peso_atual ? parseFloat(a.peso_atual) : null,
    ultimaPesagemEm: a.ultima_pesagem_em,
  });
}
