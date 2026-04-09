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

  useEffect(() => {
    if (isLogin) {
      setChecked(true);
      return;
    }
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    } else {
      setChecked(true);
    }
  }, [pathname, isLogin]);

  if (!checked) return null;

  if (isLogin) return <>{children}</>;

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
