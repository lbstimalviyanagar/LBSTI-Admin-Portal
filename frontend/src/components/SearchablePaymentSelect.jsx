import React, { useState, useRef, useEffect, useMemo } from 'react';
import Icon from './Icons';
import { fmtDate } from '../utils/helpers';

/**
 * Searchable Combobox for Payment records.
 * Allows searching/filtering by student name, contact number, or receipt ID in real time.
 */
export default function SearchablePaymentSelect({
  id = 'receiptPayment',
  name = 'receiptPayment',
  payments = [],
  students = [],
  enquiries = [],
  selectedId = '',
  value = '',
  onSelect,
  onChange,
  placeholder = 'Search by student name, contact number, or receipt ID...'
}) {
  const activeId = String(selectedId || value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalize payments with complete metadata (student name, phone, receipt ID, etc.)
  const normalizedPayments = useMemo(() => {
    if (!Array.isArray(payments)) return [];

    return payments.map((f) => {
      const student =
        (students || []).find(
          (s) =>
            String(s.id) === String(f.enquiryId) ||
            String(s.studentId) === String(f.studentId) ||
            (f.studentPhone && s.phone === f.studentPhone) ||
            (f.studentName && s.name && s.name.toLowerCase() === f.studentName.toLowerCase())
        ) ||
        (enquiries || []).find(
          (e) =>
            String(e.id) === String(f.enquiryId) ||
            (f.studentPhone && e.phone === f.studentPhone) ||
            (f.studentName && e.name && e.name.toLowerCase() === f.studentName.toLowerCase())
        ) ||
        {};

      const phone = f.studentPhone || f.phone || student.phone || student.mobile || '';
      const receiptNo =
        f.receiptNumber ||
        (f.receiptDetails && f.receiptDetails.receiptNumber) ||
        `LBSTI-${new Date(f.paymentDate || Date.now()).getFullYear()}-${String(f.id).padStart(4, '0')}`;
      const studentName = f.studentName || student.name || 'Enrolled Student';
      const amount = Number(f.amount || 0);
      const dateStr = f.paymentDate ? fmtDate(f.paymentDate) : '';
      const extraDesc = f.othersDescription || f.receiptDetails?.othersDescription || '';
      const course = f.course || f.receiptDetails?.course || f.receiptDetails?.batch || student.course || '';

      return {
        ...f,
        rawId: f.id,
        stringId: String(f.id),
        phone,
        receiptNo,
        studentName,
        amount,
        dateStr,
        extraDesc,
        course
      };
    });
  }, [payments, students, enquiries]);

  // Current selected payment object
  const selectedPayment = useMemo(() => {
    if (!activeId) return null;
    return normalizedPayments.find((p) => p.stringId === activeId || String(p.rawId) === activeId) || null;
  }, [normalizedPayments, activeId]);

  // Filter payments based on search query (by student name, contact number, or receipt ID)
  const filteredPayments = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return normalizedPayments;

    const tokens = q.split(/\s+/).filter(Boolean);

    return normalizedPayments.filter((p) => {
      const name = p.studentName.toLowerCase();
      const phoneRaw = p.phone.toLowerCase();
      const phoneDigits = p.phone.replace(/\D/g, '');
      const receipt = p.receiptNo.toLowerCase();
      const idStr = p.stringId;
      const course = p.course.toLowerCase();
      const extra = p.extraDesc.toLowerCase();
      const amountStr = String(p.amount);

      return tokens.every((token) => {
        const cleanToken = token.replace(/\D/g, '');
        const phoneMatch = cleanToken && phoneDigits.includes(cleanToken);
        const textMatch =
          name.includes(token) ||
          phoneRaw.includes(token) ||
          receipt.includes(token) ||
          idStr === token ||
          course.includes(token) ||
          extra.includes(token) ||
          amountStr.includes(token);

        return phoneMatch || textMatch;
      });
    });
  }, [normalizedPayments, searchQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('.searchable-payment-item');
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelectPayment = (payment) => {
    const pId = payment ? String(payment.stringId || payment.rawId || payment.id) : '';
    if (typeof onSelect === 'function') {
      onSelect(pId, payment);
    }
    if (typeof onChange === 'function') {
      onChange(pId, payment);
    }
    setIsOpen(false);
    setSearchQuery('');
    setHighlightedIndex(-1);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleClearSelection = (e) => {
    e.stopPropagation();
    if (typeof onSelect === 'function') {
      onSelect('', null);
    }
    if (typeof onChange === 'function') {
      onChange('', null);
    }
    setSearchQuery('');
    setIsOpen(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredPayments.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredPayments.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredPayments.length) {
        handleSelectPayment(filteredPayments[highlightedIndex]);
      } else if (filteredPayments.length === 1) {
        handleSelectPayment(filteredPayments[0]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  // Determine display label inside the input field
  const inputValue = isOpen
    ? searchQuery
    : selectedPayment
    ? `${selectedPayment.studentName} — ₹${selectedPayment.amount.toLocaleString('en-IN')} — ${selectedPayment.dateStr}${selectedPayment.receiptNo ? ` (${selectedPayment.receiptNo})` : ''}`
    : '';

  return (
    <div
      ref={containerRef}
      className="searchable-combobox-root"
      style={{
        position: 'relative',
        width: '100%'
      }}
    >
      {/* Hidden input to ensure programmatic and form value access */}
      <input type="hidden" id={`${id}-value`} name={name} value={activeId} />

      {/* Combobox Input Container */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%'
        }}
      >
        {/* Leading Search Icon */}
        <span
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#64748b',
            display: 'inline-flex',
            alignItems: 'center',
            pointerEvents: 'none'
          }}
        >
          <Icon name="search" size={16} />
        </span>

        {/* Searchable Input Field */}
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          autoComplete="off"
          className="input searchable-combobox-input"
          placeholder={selectedPayment && !isOpen ? '' : placeholder}
          value={inputValue}
          onFocus={() => {
            setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: '100%',
            height: '42px',
            paddingLeft: '38px',
            paddingRight: selectedPayment || searchQuery ? '68px' : '38px',
            borderRadius: '8px',
            fontSize: '0.9rem',
            border: isOpen ? '1px solid #2563eb' : '1px solid var(--border, #cbd5e1)',
            boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
            background: '#ffffff',
            color: 'var(--text, #0f172a)',
            fontWeight: !isOpen && selectedPayment ? '600' : '400',
            cursor: 'text',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
          }}
        />

        {/* Trailing Controls (Clear Button & Dropdown Toggle) */}
        <div
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          {(selectedPayment || searchQuery) && (
            <button
              type="button"
              onClick={handleClearSelection}
              title="Clear selection"
              aria-label="Clear selection"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4px',
                borderRadius: '50%',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.background = '#fef2f2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#94a3b8';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon name="x" size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (isOpen) {
                setIsOpen(false);
              } else {
                setIsOpen(true);
                if (inputRef.current) inputRef.current.focus();
              }
            }}
            title={isOpen ? 'Close list' : 'Open list'}
            aria-label="Toggle options"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px'
            }}
          >
            <Icon name={isOpen ? 'chevU' : 'chevD'} size={15} />
          </button>
        </div>
      </div>

      {/* Floating Dropdown Listbox */}
      {isOpen && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          ref={listRef}
          className="searchable-combobox-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 5px)',
            left: 0,
            right: 0,
            zIndex: 1000,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '10px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '4px 0'
          }}
        >
          {/* Quick Header Hint */}
          <div
            style={{
              padding: '6px 14px 4px',
              fontSize: '0.72rem',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#64748b',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>Payments ({filteredPayments.length})</span>
            <span style={{ fontSize: '0.7rem', fontWeight: '500', color: '#94a3b8' }}>
              Filter by name, phone, or receipt ID
            </span>
          </div>

          {filteredPayments.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: '#64748b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ color: '#94a3b8' }}>
                <Icon name="search" size={22} />
              </span>
              <div style={{ fontWeight: '600', color: '#334155' }}>No matching payments found</div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Try searching by a different student name, phone number, or receipt ID.
              </div>
            </div>
          ) : (
            filteredPayments.map((p, idx) => {
              const isSelected = selectedPayment && p.stringId === selectedPayment.stringId;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={p.stringId}
                  role="option"
                  aria-selected={isSelected}
                  className="searchable-payment-item"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelectPayment(p);
                  }}
                  onClick={() => handleSelectPayment(p)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '10px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    cursor: 'pointer',
                    background: isSelected
                      ? '#eff6ff'
                      : isHighlighted
                      ? '#f8fafc'
                      : 'transparent',
                    borderLeft: isSelected ? '3px solid #2563eb' : '3px solid transparent',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background 0.12s ease'
                  }}
                >
                  {/* Top Row: Student Name & Amount */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px'
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        minWidth: 0
                      }}
                    >
                      <strong
                        style={{
                          fontSize: '0.92rem',
                          color: isSelected ? '#1d4ed8' : '#0f172a',
                          fontWeight: '700',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {p.studentName}
                      </strong>
                      {isSelected && (
                        <span
                          style={{
                            color: '#2563eb',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Icon name="check" size={14} />
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        fontWeight: '700',
                        fontSize: '0.86rem',
                        color: '#15803d',
                        background: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      ₹{p.amount.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Bottom Row: Receipt ID Badge, Phone Number, Date & Details */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      fontSize: '0.78rem',
                      color: '#64748b'
                    }}
                  >
                    {/* Receipt ID Tag */}
                    <span
                      style={{
                        background: '#f1f5f9',
                        color: '#1e293b',
                        fontFamily: 'monospace',
                        fontWeight: '700',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0',
                        fontSize: '0.74rem'
                      }}
                    >
                      {p.receiptNo}
                    </span>

                    {/* Contact Number */}
                    {p.phone && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          color: '#475569',
                          fontWeight: '500'
                        }}
                      >
                        <span style={{ fontSize: '0.72rem' }}>📞</span>
                        {p.phone}
                      </span>
                    )}

                    {/* Date */}
                    {p.dateStr && (
                      <span style={{ color: '#64748b' }}>
                        📅 {p.dateStr}
                      </span>
                    )}

                    {/* Course or Extra Description */}
                    {(p.course || p.extraDesc) && (
                      <span
                        style={{
                          color: '#64748b',
                          fontStyle: 'italic',
                          maxWidth: '220px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        • {p.course || p.extraDesc}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

