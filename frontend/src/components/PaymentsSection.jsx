import React, { useState, useRef, useCallback, useEffect } from 'react';
import Icon from './Icons';
import {
  FEE_ITEMS,
  feeBreakdownTotals,
  numberToIndianWords,
  fmtDate,
  isoDay,
  parseDate,
  sod,
  ORG
} from '../utils/helpers';
import api from '../services/api';

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function PaymentsSection({
  fees = [],
  enquiries = [], students = [],
  loading = false,
  onSavePayment,
  onDeletePayment,
  onToast
}) {
  const [feeTab, setFeeTab] = useState('dashboard'); // 'dashboard' | 'payment' | 'history' | 'receipt'

  // Smart search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const dropdownRef = useRef(null);

  const [batch, setBatch] = useState('');
  const [feeMonth, setFeeMonth] = useState(isoDay(new Date()).slice(0, 7));
  const [relation, setRelation] = useState('');
  const [paymentDate, setPaymentDate] = useState(isoDay(new Date()));
  const [notes, setNotes] = useState('');
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Particulars breakdown — now includes 'online'
  const [breakdown, setBreakdown] = useState(
    Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0, online: 0 }]))
  );

  const handleBreakdownChange = (key, mode, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setBreakdown(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [mode]: num
      }
    }));
  };

  const totals = feeBreakdownTotals(breakdown);
  const totalAmount = (totals.cash + totals.cheque + totals.online).toFixed(2);

  // ── Smart Student Search ──
  const debouncedQuery = useDebounce(searchQuery, 350);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const results = await api.searchStudents(debouncedQuery);
        if (!cancelled) {
          setSearchResults(results);
          setShowDropdown(true);
        }
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectStudent = useCallback((student) => {
    setSelectedStudent(student);
    setSearchQuery(student.name);
    setShowDropdown(false);
    // Auto-fill guardian name
    setRelation(student.guardianName || '');
    // Auto-fill batch from course info
    setBatch(student.courses || '');
  }, []);

  const handleClearForm = () => {
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
    setBatch('');
    setFeeMonth(isoDay(new Date()).slice(0, 7));
    setRelation('');
    setPaymentDate(isoDay(new Date()));
    setNotes('');
    setBreakdown(Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0, online: 0 }])));
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      onToast("Search and pick a student first.", true);
      return;
    }
    if (!(parseFloat(totalAmount) > 0)) {
      onToast("Enter at least one fee amount in the breakdown table.", true);
      return;
    }

    setSavingPayment(true);
    const modes = [];
    if (totals.cash) modes.push("Cash");
    if (totals.cheque) modes.push("Cheque");
    if (totals.online) modes.push("UPI/Online");
    const mode = modes.join(" + ") || "Cash";

    const payload = {
      enquiryId: Number(selectedStudent.id),
      amount: parseFloat(totalAmount),
      paymentDate: paymentDate || isoDay(new Date()),
      mode,
      notes: notes.trim(),
      receiptDetails: {
        batch: batch.trim() || selectedStudent.courses || '',
        month: feeMonth,
        relation: relation.trim(),
        items: breakdown
      }
    };

    try {
      await onSavePayment(payload);
      handleClearForm();
      setFeeTab('history');
    } catch (err) {
      onToast(err.message || "Unable to save fee payment.", true);
    } finally {
      setSavingPayment(false);
    }
  };

  // Issue Printable Receipt
  const handleIssueReceipt = async () => {
    const feeId = selectedReceiptPaymentId || (fees.length > 0 ? fees[0].id : null);
    if (!feeId) {
      onToast("Select a recorded payment first.", true);
      return;
    }

    const fee = fees.find(f => String(f.id) === String(feeId));
    if (!fee) return;

    const receiptWin = window.open("", "_blank", "width=820,height=750");
    if (!receiptWin) {
      onToast("Allow pop-ups to print the receipt.", true);
      return;
    }

    let receiptNumber = `LBSTI-${new Date().getFullYear()}-${String(fee.id).padStart(6, '0')}`;
    try {
      const issued = await api.issueReceipt(fee.id);
      if (issued && issued.receiptNumber) receiptNumber = issued.receiptNumber;
    } catch (err) {
      // Continue with default number
    }

    const enquiry = students.find(e => String(e.id) === String(fee.enquiryId)) || {};
    const details = fee.receiptDetails || {};
    const items = details.items && typeof details.items === 'object' ? details.items : {
      others: {
        cash: fee.mode === "Cheque" ? 0 : Number(fee.amount || 0),
        cheque: fee.mode === "Cheque" ? Number(fee.amount || 0) : 0,
        online: 0
      }
    };

    const feeTotals = feeBreakdownTotals(Object.assign(
      Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0, online: 0 }])),
      items
    ));
    const total = feeTotals.cash + feeTotals.cheque + feeTotals.online || Number(fee.amount || 0);
    const monthValue = details.month || "";
    const monthLabel = monthValue ? new Date(`${monthValue}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "–";
    const amountWords = numberToIndianWords(total);

    const rowsHtml = FEE_ITEMS.map(([key, label], index) => {
      const item = items[key] || {};
      const cash = Number(item.cash) || 0;
      const cheque = Number(item.cheque) || 0;
      const online = Number(item.online) || 0;
      const itemTotal = cash + cheque + online;
      return `
        <tr>
          <td>${index + 1}.</td>
          <th scope="row">${label}</th>
          <td>${cash ? `₹${cash.toLocaleString("en-IN")}` : ''}</td>
          <td>${cheque ? `₹${cheque.toLocaleString("en-IN")}` : ''}</td>
          <td>${online ? `₹${online.toLocaleString("en-IN")}` : ''}</td>
          <td>${itemTotal ? `₹${itemTotal.toLocaleString("en-IN")}` : ''}</td>
        </tr>
      `;
    }).join("");

    const displayModes = [];
    if (feeTotals.cash) displayModes.push("Cash");
    if (feeTotals.cheque) displayModes.push("Cheque");
    if (feeTotals.online) displayModes.push("UPI/Online");
    const displayMode = displayModes.join(" and ") || "Cash";

    receiptWin.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${receiptNumber}</title>
        <style>
          *{box-sizing:border-box}
          body{font:14px Arial,sans-serif;color:#273044;margin:24px auto;max-width:760px;padding:24px}
          header{text-align:center;border-bottom:2px solid #c95f58;padding-bottom:14px;margin-bottom:16px}
          h1{font-size:22px;color:#a84e49;margin:0 0 5px}
          header p{margin:0;color:#596275}
          .topline,.studentline{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 0;border-bottom:1px solid #cbd0d8}
          .topline div:last-child{text-align:right}
          .studentline{grid-template-columns:1fr 1fr}
          .studentline div{padding:4px 0}
          .receipt-title{text-align:center;font-weight:700;margin:16px 0 8px;font-size:16px;color:#173a80}
          table{width:100%;border-collapse:collapse;margin:12px 0}
          th,td{border:1px solid #aeb6c2;padding:8px 9px;text-align:left}
          thead th{color:#b2544e;background:#fff7f5}
          tbody td:first-child{width:38px}
          tbody td:nth-child(n+3),tfoot td{text-align:right}
          .total-row th,.total-row td{font-weight:700}
          .words{padding:8px 0;border-bottom:1px dotted #8b929e;margin-top:10px}
          .note{font-size:12px;margin-top:22px;color:#6b7280}
          .signatures{display:flex;justify-content:space-between;margin-top:44px}
          .signatures span{min-width:150px;border-top:1px solid #717987;text-align:center;padding-top:6px}
          .receipt-meta{font-size:12px;color:#5f6877;margin-top:12px}
          button{margin-top:24px;padding:10px 18px;border:0;background:#173a80;color:#fff;border-radius:6px;cursor:pointer;font-weight:bold}
          @media print{body{margin:0 auto;padding:12px}button{display:none}}
        </style>
      </head>
      <body>
        <header>
          <h1>${ORG.fullName}</h1>
          <p>${ORG.domain || ""}</p>
        </header>
        <div class="topline">
          <div><b>Form No.:</b> ${receiptNumber}</div>
          <div><b>Date:</b> ${fmtDate(fee.paymentDate)}</div>
        </div>
        <div class="studentline">
          <div><b>Course:</b> ${enquiry?.course || fee.course || "–"}</div>
          <div><b>Batch:</b> ${details.batch || enquiry.batch || "–"}</div>
          <div><b>To Month:</b> ${monthLabel}</div>
          <div><b>Received with thanks from:</b> ${fee.studentName || enquiry?.name || "Student"}</div>
          <div style="grid-column:1/-1"><b>Son/Daughter/Wife of:</b> ${details.relation || "–"}</div>
        </div>
        <div class="receipt-title">OFFICIAL FEE RECEIPT</div>
        <table>
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Particulars</th>
              <th>Cash</th>
              <th>Cheque</th>
              <th>UPI/Online</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="2">TOTAL</th>
              <td>₹${feeTotals.cash.toLocaleString("en-IN")}</td>
              <td>₹${feeTotals.cheque.toLocaleString("en-IN")}</td>
              <td>₹${feeTotals.online.toLocaleString("en-IN")}</td>
              <td class="total-row">₹${total.toLocaleString("en-IN")}</td>
            </tr>
          </tfoot>
        </table>
        <div class="words"><b>Amount in words:</b> ${amountWords}</div>
        <div class="receipt-meta">
          <b>Payment mode:</b> ${displayMode} ${fee.notes ? ` &nbsp; <b>Remarks:</b> ${fee.notes}` : ''}
        </div>
        <p class="note"><b>Note:</b> Fee once deposited will not be refundable in any condition.</p>
        <div class="signatures">
          <span>Student / Payer</span>
          <span>Authorized Signature</span>
        </div>
        <button onclick="window.print()">Print / Save as PDF</button>
      </body>
      </html>
    `);
    receiptWin.document.close();
  };

  const handleExportFeesCSV = () => {
    if (!fees.length) {
      onToast("Nothing to export", true);
      return;
    }
    const itemColumns = FEE_ITEMS.flatMap(([key, label]) => [
      [key, `${label} Cash`],
      [key, `${label} Cheque`],
      [key, `${label} UPI/Online`]
    ]);
    const headers = [
      "Form No.", "Student", "Course", "Batch", "Fee month", "Relation",
      ...itemColumns.map(([, label]) => label),
      "Total", "Mode", "Date", "Received by", "Notes"
    ];
    const escapeCsv = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...fees.map((f) => {
        const enquiry = students.find(e => String(e.id) === String(f.enquiryId)) || {};
        const details = f.receiptDetails || {};
        const items = details.items || {
          others: {
            cash: f.mode === "Cheque" ? 0 : Number(f.amount || 0),
            cheque: f.mode === "Cheque" ? Number(f.amount || 0) : 0,
            online: 0
          }
        };
        const breakdownValues = itemColumns.map(([key, modeLabel]) => {
          const m = modeLabel.toLowerCase().endsWith("cash") ? "cash" : modeLabel.toLowerCase().endsWith("cheque") ? "cheque" : "online";
          return Number((items[key] || {})[m]) || 0;
        });

        const receiptNo = `LBSTI-${new Date(f.paymentDate || Date.now()).getFullYear()}-${String(f.id).padStart(6, '0')}`;

        return [
          receiptNo,
          f.studentName || enquiry.name || "Unknown",
          enquiry.course || f.course || "",
          details.batch || enquiry.batch || "",
          details.month || "",
          details.relation || "",
          ...breakdownValues,
          f.amount,
          f.mode,
          f.paymentDate ? isoDay(parseDate(f.paymentDate)) : "",
          f.receivedBy || "Admin",
          f.notes || ""
        ].map(escapeCsv).join(",");
      })
    ].join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fee-payments-${isoDay(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    onToast(`Exported ${fees.length} fee payment records`);
  };

  // Dashboard calculations
  const totalCollected = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthFees = fees.filter(f => {
    const d = parseDate(f.paymentDate);
    return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthTotal = monthFees.reduce((sum, f) => sum + (f.amount || 0), 0);
  const avgPayment = fees.length ? Math.round(totalCollected / fees.length) : 0;

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Payments</h2>
          <p>Manage fee payments, breakdown particulars, and official receipts.</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="tabs fees-tabs" role="tablist">
        <button
          className="fee-tab"
          type="button"
          role="tab"
          aria-selected={feeTab === 'dashboard'}
          onClick={() => setFeeTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className="fee-tab"
          type="button"
          role="tab"
          aria-selected={feeTab === 'payment'}
          onClick={() => setFeeTab('payment')}
        >
          Record Payment
        </button>
        <button
          className="fee-tab"
          type="button"
          role="tab"
          aria-selected={feeTab === 'history'}
          onClick={() => setFeeTab('history')}
        >
          Payment History
        </button>
        <button
          className="fee-tab"
          type="button"
          role="tab"
          aria-selected={feeTab === 'receipt'}
          onClick={() => setFeeTab('receipt')}
        >
          Issue Receipt
        </button>
      </div>

      {/* 1. Dashboard Tab */}
      {feeTab === 'dashboard' && (
        <section>
          <div className="stats">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="card skel" style={{ height: '118px' }} />
              ))
            ) : (
              <>
                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="award" size={20} /></span>
                    <span className="stat-label">Total collected</span>
                  </div>
                  <div className="stat-val">₹{totalCollected.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">
                    {fees.length} {fees.length === 1 ? 'payment recorded' : 'payments recorded'}
                  </div>
                </div>

                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="clock" size={20} /></span>
                    <span className="stat-label">Collected this month</span>
                  </div>
                  <div className="stat-val">₹{monthTotal.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">
                    {monthFees.length} {monthFees.length === 1 ? 'payment' : 'payments'} this month
                  </div>
                </div>

                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="users" size={20} /></span>
                    <span className="stat-label">Average payment</span>
                  </div>
                  <div className="stat-val">₹{avgPayment.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">Across all recorded payments</div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* 2. Record Payment Tab */}
      {feeTab === 'payment' && (
        <section>
          <form className="card form-card" onSubmit={handleSubmitPayment} noValidate>
            <div className="form-body">
              <h3>Record a payment</h3>
              <p className="lead">Search for an enrolled student by Name, Student ID, or Phone number.</p>

              <div className="fgrid">
                {/* Smart Student Search */}
                <div className="fld full" ref={dropdownRef} style={{ position: 'relative' }}>
                  <label htmlFor="fee-student-search">Student <em>*</em></label>
                  <input
                    className="input"
                    id="fee-student-search"
                    placeholder="Type student name, ID (e.g. S1001), or phone number..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (selectedStudent) setSelectedStudent(null);
                    }}
                    onFocus={() => { if (searchResults.length) setShowDropdown(true); }}
                    autoComplete="off"
                    style={selectedStudent ? { borderColor: '#00C49F', background: '#f0fdf4' } : {}}
                  />
                  {searching && (
                    <div style={{ position: 'absolute', right: '12px', top: '38px', color: '#64748b', fontSize: '13px' }}>
                      Searching...
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {showDropdown && searchResults.length > 0 && !selectedStudent && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)', maxHeight: '280px', overflowY: 'auto',
                      marginTop: '4px'
                    }}>
                      {searchResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectStudent(s)}
                          style={{
                            display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left',
                            border: 'none', borderBottom: '1px solid #f1f5f9', background: 'none',
                            cursor: 'pointer', fontSize: '14px', transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>
                            {s.name}
                            <span style={{ fontWeight: 400, color: '#64748b', marginLeft: '8px', fontSize: '13px' }}>
                              {s.studentId}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            📞 {s.phone || 'N/A'}
                            {s.courses && <> &nbsp;·&nbsp; 📚 {s.courses}</>}
                            {s.guardianName && <> &nbsp;·&nbsp; 👤 {s.guardianName}</>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {showDropdown && searchResults.length === 0 && searchQuery.length >= 2 && !searching && !selectedStudent && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)', padding: '16px', textAlign: 'center',
                      color: '#94a3b8', marginTop: '4px'
                    }}>
                      No students found matching "{searchQuery}"
                    </div>
                  )}
                </div>

                {/* Selected Student Info Badge */}
                {selectedStudent && (
                  <div className="fld full" style={{ padding: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #86efac',
                      borderRadius: '10px', padding: '14px 18px', gap: '16px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#166534' }}>
                          ✅ {selectedStudent.name}
                          <span style={{ fontWeight: 400, color: '#4ade80', marginLeft: '8px', fontSize: '13px' }}>
                            {selectedStudent.studentId}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>
                          📞 {selectedStudent.phone || 'N/A'}
                          {selectedStudent.courseDetails && <> &nbsp;·&nbsp; 📚 {selectedStudent.courseDetails}</>}
                          {selectedStudent.enrollmentCount > 0 && <> &nbsp;·&nbsp; {selectedStudent.enrollmentCount} enrollment(s)</>}
                        </div>
                      </div>
                      <button type="button" onClick={() => { setSelectedStudent(null); setSearchQuery(''); }}
                        style={{ border: 'none', background: '#dc2626', color: '#fff', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        Change
                      </button>
                    </div>
                  </div>
                )}

                <div className="fld">
                  <label htmlFor="fee-batch">Batch / Course</label>
                  <input
                    className="input"
                    id="fee-batch"
                    placeholder="Auto-filled from student record"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                    readOnly={!!selectedStudent}
                    style={selectedStudent ? { background: '#f9fafb', color: '#4b5563' } : {}}
                  />
                </div>

                <div className="fld">
                  <label htmlFor="fee-month">Fee for month</label>
                  <input
                    className="input"
                    id="fee-month"
                    type="month"
                    value={feeMonth}
                    onChange={(e) => setFeeMonth(e.target.value)}
                  />
                </div>

                <div className="fld full">
                  <label htmlFor="fee-relation">Son / Daughter / Wife of</label>
                  <input
                    className="input"
                    id="fee-relation"
                    placeholder="Auto-filled from student's Guardian Name"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    readOnly={!!selectedStudent}
                    style={selectedStudent ? { background: '#f9fafb', color: '#4b5563' } : {}}
                  />
                </div>

                {/* Particulars Breakdown Table — with UPI/Online column */}
                <div className="fld full fee-breakdown-field">
                  <span className="field-label">Fee particulars breakdown</span>
                  <div className="fee-breakdown-wrap">
                    <table className="fee-breakdown">
                      <thead>
                        <tr>
                          <th scope="col">Particulars</th>
                          <th scope="col">Cash (₹)</th>
                          <th scope="col">Cheque (₹)</th>
                          <th scope="col">UPI / Online (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {FEE_ITEMS.map(([key, label]) => (
                          <tr key={key}>
                            <th scope="row">{label}</th>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={breakdown[key]?.cash || 0}
                                onChange={(e) => handleBreakdownChange(key, 'cash', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={breakdown[key]?.cheque || 0}
                                onChange={(e) => handleBreakdownChange(key, 'cheque', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={breakdown[key]?.online || 0}
                                onChange={(e) => handleBreakdownChange(key, 'online', e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Total</th>
                          <td>₹{totals.cash.toLocaleString("en-IN")}</td>
                          <td>₹{totals.cheque.toLocaleString("en-IN")}</td>
                          <td>₹{totals.online.toLocaleString("en-IN")}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Total Calculated Amount — Strictly Read-Only */}
                <div className="fld">
                  <label htmlFor="fee-amount">Total amount (₹) <em>*</em></label>
                  <input
                    className="input"
                    id="fee-amount"
                    type="text"
                    value={`₹ ${Number(totalAmount).toLocaleString("en-IN")}`}
                    readOnly
                    style={{ fontWeight: 700, fontSize: '18px', background: '#f0f9ff', color: '#0369a1', border: '2px solid #0ea5e9' }}
                  />
                  {parseFloat(totalAmount) > 0 && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                      {numberToIndianWords(parseFloat(totalAmount))}
                    </div>
                  )}
                </div>

                <div className="fld">
                  <label htmlFor="fee-date">Payment date</label>
                  <input
                    className="input"
                    id="fee-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="fld full">
                  <label htmlFor="fee-notes">Notes</label>
                  <input
                    className="input"
                    id="fee-notes"
                    placeholder="e.g. First installment, admission fee"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn" type="button" onClick={handleClearForm}>
                Clear
              </button>
              <button
                className="btn primary"
                type="submit"
                disabled={savingPayment}
              >
                {savingPayment ? 'Saving…' : 'Save payment'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 3. Payment History Tab */}
      {feeTab === 'history' && (
        <section>
          <div className="card section">
            <div className="card-head">
              <div>
                <h3>Payment history</h3>
                <p>All fee payments recorded, newest first.</p>
              </div>
              <button
                className="btn"
                type="button"
                aria-label="Export CSV"
                title="Export CSV"
                onClick={handleExportFeesCSV}
              >
                <span className="ic"><Icon name="download" size={18} /></span>
              </button>
            </div>

            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Mode</th>
                    <th scope="col">Date</th>
                    <th scope="col">Received by</th>
                    <th scope="col">Notes</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7">
                        <div className="skel" style={{ height: '160px' }} />
                      </td>
                    </tr>
                  ) : fees.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="empty">
                          <div className="ei"><Icon name="fee" size={24} /></div>
                          <b>No payments recorded yet</b>
                          <span>Record your first fee payment using the Record Payment tab.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    fees.map((f) => (
                      <tr key={f.id}>
                        <td>{f.studentName || "Student"}</td>
                        <td>₹{Number(f.amount || 0).toLocaleString("en-IN")}</td>
                        <td>{f.mode}</td>
                        <td>{fmtDate(f.paymentDate)}</td>
                        <td>{f.receivedBy || "–"}</td>
                        <td>{f.notes || "–"}</td>
                        <td>
                          <button
                            className="btn sm danger"
                            type="button"
                            onClick={() => onDeletePayment(f.id)}
                          >
                            <span className="ic"><Icon name="trash" size={14} /></span> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 4. Issue Receipt Tab */}
      {feeTab === 'receipt' && (
        <section>
          <div className="card section fee-receipt-tool">
            <div className="card-head">
              <div>
                <h3>Issue a fee receipt</h3>
                <p>Select a payment to print or download its official formatted receipt.</p>
              </div>
            </div>

            <div className="fee-receipt-actions">
              <div className="fld">
                <label htmlFor="receiptPayment">Payment record</label>
                <select
                  className="select"
                  id="receiptPayment"
                  value={selectedReceiptPaymentId}
                  onChange={(e) => setSelectedReceiptPaymentId(e.target.value)}
                >
                  <option value="">Select a payment...</option>
                  {fees.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.studentName || "Student"} — ₹{Number(f.amount || 0).toLocaleString("en-IN")} — {fmtDate(f.paymentDate)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn primary"
                type="button"
                onClick={handleIssueReceipt}
              >
                Issue Receipt
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
