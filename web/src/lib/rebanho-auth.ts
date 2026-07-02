import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'telegas-secret-key-change-in-production';

interface AdminPayload {
  id: number;
  email: string;
  nome: string;
}

interface FuncionarioPayload {
  id: number;
  nome: string;
  telefone: string;
  role: 'rebanho_funcionario';
}

function getToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

export function verifyAdminToken(request: NextRequest): AdminPayload | null {
  const token = getToken(request);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminPayload & { role?: string };
    if (payload.role) return null; // admin tokens carry no role claim
    return payload;
  } catch {
    return null;
  }
}

export function verifyFuncionarioToken(request: NextRequest): FuncionarioPayload | null {
  const token = getToken(request);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET) as FuncionarioPayload;
    if (payload.role !== 'rebanho_funcionario') return null;
    return payload;
  } catch {
    return null;
  }
}

export function signFuncionarioToken(payload: FuncionarioPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function unauthorized() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
}
