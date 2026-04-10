import { NextRequest, NextResponse } from 'next/server';

// Generates a simple SVG icon served as PNG-compatible SVG
export async function GET(request: NextRequest) {
  const size = parseInt(request.nextUrl.searchParams.get('size') || '192');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="rounded">
      <rect width="${size}" height="${size}" rx="${size * 0.22}" ry="${size * 0.22}"/>
    </clipPath>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#0d1117"/>
  <circle cx="${size/2}" cy="${size*0.42}" r="${size*0.28}" fill="rgba(34,197,94,0.08)"/>
  <text
    x="${size/2}" y="${size*0.51}"
    font-family="system-ui,-apple-system,sans-serif"
    font-size="${size*0.36}"
    font-weight="900"
    fill="#22c55e"
    text-anchor="middle"
    dominant-baseline="middle"
  >TG</text>
  <text
    x="${size/2}" y="${size*0.76}"
    font-family="system-ui,-apple-system,sans-serif"
    font-size="${size*0.085}"
    font-weight="700"
    fill="#4b5563"
    text-anchor="middle"
    letter-spacing="${size*0.012}"
  >ENTREGAS</text>
  <circle cx="${size/2}" cy="${size*0.875}" r="${size*0.038}" fill="#22c55e"/>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
