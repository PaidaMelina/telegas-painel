'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { auth } from '@/lib/api';
import Sidebar from './Sidebar';
import PainelEntregas from './PainelEntregas';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();
  const isLogin = pathname === '/login';
  const isEntregador = pathname.startsWith('/entregador');

  useEffect(() => {
    if (isLogin || isEntregador) {
      setChecked(true);
      return;
    }
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    } else {
      setChecked(true);
    }
  }, [pathname, isLogin, isEntregador]);

  if (!checked) return null;

  if (isLogin || isEntregador) return <>{children}</>;

  return (
    <>
      <Sidebar />
      <div style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
        {children}
      </div>
      <PainelEntregas />
    </>
  );
}
