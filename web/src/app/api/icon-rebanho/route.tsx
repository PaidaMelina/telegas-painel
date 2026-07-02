import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const size = parseInt(request.nextUrl.searchParams.get('size') || '192');

  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        background: '#0d1a10',
        borderRadius: size * 0.22,
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
          background: 'rgba(180,138,73,0.15)',
        }}
      >
        <span style={{ fontSize: size * 0.3, fontWeight: 900, color: '#c99a4f' }}>
          RB
        </span>
      </div>
      <span style={{ fontSize: size * 0.075, fontWeight: 700, color: '#6b8f6f', marginTop: size * 0.04 }}>
        REBANHO
      </span>
    </div>,
    { width: size, height: size }
  );
}
