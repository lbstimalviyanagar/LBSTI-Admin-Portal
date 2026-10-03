import React, { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  danger = false,
  success = false,
  onConfirm,
  onCancel
}) {
  const cancelBtnRef = useRef(null);

  useEffect(() => {
    if (isOpen && cancelBtnRef.current) {
      setTimeout(() => cancelBtnRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="overlay confirm"
      onMouseDown={(e) => {
        if (e.target.classList.contains('overlay')) onCancel();
      }}
    >
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cfTitle"
        aria-describedby="cfMsg"
      >
        <h4 id="cfTitle">{title}</h4>
        <p id="cfMsg">{message}</p>
        <div className="dlg-actions">
          <button
            ref={cancelBtnRef}
            className="btn"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`btn ${danger ? 'danger-solid' : success ? 'success' : 'primary'}`}
            type="button"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
