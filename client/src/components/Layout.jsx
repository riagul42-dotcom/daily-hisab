import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ROLE_LABELS } from '../constants.js';
import { bnDigits } from '../format.js';
import { Icon } from './Icons.jsx';

const NAV = [
  { to: '/', label: 'ড্যাশবোর্ড', icon: 'dashboard', end: true },
  { to: '/expenses', label: 'খরচের তালিকা', icon: 'receipt' },
  { to: '/incomes', label: 'আয়ের তালিকা', icon: 'money' },
  { to: '/reports', label: 'রিপোর্ট', icon: 'chart' },
  { to: '/messages', label: 'মেসেঞ্জার', icon: 'chat' },
];
const ADMIN_NAV = { to: '/users', label: 'ব্যবহারকারী', icon: 'users' };
const CREATE_USER_NAV = { to: '/create-user', label: 'নতুন আইডি', icon: 'plus' };

const TITLES = {
  '/': 'ড্যাশবোর্ড',
  '/expenses': 'খরচের তালিকা',
  '/incomes': 'আয়ের তালিকা',
  '/reports': 'রিপোর্ট',
  '/messages': 'মেসেঞ্জার',
  '/users': 'ব্যবহারকারী ব্যবস্থাপনা',
  '/create-user': 'নতুন আইডি খুলুন',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await api('/messages/unread');
        if (alive) setUnread(data.total || 0);
      } catch {
        /* নীরবে বাদ */
      }
    };
    load();
    const timer = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [location.pathname]);

  const nav = [
    ...NAV,
    ...(user?.role === 'superadmin' ? [ADMIN_NAV, CREATE_USER_NAV] : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">৳</span>
          <div>
            <div className="brand-name">Daily Hisab</div>
            <div className="brand-sub">দৈনিক বাজার হিসাব</div>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="বন্ধ করুন">
            <Icon name="close" />
          </button>
        </div>

        <nav className="sidebar-nav">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.to === '/messages' && unread > 0 && (
                <span className="nav-badge">{bnDigits(unread)}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a className="apk-link" href="/Daily-Hisab.apk" download>
            <Icon name="android" size={18} />
            <span>Android অ্যাপ (APK)</span>
          </a>
          <div className="user-card">
            <div className="avatar">{(user?.name || '?').slice(0, 1)}</div>
            <div className="user-meta">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{ROLE_LABELS[user?.role] || ''}</div>
            </div>
            <button className="icon-btn" onClick={handleLogout} title="লগআউট" aria-label="লগআউট">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="মেনু">
            <Icon name="menu" />
          </button>
          <h1 className="page-title">{TITLES[location.pathname] || 'Daily Hisab'}</h1>
          <div className="topbar-user">
            <span className="chip">{ROLE_LABELS[user?.role] || ''}</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
