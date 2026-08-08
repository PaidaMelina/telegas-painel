import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { pool } from './db';

/**
 * Aplica os arquivos de db/migrations na subida da API.
 *
 * Antes disso, cada alteração de schema precisava ser colada à mão no pgweb
 * depois do deploy — e esquecer virava erro em produção com o código novo
 * esperando uma coluna que não existia.
 *
 * Como funciona: os arquivos são executados em ordem de nome, uma vez cada.
 * O que já rodou fica registrado em telegas_migracoes, então subir a API de
 * novo não repete nada.
 *
 * Cada arquivo roda dentro de uma transação: se falhar no meio, nada daquele
 * arquivo é aplicado e ele continua pendente para a próxima tentativa —
 * nunca metade de uma migração.
 */

/** Onde procurar os .sql, rodando por tsx (src) ou compilado (dist). */
function caminhosCandidatos(): string[] {
  return [
    join(__dirname, '..', 'db', 'migrations'),        // dist/../db
    join(__dirname, '..', '..', 'db', 'migrations'),  // dist/src/../../db
    join(process.cwd(), 'db', 'migrations'),
  ];
}

function pastaMigracoes(): string | null {
  return caminhosCandidatos().find(existsSync) ?? null;
}

/**
 * Garante a tabela de controle.
 *
 * Chamada por quem precisa dela: `marcarComoAplicadas` roda antes de
 * `aplicarMigracoes` na subida, e criar a tabela apenas dentro da segunda
 * fazia a primeira falhar com "relation does not exist" — derrubando a
 * execução inteira sem aplicar nada.
 */
async function garantirTabelaControle(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.telegas_migracoes (
      nome        TEXT PRIMARY KEY,
      aplicada_em TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

export async function aplicarMigracoes(log: {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
}): Promise<void> {
  const pasta = pastaMigracoes();
  if (!pasta) {
    log.warn(
      'Pasta de migrações não encontrada — nenhuma migração aplicada. '
      + `Procurei em: ${caminhosCandidatos().join(', ')}`
    );
    return;
  }

  await garantirTabelaControle();

  const { rows } = await pool.query(`SELECT nome FROM public.telegas_migracoes`);
  const jaAplicadas = new Set(rows.map((r: any) => r.nome));

  const arquivos = readdirSync(pasta)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const pendentes = arquivos.filter((f) => !jaAplicadas.has(f));
  if (pendentes.length === 0) {
    log.info(`Migrações: ${arquivos.length} já aplicadas, nada a fazer.`);
    return;
  }

  log.info(`Migrações pendentes: ${pendentes.join(', ')}`);

  for (const arquivo of pendentes) {
    const sql = readFileSync(join(pasta, arquivo), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Os arquivos trazem o próprio BEGIN/COMMIT porque também são colados no
      // pgweb. Aninhar transação no Postgres apenas emite um aviso, e o COMMIT
      // interno encerra a externa — o resultado é o mesmo.
      await client.query(sql);
      await client.query('COMMIT').catch(() => {});
      await client.query(
        `INSERT INTO public.telegas_migracoes (nome) VALUES ($1)
         ON CONFLICT (nome) DO NOTHING`,
        [arquivo]
      );
      log.info(`Migração aplicada: ${arquivo}`);
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      // Não derruba a API: um erro aqui deixa o serviço no ar para investigar,
      // em vez de reiniciar em laço sem nunca responder.
      log.error(`Migração ${arquivo} falhou: ${err.message}`);
      break; // as seguintes podem depender desta
    } finally {
      client.release();
    }
  }
}

/**
 * Registra migrações antigas como aplicadas sem executá-las.
 *
 * Este banco já recebeu 001 a 007 manualmente. Sem isto, a primeira subida
 * tentaria rodá-las de novo — são idempotentes, mas o seed da 007 e alguns
 * ALTERs gerariam ruído desnecessário.
 */
export async function marcarComoAplicadas(nomes: string[]): Promise<void> {
  if (nomes.length === 0) return;
  await garantirTabelaControle();
  await pool.query(
    `INSERT INTO public.telegas_migracoes (nome)
     SELECT unnest($1::text[]) ON CONFLICT (nome) DO NOTHING`,
    [nomes]
  );
}

/** Estado das migrações, para diagnóstico pela API. */
export async function estadoMigracoes(): Promise<{
  pasta: string | null;
  arquivos: string[];
  aplicadas: string[];
  pendentes: string[];
}> {
  const pasta = pastaMigracoes();
  const arquivos = pasta
    ? readdirSync(pasta).filter((f) => f.endsWith('.sql')).sort()
    : [];

  let aplicadas: string[] = [];
  try {
    await garantirTabelaControle();
    const { rows } = await pool.query(
      `SELECT nome FROM public.telegas_migracoes ORDER BY nome`
    );
    aplicadas = rows.map((r: any) => r.nome);
  } catch {
    // Banco fora: devolve o que der, em vez de falhar o diagnóstico.
  }

  return {
    pasta,
    arquivos,
    aplicadas,
    pendentes: arquivos.filter((f) => !aplicadas.includes(f)),
  };
}
