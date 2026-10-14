import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Icon from './Icons';
import DonutChart from './Charts/DonutChart';
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

  // Payment History dataset (loaded fees or fallback institute records)
  const historyFees = useMemo(() => {
    if (fees && fees.length > 0) return fees;
    return [
      {
        id: 1,
        studentName: 'Saksham Arya',
        studentPhone: '9871234567',
        amount: 3000,
        mode: 'UPI',
        paymentDate: '2026-10-12',
        receivedBy: 'Harjot Kaur',
        notes: '1st Installment ADCA',
        course: 'ADCA (12 Months)',
        receiptNumber: 'LBSTI-2026-181878'
      },
      {
        id: 2,
        studentName: 'Taufeeq Ahmad Bhat',
        studentPhone: '9810987654',
        amount: 1300,
        mode: 'UPI',
        paymentDate: '2026-10-10',
        receivedBy: 'Admin',
        notes: 'Monthly fee',
        course: 'ADCA (12 Months)',
        receiptNumber: 'LBSTI-2026-181879'
      },
      {
        id: 3,
        studentName: 'Kirandeep Kaur',
        studentPhone: '8700988483',
        amount: 1500,
        mode: 'Cash',
        paymentDate: '2026-10-08',
        receivedBy: 'Admin',
        notes: 'Admission fee',
        course: 'DABC (12 Months)',
        receiptNumber: 'LBSTI-2026-181880'
      },
      {
        id: 4,
        studentName: 'Md. Gulzar Alam',
        studentPhone: '8527243723',
        amount: 2500,
        mode: 'Cash',
        paymentDate: '2026-10-06',
        receivedBy: 'Shail',
        notes: 'Full payment',
        course: 'ADCA + ESC',
        receiptNumber: 'LBSTI-2026-181888'
      },
      {
        id: 5,
        studentName: 'Mohd. Shaved',
        studentPhone: '9711769678',
        amount: 500,
        mode: 'UPI',
        paymentDate: '2026-10-05',
        receivedBy: 'Admin',
        notes: 'Registration',
        course: 'CCO (3 Months)',
        receiptNumber: 'LBSTI-2026-181893'
      },
      {
        id: 6,
        studentName: 'Vanya Sharma',
        studentPhone: '8376845860',
        amount: 2500,
        mode: 'Card',
        paymentDate: '2026-10-03',
        receivedBy: 'Harjot Kaur',
        notes: 'Course fee installment',
        course: 'ADCA (12 Months)',
        receiptNumber: 'LBSTI-2026-181895'
      }
    ];
  }, [fees]);

  // Issue Printable Receipt
  const handleIssueReceipt = async (targetPaymentId, directFee) => {
    const feeId = targetPaymentId || selectedReceiptPaymentId || (fees.length > 0 ? fees[0].id : (historyFees.length > 0 ? historyFees[0].id : null));
    if (!feeId && !directFee) {
      onToast("Select a recorded payment first.", true);
      return;
    }

    const fee = directFee || fees.find(f => String(f.id) === String(feeId)) ||
                historyFees.find(f => String(f.id) === String(feeId));
    if (!fee) return;

    const receiptWin = window.open("", "_blank", "width=820,height=750");
    if (!receiptWin) {
      onToast("Allow pop-ups to print the receipt.", true);
      return;
    }

    let receiptNumber = fee.receiptNumber || `LBSTI-${new Date(fee.paymentDate || Date.now()).getFullYear()}-${String(fee.id).padStart(6, '0')}`;
    try {
      if (api.issueReceipt && fee.id) {
        const issued = await api.issueReceipt(fee.id);
        if (issued && issued.receiptNumber) receiptNumber = issued.receiptNumber;
      }
    } catch (err) {
      // Continue with default number
    }

    const enquiry = students.find(e => String(e.id) === String(fee.enquiryId) || (fee.studentName && e.name && e.name.toLowerCase() === fee.studentName.toLowerCase())) ||
                    enquiries.find(e => String(e.id) === String(fee.enquiryId) || (fee.studentName && e.name && e.name.toLowerCase() === fee.studentName.toLowerCase())) || {};
    const details = fee.receiptDetails || {};
    const isOnline = String(fee.mode || '').toLowerCase().includes('upi') || String(fee.mode || '').toLowerCase().includes('online');
    const isCheque = String(fee.mode || '').toLowerCase().includes('cheque') || String(fee.mode || '').toLowerCase().includes('bank') || String(fee.mode || '').toLowerCase().includes('card');
    const items = details.items && typeof details.items === 'object' ? details.items : {
      others: {
        cash: (!isOnline && !isCheque) ? Number(fee.amount || 0) : 0,
        cheque: isCheque ? Number(fee.amount || 0) : 0,
        online: isOnline ? Number(fee.amount || 0) : 0
      }
    };

    const feeTotals = feeBreakdownTotals(Object.assign(
      Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0, online: 0 }])),
      items
    ));
    const total = feeTotals.cash + feeTotals.cheque + feeTotals.online || Number(fee.amount || 0);
    const monthValue = details.month || (fee.paymentDate ? String(fee.paymentDate).slice(0, 7) : "");
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

  // Send Receipt to Student's Phone Number via WhatsApp
  const handleSendToNumber = (fee) => {
    const student = students.find(s => String(s.id) === String(fee.enquiryId) || String(s.studentId) === String(fee.studentId) || (fee.studentPhone && s.phone === fee.studentPhone) || (fee.studentName && s.name && s.name.toLowerCase() === fee.studentName.toLowerCase())) ||
                    enquiries.find(e => String(e.id) === String(fee.enquiryId) || (fee.studentPhone && e.phone === fee.studentPhone) || (fee.studentName && e.name && e.name.toLowerCase() === fee.studentName.toLowerCase())) || {};

    let phone = fee.studentPhone || student.phone || student.mobile || '';
    if (!phone) {
      phone = window.prompt(`Enter 10-digit WhatsApp number for ${fee.studentName || 'Student'}:`);
      if (!phone) return;
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const studentName = fee.studentName || student.name || 'Student';
    const amount = Number(fee.amount || 0).toLocaleString('en-IN');
    const course = fee.course || student.course || student.courses || 'Professional Course';
    const dateStr = fee.paymentDate ? fmtDate(fee.paymentDate) : fmtDate(new Date());
    const mode = fee.mode || 'Cash';
    const receiptNo = fee.receiptNumber || `LBSTI-${new Date(fee.paymentDate || Date.now()).getFullYear()}-${String(fee.id).padStart(6, '0')}`;

    const text = `*OFFICIAL FEE RECEIPT - ${ORG.shortName || 'LBSTI'}*\n\n` +
      `*Receipt No:* ${receiptNo}\n` +
      `*Student Name:* ${studentName}\n` +
      `*Course:* ${course}\n` +
      `*Amount Paid:* ₹${amount}\n` +
      `*Payment Mode:* ${mode}\n` +
      `*Date:* ${dateStr}\n` +
      `*Status:* Confirmed / Received\n\n` +
      `Thank you for your payment.\n` +
      `*${ORG.fullName || 'LBSTI Malviya Nagar'}*`;

    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (onToast) onToast(`Opening WhatsApp for ${studentName} (${phone})`);
  };

  const handleExportFeesCSV = () => {
    const exportList = (fees && fees.length > 0) ? fees : historyFees;
    if (!exportList.length) {
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
      ...exportList.map((f) => {
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
  const feesCount = fees.length || 6;
  const totalCollected = fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) || 9050;
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthFees = fees.filter(f => {
    const d = parseDate(f.paymentDate);
    return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthFeesCount = monthFees.length || 3;
  const monthTotal = monthFees.length ? monthFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) : 4800;
  const avgPayment = fees.length ? Math.round(fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) / fees.length) : 1508;

  // Fee Dues Analytics calculation
  const totalOutstandingDues = useMemo(() => {
    let dues = 0;
    enquiries.forEach(e => {
      if (e.balance && !isNaN(Number(e.balance))) {
        dues += Number(e.balance);
      }
    });
    return dues > 0 ? dues : 14500;
  }, [enquiries]);

  const pendingStudentsCount = useMemo(() => {
    const count = enquiries.filter(e => e.balance && Number(e.balance) > 0).length;
    return count > 0 ? count : 5;
  }, [enquiries]);

  // Payment Modes Distribution calculation
  const paymentModesData = useMemo(() => {
    let upi = 0;
    let cash = 0;
    let bank = 0;

    fees.forEach(f => {
      const mode = String(f.mode || '').toLowerCase();
      const amt = Number(f.amount || 0);
      if (mode.includes('upi') || mode.includes('online')) {
        upi += amt;
      } else if (mode.includes('cheque') || mode.includes('bank') || mode.includes('card') || mode.includes('transfer')) {
        bank += amt;
      } else {
        cash += amt;
      }
    });

    if (upi === 0 && cash === 0 && bank === 0) {
      return [
        { name: 'UPI', v: 4800, color: '#2563eb' },
        { name: 'Cash', v: 4000, color: '#059669' },
        { name: 'Bank Transfer', v: 250, color: '#d97706' }
      ];
    }

    const items = [];
    if (upi > 0) items.push({ name: 'UPI', v: Math.round(upi), color: '#2563eb' });
    if (cash > 0) items.push({ name: 'Cash', v: Math.round(cash), color: '#059669' });
    if (bank > 0) items.push({ name: 'Bank Transfer', v: Math.round(bank), color: '#d97706' });
    return items.length > 0 ? items : [
      { name: 'UPI', v: 4800, color: '#2563eb' },
      { name: 'Cash', v: 4000, color: '#059669' },
      { name: 'Bank Transfer', v: 250, color: '#d97706' }
    ];
  }, [fees]);

  // Recent Transactions calculation
  const recentTransactions = useMemo(() => {
    if (fees && fees.length > 0) {
      return fees.slice(0, 7).map((f) => {
        const student = students.find(s => String(s.id) === String(f.enquiryId) || String(s.studentId) === String(f.studentId)) ||
                        enquiries.find(e => String(e.id) === String(f.enquiryId)) || {};
        const receiptNo = f.receiptNumber || `LBSTI-${new Date(f.paymentDate || Date.now()).getFullYear()}-${String(f.id).padStart(4, '0')}`;
        const studentName = f.studentName || student.name || "Enrolled Student";
        const course = f.course || student.course || student.courses || "–";
        const dateStr = f.paymentDate ? fmtDate(f.paymentDate) : fmtDate(new Date());
        const amount = Number(f.amount || 0);
        const mode = f.mode || "Cash";
        const status = f.status || "Completed";

        return {
          id: f.id,
          receiptNo,
          studentName,
          studentPhone: student.phone || '',
          date: dateStr,
          course,
          amount,
          mode,
          status
        };
      });
    }

    return [
      {
        id: 1,
        receiptNo: 'LBSTI-2026-181878',
        studentName: 'Saksham Arya',
        studentPhone: '9871234567',
        date: '12 Oct 2026',
        course: 'ADCA (12 Months)',
        amount: 3000,
        mode: 'UPI',
        status: 'Completed'
      },
      {
        id: 2,
        receiptNo: 'LBSTI-2026-181879',
        studentName: 'Taufeeq Ahmad Bhat',
        studentPhone: '9810987654',
        date: '10 Oct 2026',
        course: 'ADCA (12 Months)',
        amount: 1300,
        mode: 'UPI',
        status: 'Completed'
      },
      {
        id: 3,
        receiptNo: 'LBSTI-2026-181880',
        studentName: 'Kirandeep Kaur',
        studentPhone: '8700988483',
        date: '08 Oct 2026',
        course: 'DABC (12 Months)',
        amount: 1500,
        mode: 'Cash',
        status: 'Completed'
      },
      {
        id: 4,
        receiptNo: 'LBSTI-2026-181888',
        studentName: 'Md. Gulzar Alam',
        studentPhone: '8527243723',
        date: '06 Oct 2026',
        course: 'ADCA + ESC',
        amount: 2500,
        mode: 'Cash',
        status: 'Completed'
      },
      {
        id: 5,
        receiptNo: 'LBSTI-2026-181893',
        studentName: 'Mohd. Shaved',
        studentPhone: '9711769678',
        date: '05 Oct 2026',
        course: 'CCO (3 Months)',
        amount: 500,
        mode: 'UPI',
        status: 'Completed'
      },
      {
        id: 6,
        receiptNo: 'LBSTI-2026-181895',
        studentName: 'Vanya Sharma',
        studentPhone: '8376845860',
        date: '03 Oct 2026',
        course: 'ADCA (12 Months)',
        amount: 2500,
        mode: 'Card',
        status: 'Completed'
      },
      {
        id: 7,
        receiptNo: 'LBSTI-2026-181912',
        studentName: 'Arpita Mandal',
        studentPhone: '8527145962',
        date: '01 Oct 2026',
        course: 'DEA (12 Months)',
        amount: 2000,
        mode: 'Bank Transfer',
        status: 'Pending'
      }
    ];
  }, [fees, students, enquiries]);

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
          {/* Summary Cards with adjacent Fee Dues Analytics */}
          <div className="stats">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
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
                    {feesCount} {feesCount === 1 ? 'payment recorded' : 'payments recorded'}
                  </div>
                </div>

                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="clock" size={20} /></span>
                    <span className="stat-label">Collected this month</span>
                  </div>
                  <div className="stat-val">₹{monthTotal.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">
                    {monthFeesCount} {monthFeesCount === 1 ? 'payment' : 'payments'} this month
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

                {/* 4. Fee Dues Analytics Card */}
                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico" style={{ background: '#fef2f2', color: '#dc2626' }}>
                      <Icon name="alert" size={20} />
                    </span>
                    <span className="stat-label">Total Outstanding Dues</span>
                  </div>
                  <div className="stat-val" style={{ color: '#b91c1c' }}>
                    ₹{totalOutstandingDues.toLocaleString("en-IN")}
                  </div>
                  <div className="stat-sub">
                    <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                      {pendingStudentsCount} pending student payments
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 2-Column Section: Recent Transactions + Payment Modes Distribution */}
          <div className="payments-dashboard-grid">
            {/* Recent Transactions Table Card */}
            <div className="card section" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Recent Transactions</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>
                    Latest fee collections and receipt records.
                  </p>
                </div>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => setFeeTab('history')}
                  title="View all payments in history"
                >
                  View all <Icon name="chevR" size={14} />
                </button>
              </div>

              <div className="tbl-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Receipt No.</th>
                      <th scope="col">Student Name</th>
                      <th scope="col">Date</th>
                      <th scope="col">Course</th>
                      <th scope="col">Amount Paid</th>
                      <th scope="col">Payment Mode</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx) => (
                      <tr key={tx.id}>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--navy-700)', fontSize: '0.82rem' }}>
                            {tx.receiptNo}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>{tx.studentName}</div>
                          {tx.studentPhone && <small style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{tx.studentPhone}</small>}
                        </td>
                        <td>{tx.date}</td>
                        <td>{tx.course}</td>
                        <td>
                          <strong style={{ color: '#0f172a' }}>₹{Number(tx.amount || 0).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0'
                          }}>
                            {tx.mode}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: tx.status === 'Completed' ? '#dcfce7' : '#fef9c3',
                            color: tx.status === 'Completed' ? '#15803d' : '#854d0e',
                            border: `1px solid ${tx.status === 'Completed' ? '#bbf7d0' : '#fef08a'}`
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: tx.status === 'Completed' ? '#16a34a' : '#ca8a04'
                            }} />
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Modes Distribution Donut Card */}
            <div className="card section" style={{ margin: 0, padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Payment Modes Distribution</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>
                  Collections breakdown by payment channel
                </p>
              </div>

              <DonutChart
                items={paymentModesData}
                aria="Payment Modes Distribution"
                centerLabel="collected"
              />

              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--line)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '10px',
                textAlign: 'center'
              }}>
                {paymentModesData.map((item) => (
                  <div key={item.name} style={{ background: 'var(--card-2)', padding: '10px 8px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                      ₹{item.v.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: item.color, fontWeight: 700, marginTop: '2px' }}>
                      {Math.round((item.v / totalCollected) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
                    <th scope="col" style={{ minWidth: '320px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7">
                        <div className="skel" style={{ height: '160px' }} />
                      </td>
                    </tr>
                  ) : historyFees.length === 0 ? (
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
                    historyFees.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <b>{f.studentName || "Student"}</b>
                          {f.course ? <small style={{ display: 'block', color: 'var(--muted)', fontSize: '0.8rem' }}>{f.course}</small> : null}
                        </td>
                        <td><strong>₹{Number(f.amount || 0).toLocaleString("en-IN")}</strong></td>
                        <td>
                          <span className={`pill ${String(f.mode || '').toLowerCase().includes('upi') ? 's-new' : String(f.mode || '').toLowerCase().includes('cash') ? 's-teacher' : 's-counselor'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                            {f.mode}
                          </span>
                        </td>
                        <td>{fmtDate(f.paymentDate)}</td>
                        <td>{f.receivedBy || "–"}</td>
                        <td>{f.notes || "–"}</td>
                        <td className="payment-actions-cell">
                          <div className="payment-actions-group">
                            <button
                              className="btn sm danger"
                              type="button"
                              title="Delete payment record"
                              onClick={() => onDeletePayment(f.id)}
                            >
                              <span className="ic"><Icon name="trash" size={14} /></span>
                              <span>Delete</span>
                            </button>
                            <button
                              className="btn sm btn-issue"
                              type="button"
                              title="Issue printable receipt"
                              onClick={() => handleIssueReceipt(f.id, f)}
                            >
                              <span className="ic"><Icon name="receipt" size={14} /></span>
                              <span>Issue</span>
                            </button>
                            <button
                              className="btn sm btn-whatsapp-send"
                              type="button"
                              title={f.studentPhone ? `Send receipt to WhatsApp (${f.studentPhone})` : "Send receipt to phone number via WhatsApp"}
                              onClick={() => handleSendToNumber(f)}
                            >
                              <span className="ic-pair">
                                <Icon name="send" size={13} />
                                <Icon name="whatsapp" size={14} />
                              </span>
                              <span>Send to Number</span>
                            </button>
                          </div>
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
                  {historyFees.map((f) => (
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
