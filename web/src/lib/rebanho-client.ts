function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('telegas_token');
}

function getFuncionarioToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('rebanho_token');
}

async function request(url: string, options: RequestInit = {}, token?: string | null): Promise<Response> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  return res;
}

async function adminRequest(url: string, options: RequestInit = {}): Promise<Response> {
  return request(url, options, getAdminToken());
}

async function parseOrThrow(res: Response, fallback: string) {
  if (!res.ok) {
    const err: { error?: string } = await res.json().catch(() => ({}));
    throw new Error(err.error || fallback);
  }
  return res.json();
}

export interface Animal {
  id: number;
  brinco: string;
  categoria: string | null;
  pesoInicial: number | null;
  pesoAtual: number | null;
  ultimaPesagemEm: string | null;
  observacoes: string | null;
  ativo: boolean;
  createdAt: string;
}

export interface Pesagem {
  id: number;
  peso: number;
  dataPesagem: string;
  observacao: string | null;
  funcionarioNome: string | null;
  createdAt: string;
}

export interface AnimalDetalhe extends Animal {
  pesagens: Pesagem[];
}

export interface Funcionario {
  id: number;
  nome: string;
  telefone: string;
  ativo: boolean;
  created_at: string;
}

export const rebanhoApi = {
  // --- Animais (admin) ---
  getAnimais: (search?: string): Promise<Animal[]> =>
    adminRequest(`/api/rebanho/animais${search ? `?search=${encodeURIComponent(search)}` : ''}`, { cache: 'no-store' })
      .then((r) => parseOrThrow(r, 'Erro ao buscar animais')),

  getAnimal: (id: number): Promise<AnimalDetalhe> =>
    adminRequest(`/api/rebanho/animais/${id}`, { cache: 'no-store' })
      .then((r) => parseOrThrow(r, 'Erro ao buscar animal')),

  criarAnimal: (data: { brinco: string; categoria?: string; pesoInicial?: number; observacoes?: string }): Promise<Animal> =>
    adminRequest('/api/rebanho/animais', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => parseOrThrow(r, 'Erro ao criar animal')),

  atualizarAnimal: (id: number, data: Partial<{ brinco: string; categoria: string; observacoes: string; ativo: boolean }>): Promise<Animal> =>
    adminRequest(`/api/rebanho/animais/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => parseOrThrow(r, 'Erro ao atualizar animal')),

  lancarPesoAdmin: (id: number, peso: number, observacao?: string): Promise<Pesagem> =>
    adminRequest(`/api/rebanho/animais/${id}/pesagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peso, observacao }),
    }).then((r) => parseOrThrow(r, 'Erro ao lançar peso')),

  // --- Funcionários (admin) ---
  getFuncionarios: (): Promise<Funcionario[]> =>
    adminRequest('/api/rebanho/funcionarios', { cache: 'no-store' })
      .then((r) => parseOrThrow(r, 'Erro ao buscar funcionários')),

  criarFuncionario: (data: { nome: string; telefone: string; senha: string }): Promise<Funcionario> =>
    adminRequest('/api/rebanho/funcionarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => parseOrThrow(r, 'Erro ao criar funcionário')),

  atualizarFuncionario: (id: number, data: Partial<{ nome: string; telefone: string; ativo: boolean }>): Promise<Funcionario> =>
    adminRequest(`/api/rebanho/funcionarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => parseOrThrow(r, 'Erro ao atualizar funcionário')),

  definirSenhaFuncionario: (id: number, senha: string): Promise<{ ok: true; nome: string }> =>
    adminRequest(`/api/rebanho/funcionarios/${id}/senha`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senha }),
    }).then((r) => parseOrThrow(r, 'Erro ao definir senha')),

  // --- App do funcionário (mobile) ---
  funcionarioLogin: async (telefone: string, senha: string) => {
    const res = await fetch('/api/rebanho/funcionario/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefone, senha }),
    });
    const data = await parseOrThrow(res, 'Erro ao fazer login');
    localStorage.setItem('rebanho_token', data.token);
    localStorage.setItem('rebanho_nome', data.funcionario.nome);
    return data;
  },

  funcionarioLogout: () => {
    localStorage.removeItem('rebanho_token');
    localStorage.removeItem('rebanho_nome');
  },

  buscarAnimalPorBrinco: (brinco: string) =>
    request(`/api/rebanho/animais/buscar?brinco=${encodeURIComponent(brinco)}`, { cache: 'no-store' }, getFuncionarioToken())
      .then((r) => parseOrThrow(r, 'Animal não encontrado')),

  lancarPesoFuncionario: (animalId: number, peso: number) =>
    request(`/api/rebanho/animais/${animalId}/pesagens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ peso }),
    }, getFuncionarioToken()).then((r) => parseOrThrow(r, 'Erro ao lançar peso')),
};
