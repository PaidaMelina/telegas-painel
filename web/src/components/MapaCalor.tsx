'use client';

import { useEffect, useRef } from 'react';

interface BairroDado {
  bairro: string;
  count: number;
  total: number;
}

interface Props {
  dados: BairroDado[];
  coordenadas?: { lat: number; lng: number; count: number }[];
}

/* Coordenadas dos bairros de Jaguarão - RS */
const COORDS: Record<string, [number, number]> = {
  'centro':                     [-32.5661, -53.3758],
  'porto':                      [-32.5715, -53.3820],
  'kennedy':                    [-32.5590, -53.3740],
  'pindorama':                  [-32.5510, -53.3640],
  'boa esperanca':              [-32.5560, -53.3850],
  'vila militar':               [-32.5615, -53.3800],
  'castelo branco':             [-32.5480, -53.3690],
  'cohab':                      [-32.5480, -53.3690],
  'nossa sra. da conceicao':    [-32.5630, -53.3680],
  'nossa senhora da conceicao': [-32.5630, -53.3680],
  'irineu guimaraes':           [-32.5530, -53.3780],
  'sao jorge':                  [-32.5450, -53.3750],
  'prado':                      [-32.5495, -53.3810],
};

function normalize(name: string): string {
  return name.toLowerCase().trim()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/ã/g, 'a').replace(/ç/g, 'c').replace(/é/g, 'e')
    .replace(/ê/g, 'e').replace(/ó/g, 'o').replace(/ô/g, 'o')
    .replace(/ú/g, 'u').replace(/á/g, 'a').replace(/í/g, 'i');
}

function getCoords(bairro: string): [number, number] | null {
  const key = normalize(bairro);
  for (const [k, v] of Object.entries(COORDS)) {
    if (normalize(k) === key) return v;
  }
  return null;
}

function getColor(ratio: number): string {
  // ratio: 0 (low) → 1 (high)
  if (ratio < 0.25) return '#2557e7';
  if (ratio < 0.5)  return '#06b6d4';
  if (ratio < 0.75) return '#f59e0b';
  return '#ef4444';
}

export default function MapaCalor({ dados, coordenadas }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let L: any;
    (async () => {
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      
      // Setup leaflet.heat
      (window as any).L = L;
      try {
        await import('leaflet.heat');
      } catch (e) {
        console.warn('leaflet.heat failed to load', e);
      }

      const map = L.map(containerRef.current, {
        center: [-32.5671, -53.376],
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
      });
      mapRef.current = map;

      // Dark tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Render Geocoded Points via Heatmap if available
      if (coordenadas && coordenadas.length > 0 && typeof (window as any).L.heatLayer === 'function') {
        const maxPtsCount = Math.max(...coordenadas.map((c: { lat: number; lng: number; count: number }) => c.count), 1);
        const heatData = coordenadas.map((c: { lat: number; lng: number; count: number }) => [c.lat, c.lng, Math.min(c.count / maxPtsCount * 2, 1)]);
        
        (window as any).L.heatLayer(heatData, {
          radius: 35,
          blur: 25,
          maxZoom: 16,
          gradient: {
            0.2: '#2557e7',
            0.4: '#06b6d4',
            0.6: '#f59e0b',
            0.8: '#ef4444',
            1.0: '#ff0000'
          }
        }).addTo(map);
      } 
      // Fallback to or render legacy Bairro Circles as well
      else {
        const maxCount = Math.max(...dados.map(d => d.count), 1);

        dados.forEach((d) => {
          const coords = getCoords(d.bairro);
          if (!coords) return;

          const ratio = d.count / maxCount;
          const radius = 30 + ratio * 70; // 30–100px
          const color = getColor(ratio);

          const circle = L.circleMarker(coords, {
            radius,
            fillColor: color,
            fillOpacity: 0.22 + ratio * 0.28,
            color: color,
            weight: 1.5,
            opacity: 0.7,
          }).addTo(map);

          circle.bindTooltip(`
            <div style="font-family:monospace;font-size:12px;line-height:1.6;min-width:130px">
              <strong style="font-size:13px;display:block;margin-bottom:4px">${d.bairro}</strong>
              <span style="color:#9aa5b4">Pedidos:</span> <strong style="color:${color}">${d.count}</strong><br/>
              <span style="color:#9aa5b4">Receita:</span> R$ ${d.total.toFixed(2)}
            </div>
          `, {
            className: 'mapa-tooltip',
            sticky: true,
            direction: 'top',
            offset: [0, -radius],
          });
        });
      }
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [dados, coordenadas]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
