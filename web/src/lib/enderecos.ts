/**
 * Busca de endereços via Photon (OpenStreetMap) — sem chave, cadastro ou
 * faturamento, ao contrário do Google Places.
 */

const PHOTON_URL = 'https://photon.komoot.io/api/';

/**
 * Recorte da área de atendimento: Jaguarão (BR) e Río Branco (UY), cidades
 * vizinhas separadas pelo rio Jaguarão.
 *
 * A `bbox` é o que faz os dois países aparecerem. A alternativa — anexar
 * ", Jaguarão" ao termo digitado — forçava todo resultado para o lado
 * brasileiro e escondia os endereços uruguaios.
 *
 * Formato do Photon: minLon,minLat,maxLon,maxLat
 */
const BBOX = '-53.48,-32.68,-53.28,-32.48';

export interface SugestaoEndereco {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  pais: string;
  /** true quando o endereço está do lado uruguaio */
  uruguai: boolean;
  lat: number;
  lng: number;
}

export async function buscarEnderecos(termo: string): Promise<SugestaoEndereco[]> {
  const limpo = termo.trim();
  if (limpo.length < 3) return [];

  const url = `${PHOTON_URL}?q=${encodeURIComponent(limpo)}&bbox=${BBOX}&limit=8`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const dados = await res.json();

  const sugestoes: SugestaoEndereco[] = (dados.features || [])
    .filter((f: any) => f.properties?.name)
    .map((f: any): SugestaoEndereco => {
      const p = f.properties;
      const [lng, lat] = f.geometry.coordinates;
      return {
        rua: p.name,
        numero: p.housenumber || '',
        bairro: p.district || p.suburb || '',
        cidade: p.city || p.town || p.village || '',
        pais: p.country || '',
        uruguai: (p.countrycode || '').toUpperCase() === 'UY',
        lat,
        lng,
      };
    });

  // O OSM divide cada rua em vários trechos, e cada trecho volta como um
  // resultado próprio — sem isto a lista repete o mesmo nome várias vezes.
  const vistos = new Set<string>();
  return sugestoes.filter((s) => {
    const chave = `${s.rua}|${s.bairro}|${s.cidade}`.toLowerCase();
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}
