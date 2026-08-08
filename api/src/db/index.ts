import { Pool, types } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Corrige a leitura de colunas `timestamp without time zone`.
 *
 * O banco guarda esses horários já no fuso de operação (America/Sao_Paulo):
 * um pedido feito às 10h fica gravado como 10:00, e as consultas de relatório
 * usam `AT TIME ZONE 'America/Sao_Paulo'` partindo desse pressuposto.
 *
 * O comportamento padrão do driver, porém, é montar um objeto Date
 * interpretando o valor no fuso do processo — e o container roda em UTC.
 * As 10:00 viravam 10:00 UTC, o JSON saía como "10:00Z", e o navegador em
 * Brasília exibia 07:00. Três horas a menos em toda data do sistema: data do
 * pedido, último pedido do cliente, histórico de status. Passava despercebido
 * enquanto só o dia era exibido, e ficou evidente no prazo das tarefas, que
 * mostra a hora.
 *
 * Devolvendo o texto puro (só trocando o espaço por "T", para virar ISO), o
 * horário chega ao navegador sem marcação de fuso — e o JavaScript trata uma
 * data-hora sem fuso como horário local, que é exatamente o que ele é.
 *
 * OID 1114 = timestamp without time zone.
 * OID 1184 (timestamptz) fica intacto: ali o fuso é explícito e a conversão
 * automática está correta.
 */
types.setTypeParser(1114, (valor: string) => valor.replace(' ', 'T'));

/** Fuso de operação. Jaguarão e Rio Branco compartilham o mesmo horário. */
const FUSO = process.env.TZ_OPERACAO || 'America/Sao_Paulo';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * Põe cada conexão no fuso de operação.
 *
 * Sem isto, o container do banco responde em UTC: `NOW()` — usado nos DEFAULT
 * de created_at e ao marcar entregue_em, atribuido_em etc. — gravava três
 * horas à frente do horário real. Já o prazo digitado pelo gerente entra como
 * horário de parede (10:00 é 10:00), então as duas coisas divergiam dentro da
 * mesma tabela.
 *
 * Com o fuso fixado, tudo que o banco gera passa a coincidir com o relógio de
 * quem usa o sistema, e o `AT TIME ZONE 'America/Sao_Paulo'` já presente nos
 * relatórios continua válido.
 *
 * Registros gravados antes desta mudança seguem em UTC — nesta base, poucos
 * dias de dados.
 */
pool.on('connect', (client) => {
  client.query(`SET TIME ZONE '${FUSO}'`).catch((err) => {
    console.error('Não foi possível definir o fuso da conexão:', err.message);
  });
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});
