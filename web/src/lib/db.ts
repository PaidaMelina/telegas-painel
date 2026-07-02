import { Pool } from 'pg';

declare global {
  var __rebanhoPool: Pool | undefined;
}

export const pool =
  global.__rebanhoPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== 'production') {
  global.__rebanhoPool = pool;
}

let ensured = false;

export async function ensureRebanhoSchema() {
  if (ensured) return;
  ensured = true;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.rebanho_animais (
      id SERIAL PRIMARY KEY,
      brinco TEXT UNIQUE NOT NULL,
      categoria TEXT,
      peso_inicial NUMERIC,
      observacoes TEXT,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.rebanho_funcionarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      telefone TEXT UNIQUE NOT NULL,
      senha_hash TEXT NOT NULL,
      ativo BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.rebanho_pesagens (
      id SERIAL PRIMARY KEY,
      animal_id INTEGER NOT NULL REFERENCES public.rebanho_animais(id) ON DELETE CASCADE,
      peso NUMERIC NOT NULL,
      data_pesagem DATE NOT NULL DEFAULT CURRENT_DATE,
      funcionario_id INTEGER REFERENCES public.rebanho_funcionarios(id),
      observacao TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`).catch(() => {});
}

export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}
