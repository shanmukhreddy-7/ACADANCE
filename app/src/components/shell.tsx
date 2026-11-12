'use client';
import { ArrowLeft, Menu } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Brand, Badge } from './ui';
export type NavItem = { id: string; label: string; icon: ReactNode };
export default function Shell({
  mode,
  name,
  nav,
  active,
  onNavigate,
  onExit,
  children,
  footer,
}: {
  mode: 'Professor' | 'Student';
  name: string;
  nav: NavItem[];
  active: string;
  onNavigate: (id: string) => void;
  onExit: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [active]);
  return (
    <div className="workspace">
      <aside className={'sidebar ' + (open ? 'mobile-open' : '')}>
        <button className="brand-home" onClick={onExit} aria-label="Return to welcome">
          <Brand compact />
        </button>
        <div className="workspace-label">
          <span>{mode.toUpperCase()} WORKSPACE</span>
          <Badge tone={mode === 'Professor' ? 'amber' : 'green'}>
            {mode === 'Professor' ? 'Demo' : 'SRM AP'}
          </Badge>
        </div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                onNavigate(n.id);
                setOpen(false);
              }}
              className={active === n.id ? 'active' : ''}
            >
              {n.icon}
              <span>{n.label}</span>
              {active === n.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="back-home" onClick={onExit}>
            <ArrowLeft size={16} /> Switch workspace
          </button>
          <div className="account">
            <span className="avatar">
              {name
                .split(' ')
                .filter((x) => x !== 'Dr.')
                .slice(0, 2)
                .map((n) => n[0])
                .join('')}
            </span>
            <div>
              <strong>{name}</strong>
              <small>
                {mode === 'Professor' ? 'Faculty · local workspace' : 'Student · SRM AP'}
              </small>
            </div>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{nav.find((n) => n.id === active)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="topbar-date">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span className="topbar-status">
              <span className="live-dot" />
              {mode === 'Professor' ? 'Saved on this device' : 'University portal'}
            </span>
          </div>
        </header>
        <main className="workspace-content" key={active}>
          {children}
        </main>
        <footer className="workspace-footer">
          <span>acadence. </span>
          {footer ?? (
            <span>
              {mode === 'Professor'
                ? 'Professor demo · Records stay in this browser'
                : 'SRM AP · Independent student workspace'}
            </span>
          )}
        </footer>
      </div>
    </div>
  );
}
