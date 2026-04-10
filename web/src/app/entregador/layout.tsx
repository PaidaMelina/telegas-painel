import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'TeleGás — Entregas',
  manifest: '/manifest-entregador.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TeleGás',
    startupImage: '/api/icon?size=512',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'TeleGás',
  },
};

export const viewport: Viewport = {
  themeColor: '#070a0d',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function EntregadorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
