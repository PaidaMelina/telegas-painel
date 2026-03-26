'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
<<<<<<< HEAD
import { Flame, LayoutDashboard, Package, Users, Contact, HeartPulse } from 'lucide-react';
=======
import { Flame, LayoutDashboard, Package, Users, Contact } from 'lucide-react';
>>>>>>> 0b4fe6696680acf100a945913161681f0afc5672

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pedidos', label: 'Pedidos', icon: Package },
  { href: '/entregadores', label: 'Entregadores', icon: Users },
  { href: '/clientes', label: 'Clientes', icon: Contact },
<<<<<<< HEAD
  { href: '/retencao', label: 'Retenção', icon: HeartPulse },
=======
>>>>>>> 0b4fe6696680acf100a945913161681f0afc5672
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <Flame size={20} style={{ color: '#88aaff', flexShrink: 0 }} strokeWidth={1.5} />
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
        <span className="sidebar-live-dot" />
        <span className="sidebar-live-label">Ao Vivo</span>
      </div>
    </aside>
  );
}
