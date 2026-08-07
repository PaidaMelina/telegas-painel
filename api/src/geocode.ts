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

// Recorte da região de atendimento: Jaguarão (BR) e Río Branco (UY), cidades
// vizinhas separadas pelo rio. Combinado com bounded=1, é o que restringe os
// resultados à região — "Rua General Câmara" existe em dezenas de cidades
// brasileiras — e, principalmente, é o que permite achar endereços dos DOIS
// lados da fronteira sem precisar saber o país de antemão.
// Formato do Nominatim: minLon,maxLat,maxLon,minLat
const VIEWBOX = '-53.48,-32.48,-53.28,-32.68';

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
 * Não anexa cidade ao termo: a delimitação vem do viewbox, que cobre as duas
 * cidades. Anexar "Jaguarão, RS, Brasil" empurrava todo endereço para o lado
 * brasileiro e fazia os clientes uruguaios nunca serem localizados.
 */
export async function geocodificar(endereco: string): Promise<Coordenada | null> {
  const limpo = endereco.trim();
  if (!limpo) return null;

  const url =
    `${NOMINATIM}?format=json&limit=1&countrycodes=br,uy` +
    `&viewbox=${VIEWBOX}&bounded=1&q=${encodeURIComponent(limpo)}`;

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
