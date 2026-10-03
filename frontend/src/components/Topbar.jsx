import React, { useState, useEffect, useRef } from 'react';
import Icon from './Icons';
import { ORG, parseDate, dayDiff, sod, isPendingFU } from '../utils/helpers';

export default function Topbar({
  user,
  enquiries = [],
  onOpenEdit,
  onToggleSidebar,
  collapsed
}) {
  const [bellOpen, setBellOpen] = useState(false);
  const [canNotify, setCanNotify] = useState(false);
  const bellRef = useRef(null);

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

  // Calculate due follow-ups
  const today = sod(new Date());
  const dueItems = enquiries
    .filter(isPendingFU)
    .map(e => ({ e, d: parseDate(e.followUpDate) }))
    .filter(x => x.d)
    .map(x => ({ e: x.e, diff: dayDiff(today, x.d) }))
    .filter(x => x.diff <= 1)
    .sort((a, b) => a.diff - b.diff);

  const dueCount = dueItems.filter(x => x.diff <= 0).length;

  const requestNotificationPermission = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setCanNotify(false);
        if (dueCount > 0) {
          new Notification('Follow-up Reminders', {
            body: `${dueCount} ${dueCount === 1 ? 'follow-up is' : 'follow-ups are'} due today or overdue.`
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const userName = user?.name || 'User';

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
            <div className="rem-panel" onClick={(e) => e.stopPropagation()}>
              <div className="rp-head">
                <b>Follow-up reminders</b>
                {canNotify && (
                  <button
                    className="btn link sm"
                    type="button"
                    onClick={requestNotificationPermission}
                  >
                    Enable desktop alerts
                  </button>
                )}
              </div>
              <ul className="rp-list">
                {dueItems.length > 0 ? (
                  dueItems.slice(0, 30).map((x) => {
                    const cls = x.diff < 0 ? 'over' : x.diff === 0 ? 'today' : '';
                    const txt = x.diff < 0 ? `${Math.abs(x.diff)}d overdue` : x.diff === 0 ? 'Today' : 'Tomorrow';
                    return (
                      <li key={x.e.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setBellOpen(false);
                            onOpenEdit(x.e.id);
                          }}
                        >
                          <span className="who">
                            <b>{x.e.name}</b>
                            <span>{x.e.course || ''} · {x.e.phone}</span>
                          </span>
                          <span className={`when ${cls}`}>{txt}</span>
                        </button>
                      </li>
                    );
                  })
                ) : (
                  <li className="rp-empty">No follow-ups due. You're all caught up.</li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="top-user">
          <div className="avatar">{userName.charAt(0).toUpperCase()}</div>
          <span>{userName}</span>
        </div>
      </div>
    </header>
  );
}
