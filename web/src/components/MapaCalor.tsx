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
