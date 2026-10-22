import { useState } from 'react';
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
  const current = navForPath(pathname);

  const visibleNav = NAV.filter((item) => user && item.roles.includes(user.role as 'admin' | 'teacher'));
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
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <img className="sidebar__logo" src={images.appIcon} alt="" />
          <div>
            <div className="sidebar__title">JuanWise</div>
            <div className="sidebar__subtitle">Admin</div>
          </div>
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

      <div className="main">
        <header className="topbar">
          <div>
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
