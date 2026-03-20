'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, LayoutDashboard, Package, Users } from 'lucide-react';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: Package },
  { href: '/entregadores', label: 'Entregadores', icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Flame size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} strokeWidth={1.5} />
        <span className="sidebar-brand">TeleGás</span>
      </div>
      <nav className="sidebar-nav">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`sidebar-link${pathname === href ? ' active' : ''}`}>
            <Icon size={15} strokeWidth={1.5} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <span className="live-dot" />
        <span className="sidebar-live-label">Ao Vivo</span>
      </div>
    </aside>
  );
}
