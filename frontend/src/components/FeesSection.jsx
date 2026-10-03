import React, { useState } from 'react';
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

export default function FeesSection({
  fees = [],
  enquiries = [],
  loading = false,
  onSavePayment,
  onDeletePayment,
  onToast
}) {
  const [feeTab, setFeeTab] = useState('dashboard'); // 'dashboard' | 'payment' | 'history' | 'receipt'
  const [searchStudent, setSearchStudent] = useState('');
  const [selectedEnquiryId, setSelectedEnquiryId] = useState('');
  const [batch, setBatch] = useState('');
  const [feeMonth, setFeeMonth] = useState(isoDay(new Date()).slice(0, 7));
  const [relation, setRelation] = useState('');
  const [paymentDate, setPaymentDate] = useState(isoDay(new Date()));
  const [notes, setNotes] = useState('');
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Particulars breakdown
  const [breakdown, setBreakdown] = useState(
    Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0 }]))
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
  const totalAmount = (totals.cash + totals.cheque).toFixed(2);

  // Filter student enquiries for selection
  const needle = searchStudent.trim().toLowerCase();
  const matchedEnquiries = enquiries
    .filter(e => !needle || `${e.name} ${e.phone}`.toLowerCase().includes(needle))
    .slice(0, 50);

  const handleSelectStudent = (id) => {
    setSelectedEnquiryId(id);
    const enquiry = enquiries.find(e => String(e.id) === String(id));
    if (enquiry && enquiry.batch) {
      setBatch(enquiry.batch);
    }
  };

  const handleClearForm = () => {
    setSelectedEnquiryId('');
    setSearchStudent('');
    setBatch('');
    setFeeMonth(isoDay(new Date()).slice(0, 7));
    setRelation('');
    setPaymentDate(isoDay(new Date()));
    setNotes('');
    setBreakdown(Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0 }])));
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedEnquiryId) {
      onToast("Search and pick a student enquiry.", true);
      return;
    }
    if (!(parseFloat(totalAmount) > 0)) {
      onToast("Enter at least one fee amount in the breakdown table.", true);
      return;
    }

    setSavingPayment(true);
    const selectedEnquiry = enquiries.find(e => String(e.id) === String(selectedEnquiryId)) || {};
    const mode = totals.cash && totals.cheque ? "Cash + Cheque" : totals.cheque ? "Cheque" : "Cash";

    const payload = {
      enquiryId: Number(selectedEnquiryId),
      amount: parseFloat(totalAmount),
      paymentDate: paymentDate || isoDay(new Date()),
      mode,
      notes: notes.trim(),
      receiptDetails: {
        batch: batch.trim() || selectedEnquiry.batch || '',
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

    const enquiry = enquiries.find(e => String(e.id) === String(fee.enquiryId)) || {};
    const details = fee.receiptDetails || {};
    const items = details.items && typeof details.items === 'object' ? details.items : {
      others: {
        cash: fee.mode === "Cheque" ? 0 : Number(fee.amount || 0),
        cheque: fee.mode === "Cheque" ? Number(fee.amount || 0) : 0
      }
    };

    const feeTotals = feeBreakdownTotals(Object.assign(
      Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0 }])),
      items
    ));
    const total = feeTotals.cash + feeTotals.cheque || Number(fee.amount || 0);
    const monthValue = details.month || "";
    const monthLabel = monthValue ? new Date(`${monthValue}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "–";
    const amountWords = numberToIndianWords(total);

    const rowsHtml = FEE_ITEMS.map(([key, label], index) => {
      const item = items[key] || {};
      const cash = Number(item.cash) || 0;
      const cheque = Number(item.cheque) || 0;
      const itemTotal = cash + cheque;
      return `
        <tr>
          <td>${index + 1}.</td>
          <th scope="row">${label}</th>
          <td>${cash ? `₹${cash.toLocaleString("en-IN")}` : ''}</td>
          <td>${cheque ? `₹${cheque.toLocaleString("en-IN")}` : ''}</td>
          <td>${itemTotal ? `₹${itemTotal.toLocaleString("en-IN")}` : ''}</td>
        </tr>
      `;
    }).join("");

    const displayMode = feeTotals.cash && feeTotals.cheque ? "Cash and Cheque" : feeTotals.cheque ? "Cheque" : "Cash";

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
          <div><b>Course:</b> ${enquiry.course || fee.course || "–"}</div>
          <div><b>Batch:</b> ${details.batch || enquiry.batch || "–"}</div>
          <div><b>To Month:</b> ${monthLabel}</div>
          <div><b>Received with thanks from:</b> ${fee.studentName || enquiry.name || "Student"}</div>
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
      [key, `${label} Cheque`]
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
        const enquiry = enquiries.find(e => String(e.id) === String(f.enquiryId)) || {};
        const details = f.receiptDetails || {};
        const items = details.items || {
          others: {
            cash: f.mode === "Cheque" ? 0 : Number(f.amount || 0),
            cheque: f.mode === "Cheque" ? Number(f.amount || 0) : 0
          }
        };
        const breakdownValues = itemColumns.map(([key, modeLabel]) => {
          const m = modeLabel.toLowerCase().endsWith("cash") ? "cash" : "cheque";
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
          <h2>Fees Management</h2>
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
              <p className="lead">Log a fee payment against an existing lead or admitted student.</p>

              <div className="fgrid">
                {/* Student Search & Selection */}
                <div className="fld full">
                  <label htmlFor="fee-enquiry-search">Student <em>*</em></label>
                  <input
                    className="input"
                    id="fee-enquiry-search"
                    placeholder="Search by name or phone to find the lead"
                    value={searchStudent}
                    onChange={(e) => setSearchStudent(e.target.value)}
                    autoComplete="off"
                  />
                  <select
                    className="select"
                    id="fee-enquiry"
                    style={{ marginTop: '8px' }}
                    value={selectedEnquiryId}
                    onChange={(e) => handleSelectStudent(e.target.value)}
                  >
                    <option value="">Select a student...</option>
                    {matchedEnquiries.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} — {e.phone} {e.course ? `— ${e.course}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fld">
                  <label htmlFor="fee-batch">Batch</label>
                  <input
                    className="input"
                    id="fee-batch"
                    placeholder="Batch / timing"
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
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
                    placeholder="Parent or guardian name"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                  />
                </div>

                {/* Particulars Breakdown Table */}
                <div className="fld full fee-breakdown-field">
                  <span className="field-label">Fee particulars breakdown</span>
                  <div className="fee-breakdown-wrap">
                    <table className="fee-breakdown">
                      <thead>
                        <tr>
                          <th scope="col">Particulars</th>
                          <th scope="col">Cash (₹)</th>
                          <th scope="col">Cheque (₹)</th>
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
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Total</th>
                          <td>₹{totals.cash.toLocaleString("en-IN")}</td>
                          <td>₹{totals.cheque.toLocaleString("en-IN")}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Total Calculated Amount */}
                <div className="fld">
                  <label htmlFor="fee-amount">Total amount (₹) <em>*</em></label>
                  <input
                    className="input"
                    id="fee-amount"
                    type="number"
                    value={totalAmount}
                    readOnly
                  />
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
