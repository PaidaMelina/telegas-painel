'use client';

import { useEffect, useRef } from 'react';

interface BairroDado {
  bairro: string;
  count: number;
  total: number;
}

interface Props {
  dados: BairroDado[];
}

/* Coordenadas aproximadas dos bairros de Jaguarão - RS */
const COORDS: Record<string, [number, number]> = {
  'centro':         [-32.5671, -53.3760],
  'são marcos':     [-32.5590, -53.3790],
  'jardim':         [-32.5720, -53.3830],
  'parque':         [-32.5755, -53.3695],
  'bairro novo':    [-32.5625, -53.3845],
  'lacerdinha':     [-32.5700, -53.3660],
  'são cristóvão':  [-32.5645, -53.3715],
  'ponche verde':   [-32.5545, -53.3820],
  'vila nova':      [-32.5680, -53.3880],
  'progresso':      [-32.5610, -53.3700],
  'aparecida':      [-32.5730, -53.3760],
  'cohab':          [-32.5660, -53.3840],
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

export default function MapaCalor({ dados }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let L: any;
    (async () => {
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

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
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [dados]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
