import React, { useState, useEffect } from 'react';
import Icon from './Icons';
import { sod, parseDate, dayDiff, isoDay, isPendingFU } from '../utils/helpers';

export default function DailyReminder({ enquiries = [], loading = false }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = "lbstimn_daily_dismiss_" + isoDay(new Date());
    try {
      if (sessionStorage.getItem(key)) {
        setDismissed(true);
      }
    } catch (e) {}
  }, []);

  if (loading || dismissed) return null;

  const today = sod(new Date());
  const dueItems = enquiries
    .filter(isPendingFU)
    .map(e => ({ e, d: parseDate(e.followUpDate) }))
    .filter(x => x.d)
    .map(x => ({ diff: dayDiff(today, x.d) }))
    .filter(x => x.diff <= 1);

  const dueToday = dueItems.filter(x => x.diff === 0).length;
  const overdue = dueItems.filter(x => x.diff < 0).length;

  if (!dueToday && !overdue) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.setItem("lbstimn_daily_dismiss_" + isoDay(new Date()), "1");
    } catch (e) {}
    setDismissed(true);
  };

  return (
    <div className="daily-reminder" role="status">
      <button
        className="icon-btn dr-close"
        type="button"
        aria-label="Dismiss"
        onClick={handleDismiss}
      >
        <span className="ic"><Icon name="x" size={15} /></span>
      </button>
      <b>Daily Follow-up Reminder</b>
      <p>
        You have {dueToday} {dueToday === 1 ? 'follow-up' : 'follow-ups'} scheduled for today, and {overdue} overdue follow-up{overdue === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
