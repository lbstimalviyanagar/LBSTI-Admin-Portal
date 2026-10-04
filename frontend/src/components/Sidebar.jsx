import React from 'react';
import Icon from './Icons';
import { ORG, initials } from '../utils/helpers';

export default function Sidebar({
  user,
  tab,
  setTab,
  onLogout,
  collapsed,
  setCollapsed,
  onNavClick
}) {
  const isFeesVisible = ['admin', 'counselor', 'counsellor'].includes(String(user?.role || '').toLowerCase());
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const userName = user?.name || 'User';
  const userRole = user?.role || 'counselor';

  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="brand">
        <div className="brand-logo-container">
          <div className="logo-mark">
            {ORG.logoUrl ? (
              <img src={ORG.logoUrl} alt={ORG.name} />
            ) : (
              <span>{ORG.initials}</span>
            )}
          </div>
          {collapsed && (
            <button
              className="sidebar-toggle-btn collapsed-btn"
              type="button"
              aria-label="Open sidebar"
              data-tooltip-right="Open sidebar"
              onClick={() => setCollapsed(false)}
            >
              <span className="ic"><Icon name="sidebar" size={20} /></span>
            </button>
          )}
        </div>
        {!collapsed && (
          <div className="brand-text">
            <b>{ORG.name}</b>
            <span>{ORG.tagline}</span>
          </div>
        )}
        {!collapsed && (
          <button
            className="sidebar-toggle-btn expanded-btn"
            type="button"
            aria-label="Close sidebar"
            data-tooltip-bottom="Close sidebar"
            onClick={() => setCollapsed(true)}
          >
            <span className="ic"><Icon name="sidebar" size={18} /></span>
          </button>
        )}
      </div>

      <div className="user">
        {user?.profilePhotoUrl ? (
          <img src={user.profilePhotoUrl} alt={userName} className="avatar" />
        ) : (
          <div className="avatar">{initials(userName)}</div>
        )}
        <div>
          <b>{userName}</b>
          <span>{userRole}</span>
        </div>
      </div>

      <div className="nav-label">Menu</div>
      <nav aria-label="Main">
        <button
          className="nav-item"
          type="button"
          aria-current={tab !== 'fees' && tab !== 'users' ? 'page' : undefined}
          onClick={() => { setTab(tab === 'fees' || tab === 'users' ? 'dashboard' : tab); if (onNavClick) onNavClick(); }}
          data-tooltip-right={collapsed ? "Enquiries" : undefined}
        >
          <span className="ic"><Icon name="inbox" size={20} /></span>
          <span className="label">Enquiries</span>
        </button>

        {isFeesVisible && (
          <button
            className="nav-item"
            type="button"
            aria-current={tab === 'fees' ? 'page' : undefined}
            onClick={() => { setTab('payments'); if (onNavClick) onNavClick(); }}
            data-tooltip-right={collapsed ? "Fees" : undefined}
          >
            <span className="ic"><Icon name="fee" size={20} /></span>
            <span className="label">Fees</span>
          </button>
        )}

        {isAdmin && (
          <button
            className="nav-item"
            type="button"
            aria-current={tab === 'users' ? 'page' : undefined}
            onClick={() => { setTab('users'); if (onNavClick) onNavClick(); }}
            data-tooltip-right={collapsed ? "Users" : undefined}
          >
            <span className="ic"><Icon name="users" size={20} /></span>
            <span className="label">Users</span>
          </button>
        )}
      </nav>

      <div className="spacer" />

      <button 
        className="logout" 
        type="button" 
        onClick={onLogout}
        data-tooltip-right={collapsed ? "Logout" : undefined}
      >
        <span className="ic"><Icon name="logout" size={20} /></span>
        <span className="label">Logout</span>
      </button>
    </aside>
  );
}

