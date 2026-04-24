import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from '../context/NotificationContext';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '📊' },
    { path: '/products', label: 'Products', icon: '📦' },
    { path: '/competitors', label: 'Competitors', icon: '🏢' },
    { path: '/demand-signals', label: 'Demand Signals', icon: '📈' },
    { path: '/price-suggestions', label: 'Price Suggestions', icon: '💡' },
    { path: '/price-history', label: 'Price History', icon: '📜' },
    { path: '/market-trends', label: 'Market Trends', icon: '🌍' },
    { path: '/ai-insights', label: 'AI Insights', icon: '🤖' },
    { divider: true, label: 'AI Features' },
    { path: '/competitor-tracking', label: 'Competitor Tracker', icon: '🎯', isNew: true },
    { path: '/demand-forecasts', label: 'Demand Forecaster', icon: '🔮', isNew: true },
    { path: '/bundle-recommendations', label: 'Bundle Recommender', icon: '🎁', isNew: true },
    { path: '/discount-optimizations', label: 'Discount Optimizer', icon: '🏷️', isNew: true },
    { path: '/price-elasticity', label: 'Price Elasticity', icon: '📊', isNew: true },
    { path: '/price-tracker', label: 'Price Tracker', icon: '🛒', isNew: true },
    { divider: true, label: 'Admin' },
    { path: '/password-resets', label: 'Password Resets', icon: '🔑', isNew: true },
    { path: '/password-changes', label: 'Password Changes', icon: '🔄', isNew: true },
    { path: '/session-logs', label: 'Session Logs', icon: '📋', isNew: true },
    { path: '/pagination-configs', label: 'Pagination Configs', icon: '📄', isNew: true },
    { path: '/pdf-exports', label: 'PDF Exports', icon: '📑', isNew: true },
    { path: '/confirmation-dialogs', label: 'Confirmation Dialogs', icon: '💬', isNew: true },
    { path: '/error-logs', label: 'Error Logs', icon: '🚨', isNew: true },
    { path: '/loading-configs', label: 'Loading Configs', icon: '⏳', isNew: true },
    { path: '/rbac-policies', label: 'RBAC Policies', icon: '🛡️', isNew: true },
    { path: '/rate-limit-logs', label: 'Rate Limit Logs', icon: '🚦', isNew: true },
    { path: '/security-headers', label: 'Security Headers', icon: '🔒', isNew: true },
    { path: '/email-verifications', label: 'Email Verifications', icon: '📧', isNew: true },
    { path: '/password-validations', label: 'Password Validations', icon: '✅', isNew: true },
    { divider: true },
    { path: '/users', label: 'User Management', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-logo">AI Pricing Optimizer</div>
        <nav>
          <ul className="sidebar-nav">
            {navItems.map((item, index) => (
              item.divider ? (
                <li key={index} className="nav-divider">
                  {item.label && <span className="divider-label">{item.label}</span>}
                </li>
              ) : (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) => `${isActive ? 'active' : ''} ${item.isNew ? 'new-nav-item' : ''}`}
                    end={item.path === '/'}
                  >
                    <span className="icon">{item.icon}</span>
                    {item.label}
                    {item.isNew && <span className="new-indicator">NEW</span>}
                  </NavLink>
                </li>
              )
            ))}
          </ul>
        </nav>

        <div className="user-menu">
          <div className="user-avatar">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <div className="user-name">{user?.name || 'User'}</div>
            <div className="user-email">{user?.email || ''}</div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="top-bar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          <NotificationBell />
        </div>
        {children}
      </main>
    </div>
  );
};

export default Layout;
