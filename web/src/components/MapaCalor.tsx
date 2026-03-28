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

      // Light tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      const heatLayerFn = (window as any).L?.heatLayer;

      // Build heatmap data: prefer real geocoded addresses, fallback to bairro centroids
      let heatData: [number, number, number][] = [];

      if (coordenadas && coordenadas.length > 0) {
        const maxC = Math.max(...coordenadas.map(c => c.count), 1);
        heatData = coordenadas.map(c => [c.lat, c.lng, Math.min(c.count / maxC, 1)] as [number, number, number]);
      } else if (dados.length > 0) {
        const maxCount = Math.max(...dados.map(d => d.count), 1);
        dados.forEach(d => {
          const coords = getCoords(d.bairro);
          if (!coords) return;
          // Expand each bairro into multiple points to create a diffuse heat area
          const intensity = d.count / maxCount;
          const spread = 0.003; // ~300m spread
          for (let i = 0; i < Math.ceil(d.count * 3); i++) {
            const lat = coords[0] + (Math.random() - 0.5) * spread;
            const lng = coords[1] + (Math.random() - 0.5) * spread;
            heatData.push([lat, lng, intensity]);
          }
        });
      }

      if (heatData.length > 0 && typeof heatLayerFn === 'function') {
        heatLayerFn(heatData, {
          radius: 30,
          blur: 20,
          maxZoom: 17,
          gradient: {
            0.0: '#3b82f6',
            0.3: '#06b6d4',
            0.6: '#f59e0b',
            0.8: '#ef4444',
            1.0: '#dc2626',
          },
        }).addTo(map);
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
