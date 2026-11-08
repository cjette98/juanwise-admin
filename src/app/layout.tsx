import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { API_ORIGIN } from '@/shared/api';
import { images } from '@/shared/assets/images';
import { Button, ConfirmDialog } from '@/shared/components/ui';
import { useAuth } from '@/features/auth/auth-context';
import { NAV, navForPath } from './nav';

export default function AdminLayout() {
  const { user, signOut } = useAuth();
  const { pathname } = useLocation();
  const [signingOut, setSigningOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  // Below ~900px the sidebar is a drawer (item 4 of Adjustment 3): a fixed
  // 248px column left a 375px phone about 127px for the page itself.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const current = navForPath(pathname);

  // Following a link is the end of a trip to the menu.
  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const visibleNav = NAV.filter(
    (item) => !item.hidden && user && item.roles.includes(user.role as 'admin' | 'teacher'),
  );
  const sections = ['Manage', 'Content'] as const;

  const handleSignOut = async () => {
    setConfirmingSignOut(false);
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className={`shell ${drawerOpen ? 'shell--drawer-open' : ''}`}>
      <nav
        id="sidebar"
        className={`sidebar ${drawerOpen ? 'sidebar--open' : ''}`}
        aria-label="Main menu"
      >
        <div className="sidebar__brand">
          <img className="sidebar__logo" src={images.appIcon} alt="" />
          <div>
            <div className="sidebar__title">JuanWise</div>
            <div className="sidebar__subtitle">Admin</div>
          </div>
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        {sections.map((section) => (
          <div key={section}>
            <div className="sidebar__section">{section}</div>
            {visibleNav.filter((item) => item.section === section).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) => `navlink ${isActive ? 'navlink--active' : ''}`}
              >
                <span className="navlink__icon" aria-hidden>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}

        <div className="sidebar__footer">
          <div>
            <strong>{user?.name ?? 'Administrator'}</strong>
            {user?.email}
          </div>
          <a href={`${API_ORIGIN}/api/docs`} target="_blank" rel="noreferrer" style={{ color: '#fff' }}>
            API docs ↗
          </a>
        </div>
      </nav>

      {drawerOpen && (
        <div className="drawer-backdrop" aria-hidden onClick={() => setDrawerOpen(false)} />
      )}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="topbar__menu"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="sidebar"
          >
            <span aria-hidden>☰</span>
          </button>
          <div className="topbar__heading">
            <h1>{current?.title ?? 'JuanWise Admin'}</h1>
            {current?.subtitle && <div className="topbar__subtitle">{current.subtitle}</div>}
          </div>
          <div className="topbar__actions">
            <Button
              variant="secondary"
              small
              onClick={() => setConfirmingSignOut(true)}
              busy={signingOut}
            >
              Sign out
            </Button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>

      {/* The app asks before signing out; the console used to go straight out on
          the click, which loses whatever was half-edited on the screen. */}
      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out of JuanWise Admin?"
        confirmLabel="Yes, sign out"
        cancelLabel="No, stay signed in"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmingSignOut(false)}
      >
        <p>You will need your username and password to get back in.</p>
      </ConfirmDialog>
    </div>
  );
}
