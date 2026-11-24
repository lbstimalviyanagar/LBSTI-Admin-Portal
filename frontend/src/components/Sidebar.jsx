import React from 'react';
import Icon from './Icons';
import { ORG, initials } from '../utils/helpers';
import { hasMenuAccess } from '../utils/permissions';

export default function Sidebar({
  user,
  tab,
  setTab,
  onLogout,
  collapsed,
  setCollapsed,
  onNavClick
}) {
  const role = String(user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  
  const userName = user?.name || user?.fullName || 'User';
  const roleRaw = (user?.designation || user?.role || user?.role_name || '').trim();
  const displayRole = roleRaw 
    ? (roleRaw.charAt(0).toUpperCase() + roleRaw.slice(1).toLowerCase()) 
    : (user?.username?.toLowerCase() === 'palwasha' ? 'Teacher' : (isAdmin ? 'Admin' : 'Staff'));

  const handleLogoClick = () => {
    setTab('dashboard');
    if (onNavClick) onNavClick();
  };

  return (
    <aside className="sidebar" aria-label="Sidebar">
      {/* ============================================================ */}
      {/* 1. FIXED HEADER: Logo, Brand & Collapse Button              */}
      {/* ============================================================ */}
      <div className="sidebar-header">
        <div className="brand">
          <div
            className="brand-logo-container clickable-brand-logo"
            role="button"
            tabIndex={0}
            title="LBSTIMN Home / Dashboard"
            aria-label="LBSTIMN Home / Dashboard"
            onClick={handleLogoClick}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLogoClick(); } }}
          >
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
                aria-label="Expand sidebar"
                data-tooltip-right="Expand sidebar"
                onClick={(e) => { e.stopPropagation(); setCollapsed(false); }}
              >
                <span className="ic"><Icon name="sidebar" size={20} /></span>
              </button>
            )}
          </div>
          {!collapsed && (
            <div
              className="brand-text clickable-brand-text"
              role="button"
              tabIndex={0}
              title="LBSTIMN Home / Dashboard"
              aria-label="LBSTIMN Home / Dashboard"
              onClick={handleLogoClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleLogoClick(); } }}
            >
              <b>{ORG.name}</b>
              <span>{ORG.tagline}</span>
            </div>
          )}
          {!collapsed && (
            <button
              className="sidebar-toggle-btn expanded-btn"
              type="button"
              aria-label="Collapse sidebar"
              data-tooltip-bottom="Collapse sidebar"
              onClick={() => setCollapsed(true)}
            >
              <span className="ic"><Icon name="sidebar" size={18} /></span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. SCROLLABLE MIDDLE SECTION: User & Navigation Menu        */}
      {/* ============================================================ */}
      <div className="sidebar-scrollable">
        <div className="user">
          {user?.profilePhotoUrl ? (
            <img src={user.profilePhotoUrl} alt={userName} className="avatar" />
          ) : (
            <div className="avatar">{initials(userName)}</div>
          )}
          <div>
            <b>{userName}</b>
            <span>{displayRole}</span>
          </div>
        </div>

        <div className="nav-label">Menu</div>
        <nav aria-label="Main">
          {/* Enquiries */}
          {hasMenuAccess(user, 'enquiries') && (
            <button
              className="nav-item"
              type="button"
              aria-current={['new', 'table'].includes(tab) ? 'page' : undefined}
              onClick={() => { setTab('table'); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Enquiries" : undefined}
            >
              <span className="ic"><Icon name="inbox" size={20} /></span>
              <span className="label">Enquiries</span>
            </button>
          )}

          {/* Payments */}
          {hasMenuAccess(user, 'payments') && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === 'payments' ? 'page' : undefined}
              onClick={() => { setTab('payments'); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Payments" : undefined}
            >
              <span className="ic"><Icon name="fee" size={20} /></span>
              <span className="label">Payments</span>
            </button>
          )}

          {/* Expenses */}
          {isAdmin && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === 'expenses' ? 'page' : undefined}
              onClick={() => { setTab('expenses'); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Expenses" : undefined}
            >
              <span className="ic"><Icon name="fee" size={20} /></span>
              <span className="label">Expenses</span>
            </button>
          )}

          {/* Students */}
          {hasMenuAccess(user, 'students') && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === "students" ? "page" : undefined}
              onClick={() => { setTab("students"); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Students" : undefined}
            >
              <span className="ic"><Icon name="users" size={20} /></span>
              <span className="label">Students</span>
            </button>
          )}

          {/* Student Attendance */}
          {hasMenuAccess(user, 'student_attendance') && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === "student-attendance" ? "page" : undefined}
              onClick={() => { setTab("student-attendance"); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Student Attendance" : undefined}
            >
              <span className="ic"><Icon name="clipboard" size={20} /></span>
              <span className="label">Student Attendance</span>
            </button>
          )}

          {/* Staff Attendance */}
          {hasMenuAccess(user, 'attendance') && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === "attendance" ? "page" : undefined}
              onClick={() => { setTab("attendance"); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Staff Attendance" : undefined}
            >
              <span className="ic"><Icon name="clock" size={20} /></span>
              <span className="label">Staff Attendance</span>
            </button>
          )}

          {/* Course Content */}
          {hasMenuAccess(user, 'course_content') && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === "course-content" ? "page" : undefined}
              onClick={() => { setTab("course-content"); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Course Content" : undefined}
            >
              <span className="ic"><Icon name="book" size={20} /></span>
              <span className="label">Course Content</span>
            </button>
          )}

          {/* Content Planner */}
          {hasMenuAccess(user, 'social_planner') && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === "social-planner" ? "page" : undefined}
              onClick={() => { setTab("social-planner"); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Content Planner" : undefined}
            >
              <span className="ic"><Icon name="calendar" size={20} /></span>
              <span className="label">Content Planner</span>
            </button>
          )}

          {/* Tasks */}
          {hasMenuAccess(user, 'tasks') && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === "tasks" ? "page" : undefined}
              onClick={() => { setTab("tasks"); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Tasks" : undefined}
            >
              <span className="ic"><Icon name="check" size={20} /></span>
              <span className="label">Tasks</span>
            </button>
          )}

          {/* Batches */}
          {hasMenuAccess(user, 'batches') && (
            <button
              className="nav-item"
              type="button"
              aria-current={tab === "batches" ? "page" : undefined}
              onClick={() => { setTab("batches"); if (onNavClick) onNavClick(); }}
              data-tooltip-right={collapsed ? "Batches" : undefined}
            >
              <span className="ic"><Icon name="dashboard" size={20} /></span>
              <span className="label">Batches</span>
            </button>
          )}

          {/* Users */}
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
      </div>

      {/* ============================================================ */}
      {/* 3. FIXED FOOTER: Logout Button                              */}
      {/* ============================================================ */}
      <div className="sidebar-footer">
        <button 
          className="logout" 
          type="button" 
          onClick={onLogout}
          data-tooltip-right={collapsed ? "Logout" : undefined}
        >
          <span className="ic"><Icon name="logout" size={20} /></span>
          <span className="label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
