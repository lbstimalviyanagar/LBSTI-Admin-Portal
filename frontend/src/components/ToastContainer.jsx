import React from 'react';

export default function ToastContainer({ toasts = [] }) {
  if (!toasts.length) return null;

  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.isErr ? 'err' : ''}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}
