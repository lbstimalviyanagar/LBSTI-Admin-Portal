import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icons';
import { ORG, parseDate, dayDiff, sod, isPendingFU, getTelUrl, getWhatsAppUrl } from '../utils/helpers';

export default function Topbar({
  user,
  enquiries = [],
  onOpenEdit,
  onToggleSidebar,
  collapsed
}) {
  const [bellOpen, setBellOpen] = useState(false);
  const [canNotify, setCanNotify] = useState(false);
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'overdue' | 'today' | 'upcoming'
  const bellRef = useRef(null);

  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const uName = (user?.name || user?.fullName || user?.username || '').toLowerCase();

  // Respect user permissions: counselors see only their assigned leads unless admin
  const relevantEnquiries = isAdmin
    ? enquiries
    : enquiries.filter(e => {
        if (!e.assignedTo) return true; // allow unassigned leads for awareness
        const a = e.assignedTo.toLowerCase();
        return a === uName || a.includes(uName);
      });

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      setCanNotify(true);
    }
  }, []);

  // Close bell dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(ev) {
      if (bellRef.current && !bellRef.current.contains(ev.target)) {
        setBellOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Calculate categorized follow-ups
  const today = sod(new Date());
  const allFollowUps = relevantEnquiries
    .filter(isPendingFU)
    .map(e => {
      const d = parseDate(e.followUpDate);
      if (!d) return null;
      const diff = dayDiff(today, d);
      let cat = 'upcoming';
      if (diff < 0) cat = 'overdue';
      else if (diff === 0) cat = 'today';
      return { e, d, diff, cat };
    })
    .filter(Boolean)
    .sort((a, b) => a.diff - b.diff);

  const overdueList = allFollowUps.filter(x => x.cat === 'overdue');
  const todayList = allFollowUps.filter(x => x.cat === 'today');
  const upcomingList = allFollowUps.filter(x => x.cat === 'upcoming');

  const dueCount = overdueList.length + todayList.length;

  const displayList = filterTab === 'overdue'
    ? overdueList
    : filterTab === 'today'
      ? todayList
      : filterTab === 'upcoming'
        ? upcomingList
        : allFollowUps;

  // Prevent repeated notifications
  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setCanNotify(false);
        const lastNotif = sessionStorage.getItem('lbstimn_last_notif_date');
        const todayStr = new Date().toISOString().slice(0, 10);
        if (dueCount > 0 && lastNotif !== todayStr) {
          sessionStorage.setItem('lbstimn_last_notif_date', todayStr);
          new Notification('Follow-up Reminders', {
            body: `${dueCount} follow-up(s) require attention today or are overdue.`
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const userName = user?.name || user?.fullName || 'User';

  return (
    <header className="topbar">
      <div className="l">
        <button
          className="icon-btn menu-btn"
          type="button"
          aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
          data-tooltip-bottom={collapsed ? "Open sidebar" : "Close sidebar"}
          onClick={onToggleSidebar}
        >
          <span className="ic"><Icon name="sidebar" size={20} /></span>
        </button>
        <div className="logo-mark sm">
          {ORG.logoUrl ? <img src={ORG.logoUrl} alt="" /> : <span>{ORG.initials}</span>}
        </div>
        <h1>Admin Portal</h1>
      </div>

      <div className="r">
        <span className="domain">{ORG.domain}</span>
        <span className="sep" />

        <div className="bell-wrap" ref={bellRef}>
          <button
            className="icon-btn bell"
            type="button"
            aria-label="Follow-up reminders"
            aria-expanded={bellOpen}
            onClick={(ev) => {
              ev.stopPropagation();
              setBellOpen(!bellOpen);
            }}
          >
            <span className="ic"><Icon name="bell" size={19} /></span>
            {dueCount > 0 && (
              <span className="bell-count">{dueCount > 99 ? '99+' : dueCount}</span>
            )}
          </button>

          {bellOpen && (
            <div className="rem-panel" style={{ width: '380px', maxHeight: '520px', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
              <div className="rp-head" style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>Follow-up Reminders</b>
                  {canNotify && (
                    <button
                      className="btn link sm"
                      type="button"
                      onClick={requestNotificationPermission}
                      style={{ fontSize: '0.78rem' }}
                    >
                      Enable desktop alerts
                    </button>
                  )}
                </div>

                {/* Filter Tabs for Categorized View (Phase 2.7) */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button
                    type="button"
                    className={`btn sm ${filterTab === 'all' ? 'primary' : ''}`}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', height: '26px' }}
                    onClick={() => setFilterTab('all')}
                  >
                    All ({allFollowUps.length})
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${filterTab === 'overdue' ? 'danger' : ''}`}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', height: '26px', color: filterTab === 'overdue' ? '#fff' : '#b91c1c' }}
                    onClick={() => setFilterTab('overdue')}
                  >
                    Overdue ({overdueList.length})
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${filterTab === 'today' ? 'primary' : ''}`}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', height: '26px', color: filterTab === 'today' ? '#fff' : '#d97706' }}
                    onClick={() => setFilterTab('today')}
                  >
                    Today ({todayList.length})
                  </button>
                  <button
                    type="button"
                    className={`btn sm ${filterTab === 'upcoming' ? 'primary' : ''}`}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', height: '26px' }}
                    onClick={() => setFilterTab('upcoming')}
                  >
                    Upcoming ({upcomingList.length})
                  </button>
                </div>
              </div>

              <ul className="rp-list" style={{ overflowY: 'auto', flex: 1, margin: 0, padding: 0 }}>
                {displayList.length > 0 ? (
                  displayList.slice(0, 40).map((x) => {
                    const cls = x.diff < 0 ? 'over' : x.diff === 0 ? 'today' : '';
                    const txt = x.diff < 0
                      ? `${Math.abs(x.diff)}d overdue`
                      : x.diff === 0
                        ? 'Today'
                        : `In ${x.diff}d`;

                    return (
                      <li key={x.e.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div
                          style={{ flex: 1, cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => {
                            setBellOpen(false);
                            onOpenEdit(x.e.id);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <b style={{ fontSize: '0.88rem', color: '#1e293b' }}>{x.e.name}</b>
                            <span className={`when ${cls}`} style={{ fontSize: '0.72rem', padding: '1px 6px', borderRadius: '4px' }}>
                              {txt}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                            {x.e.course || 'Course not specified'} · {x.e.phone}
                          </div>
                        </div>

                        {/* Direct action buttons (Phase 2.8) */}
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {getTelUrl(x.e.phone) && (
                            <a
                              href={getTelUrl(x.e.phone)}
                              className="btn sm icon"
                              title={`Call ${x.e.name}`}
                              style={{ width: '28px', height: '28px', padding: 0, textDecoration: 'none' }}
                            >
                              <Icon name="phone" size={13} />
                            </a>
                          )}
                          {getWhatsAppUrl(x.e.phone) && (
                            <a
                              href={getWhatsAppUrl(x.e.phone, `Hello ${x.e.name || ''}, following up regarding your LBSTI admission inquiry.`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn sm icon"
                              style={{ width: '28px', height: '28px', padding: 0, color: '#16a34a', textDecoration: 'none' }}
                              title={`WhatsApp ${x.e.name}`}
                            >
                              <Icon name="whatsapp" size={14} />
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn sm icon"
                            style={{ width: '28px', height: '28px', padding: 0 }}
                            title="Open lead details & reschedule"
                            onClick={() => {
                              setBellOpen(false);
                              onOpenEdit(x.e.id);
                            }}
                          >
                            <Icon name="edit" size={13} />
                          </button>
                        </div>
                      </li>
                    );
                  })
                ) : (
                  <li className="rp-empty" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No follow-ups matching this filter.
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="top-user">
          {user?.profilePhotoUrl ? (
            <img src={user.profilePhotoUrl} alt={userName} className="avatar" />
          ) : (
            <div className="avatar">{userName.charAt(0).toUpperCase()}</div>
          )}
          <span>{userName}</span>
        </div>
      </div>
    </header>
  );
}
