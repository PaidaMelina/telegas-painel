/**
 * Geocodificação via Nominatim (OpenStreetMap).
 *
 * Substitui o Google Geocoding: não exige chave, cadastro nem faturamento.
 * Em troca, é um serviço comunitário com regras de uso que precisam ser
 * respeitadas, sob pena de bloqueio por IP:
 *
 *   - no máximo 1 requisição por segundo (por isso a fila serializada abaixo);
 *   - User-Agent identificando a aplicação e um contato;
 *   - nada de geocodificação em massa.
 *
 * Referência: https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

const CONTATO = process.env.GEOCODE_CONTACT_EMAIL || 'admin@comercialdrb.com.br';
const USER_AGENT = `TeleGas-Painel/1.0 (${CONTATO})`;

// Intervalo mínimo entre chamadas. 1100ms dá folga sobre o limite de 1/s.
const INTERVALO_MS = 1100;

// Recorte da região de atendimento: Jaguarão (BR) e Rio Branco (UY), que são
// cidades vizinhas separadas pelo rio. Limita resultados homônimos de outros
// estados — "Rua General Câmara" existe em dezenas de cidades brasileiras.
const VIEWBOX = '-53.50,-32.45,-53.25,-32.70';

let ultimaChamada = 0;

async function respeitarLimite(): Promise<void> {
  const desde = Date.now() - ultimaChamada;
  if (desde < INTERVALO_MS) {
    await new Promise((r) => setTimeout(r, INTERVALO_MS - desde));
  }
  ultimaChamada = Date.now();
}

export interface Coordenada {
  lat: number;
  lng: number;
}

/**
 * Converte um endereço em coordenada. Retorna null quando não encontra.
 *
 * `cidadePadrao` é anexada quando o endereço não traz cidade — sem isso o
 * Nominatim devolve resultados de qualquer lugar do país.
 */
export async function geocodificar(
  endereco: string,
  cidadePadrao = 'Jaguarão, RS, Brasil'
): Promise<Coordenada | null> {
  const limpo = endereco.trim();
  if (!limpo) return null;

  // Evita duplicar a cidade se quem chamou já a incluiu.
  const jaTemCidade = /jaguar[ãa]o|rio branco/i.test(limpo);
  const consulta = jaTemCidade ? limpo : `${limpo}, ${cidadePadrao}`;

  const url =
    `${NOMINATIM}?format=json&limit=1&countrycodes=br,uy` +
    `&viewbox=${VIEWBOX}&q=${encodeURIComponent(consulta)}`;

  await respeitarLimite();

  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim respondeu ${res.status}`);

  const dados = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!Array.isArray(dados) || dados.length === 0) return null;

  const lat = parseFloat(dados[0].lat);
  const lng = parseFloat(dados[0].lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  return { lat, lng };
}
