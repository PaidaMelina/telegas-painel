'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Flame, LayoutDashboard, Package, Users, Contact, HeartPulse, Map, BarChart2, ShoppingCart, Archive, CreditCard, LogOut } from 'lucide-react';
import { auth } from '@/lib/api';

const nav = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portaria', label: 'Portaria', icon: ShoppingCart },
  { href: '/pedidos', label: 'Pedidos', icon: Package },
  { href: '/produtos', label: 'Produtos', icon: Archive },
  { href: '/entregadores', label: 'Entregadores', icon: Users },
  { href: '/clientes', label: 'Clientes', icon: Contact },
  { href: '/retencao', label: 'Retenção', icon: HeartPulse },
  { href: '/mapa', label: 'Mapa', icon: Map },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart2 },
  { href: '/pagamentos', label: 'Pagamentos', icon: CreditCard },
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
      <button
        onClick={() => auth.logout()}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', background: 'none', border: 'none',
          padding: '10px 16px', color: '#666', fontSize: 13,
          cursor: 'pointer', borderTop: '1px solid #1a1a1a',
        }}
        onMouseOver={e => (e.currentTarget.style.color = '#aaa')}
        onMouseOut={e => (e.currentTarget.style.color = '#666')}
      >
        <LogOut size={14} strokeWidth={1.5} />
        <span>Sair</span>
      </button>
    </aside>
  );
}