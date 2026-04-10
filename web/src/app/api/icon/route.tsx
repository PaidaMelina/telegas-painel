import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const size = parseInt(request.nextUrl.searchParams.get('size') || '192');
  const r = Math.round(size * 0.22);

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        background: '#0d1117',
        borderRadius: r,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size * 0.56,
          height: size * 0.56,
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.1)',
        }}
      >
        <span
          style={{
            fontSize: size * 0.36,
            fontWeight: 900,
            color: '#22c55e',
            lineHeight: 1,
          }}
        >
          TG
        </span>
      </div>
      <span
        style={{
          fontSize: size * 0.08,
          fontWeight: 700,
          color: '#4b5563',
          marginTop: size * 0.04,
          letterSpacing: 2,
        }}
      >
        ENTREGAS
      </span>
    </div>,
    { width: size, height: size }
  );
}
