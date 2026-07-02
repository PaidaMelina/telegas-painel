import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Rebanho',
  manifest: '/manifest-rebanho.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Rebanho',
    startupImage: '/api/icon-rebanho?size=512',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Rebanho',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d1a10',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RebanhoAppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
