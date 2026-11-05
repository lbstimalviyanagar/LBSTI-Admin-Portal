import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icons';
import { SortableTh } from '../components/SortableHeader';
import api from '../services/api';

const CHART_COLORS = ['#2456c8', '#0a8a5f', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#64748b', '#84cc16', '#ec4899', '#14b8a6', '#8b5cf6', '#f97316'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Card'];
const EMPTY_FORM = {
  title: '',
  categoryId: '',
  amount: '',
  expenseDate: '',
  paymentMethod: 'Cash',
  paymentStatus: 'Paid',
  vendorName: '',
  description: ''
};

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(amount) || 0);
}

function readableDate(value) {
  if (!value) return '—';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return localDate(result);
}

function hasReceiptFile(file) {
  return ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type);
}

function chartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="expense-chart-tooltip">
      <strong>{label || payload[0].name}</strong>
      {payload.map(item => (
        <span key={item.dataKey || item.name} style={{ color: item.color || item.payload?.color }}>
          {payload.length > 1 ? `${item.name}: ` : ''}{currency(item.value)}
        </span>
      ))}
    </div>
  );
}

export default function ExpensesPage({ onToast }) {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [summaryFilter, setSummaryFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'expenseDate', direction: 'desc' });
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [receiptFile, setReceiptFile] = useState(null);
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [confirmState, setConfirmState] = useState(null);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setLoadError('');
    try {
      const [expenseRows, categoryRows] = await Promise.all([
        api.getExpenses(),
        api.getExpenseCategories()
      ]);
      setExpenses(expenseRows);
      setCategories(categoryRows);
    } catch (error) {
      setLoadError(error.message || 'Unable to load expenses.');
      onToast?.(error.message || 'Unable to load expenses.', true);
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => () => {
    if (receiptPreview?.url) URL.revokeObjectURL(receiptPreview.url);
  }, [receiptPreview]);

  const today = localDate();
  const thisMonth = today.slice(0, 7);
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDate(yesterdayDate);

  const summary = useMemo(() => {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    const todayTotal = expenses.filter(expense => expense.expenseDate === today)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    const monthTotal = expenses.filter(expense => expense.expenseDate?.startsWith(thisMonth))
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    const pending = expenses.filter(expense => expense.paymentStatus === 'Pending');
    const paid = expenses.filter(expense => expense.paymentStatus === 'Paid');
    return {
      total,
      today: todayTotal,
      month: monthTotal,
      pending: pending.reduce((sum, expense) => sum + Number(expense.amount), 0),
      pendingCount: pending.length,
      paid: paid.reduce((sum, expense) => sum + Number(expense.amount), 0)
    };
  }, [expenses, thisMonth, today]);

  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = expenses.filter(expense => {
      if (summaryFilter === 'today' && expense.expenseDate !== today) return false;
      if (summaryFilter === 'month' && !expense.expenseDate?.startsWith(thisMonth)) return false;
      if (summaryFilter === 'pending' && expense.paymentStatus !== 'Pending') return false;
      if (summaryFilter === 'paid' && expense.paymentStatus !== 'Paid') return false;
      if (categoryFilter !== 'all' && String(expense.categoryId) !== categoryFilter) return false;
      if (statusFilter !== 'all' && expense.paymentStatus !== statusFilter) return false;
      if (dateFilter === 'today' && expense.expenseDate !== today) return false;
      if (dateFilter === 'yesterday' && expense.expenseDate !== yesterday) return false;
      if (dateFilter === 'week' && (expense.expenseDate < startOfWeek(new Date()) || expense.expenseDate > today)) return false;
      if (dateFilter === 'month' && !expense.expenseDate?.startsWith(thisMonth)) return false;
      if (dateFilter === 'custom' && dateFrom && expense.expenseDate < dateFrom) return false;
      if (dateFilter === 'custom' && dateTo && expense.expenseDate > dateTo) return false;
      if (query && ![
        expense.expenseId, expense.title, expense.categoryName,
        expense.vendorName, expense.paymentMethod, expense.paymentStatus, expense.description
      ].some(value => String(value || '').toLowerCase().includes(query))) return false;
      return true;
    });

    return rows.sort((a, b) => {
      const left = a[sort.key] ?? '';
      const right = b[sort.key] ?? '';
      const comparison = typeof left === 'number' || typeof right === 'number'
        ? Number(left) - Number(right)
        : String(left).localeCompare(String(right), 'en', { numeric: true, sensitivity: 'base' });
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [categoryFilter, dateFilter, dateFrom, dateTo, expenses, search, sort, statusFilter, summaryFilter, thisMonth, today, yesterday]);

  const availableYears = useMemo(() => {
    const years = new Set(expenses.map(expense => expense.expenseDate?.slice(0, 4)).filter(Boolean));
    years.add(String(new Date().getFullYear()));
    return [...years].sort((a, b) => Number(b) - Number(a));
  }, [expenses]);

  const reportRows = useMemo(() => expenses.filter(expense =>
    expense.expenseDate?.slice(0, 4) === reportYear &&
    (reportMonth === 'all' || expense.expenseDate?.slice(5, 7) === reportMonth)
  ), [expenses, reportMonth, reportYear]);

  const reportCategories = useMemo(() => categories.map((category, index) => {
    const amount = reportRows
      .filter(expense => String(expense.categoryId) === String(category.id))
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return { name: category.name, amount, color: CHART_COLORS[index % CHART_COLORS.length] };
  }).filter(category => category.amount > 0).sort((a, b) => b.amount - a.amount), [categories, reportRows]);

  const monthlyReport = useMemo(() => MONTHS.map((name, index) => {
    const month = String(index + 1).padStart(2, '0');
    const rows = expenses.filter(expense => expense.expenseDate?.startsWith(`${reportYear}-${month}`));
    return {
      month: name.slice(0, 3),
      total: rows.reduce((sum, expense) => sum + Number(expense.amount), 0),
      paid: rows.filter(expense => expense.paymentStatus === 'Paid').reduce((sum, expense) => sum + Number(expense.amount), 0),
      pending: rows.filter(expense => expense.paymentStatus === 'Pending').reduce((sum, expense) => sum + Number(expense.amount), 0)
    };
  }), [expenses, reportYear]);

  const reportTotal = reportRows.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const reportPaid = reportRows.filter(expense => expense.paymentStatus === 'Paid')
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const reportPending = reportRows.filter(expense => expense.paymentStatus === 'Pending')
    .reduce((sum, expense) => sum + Number(expense.amount), 0);
  const reportPreviousMonth = useMemo(() => {
    const current = reportMonth === 'all'
      ? new Date(Number(reportYear) - 1, 0, 1)
      : new Date(Number(reportYear), Number(reportMonth) - 2, 1);
    const prefix = reportMonth === 'all'
      ? String(Number(reportYear) - 1)
      : `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
    return expenses.filter(expense => reportMonth === 'all'
      ? expense.expenseDate?.startsWith(prefix)
      : expense.expenseDate?.startsWith(prefix));
  }, [expenses, reportMonth, reportYear]);
  const previousTotal = reportPreviousMonth.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const highestCategory = reportCategories[0]?.name || '—';
  const comparisonLabel = reportMonth === 'all' ? 'vs previous year' : 'vs previous month';
  const comparisonPercent = previousTotal
    ? ((reportTotal - previousTotal) / previousTotal) * 100
    : null;

  const showSummaryFilter = (filter) => {
    setSummaryFilter(filter);
    setDateFilter('all');
    setDateFrom('');
    setDateTo('');
    setCategoryFilter('all');
    setStatusFilter('all');
  };

  const toggleSort = (key) => {
    setSort(previous => ({
      key,
      direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const openNewExpense = () => {
    setEditingExpense(null);
    setForm({ ...EMPTY_FORM, expenseDate: today, categoryId: categories[0] ? String(categories[0].id) : '' });
    setReceiptFile(null);
    setRemoveReceipt(false);
    setFormOpen(true);
  };

  const openEditExpense = (expense) => {
    setViewingExpense(null);
    setEditingExpense(expense);
    setForm({
      title: expense.title,
      categoryId: String(expense.categoryId),
      amount: String(expense.amount),
      expenseDate: expense.expenseDate,
      paymentMethod: expense.paymentMethod,
      paymentStatus: expense.paymentStatus,
      vendorName: expense.vendorName,
      description: expense.description || ''
    });
    setReceiptFile(null);
    setRemoveReceipt(false);
    setFormOpen(true);
  };

  const handleReceiptChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setReceiptFile(null);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onToast?.('Receipt files must be smaller than 5 MB.', true);
      event.target.value = '';
      return;
    }
    if (!hasReceiptFile(file)) {
      onToast?.('Upload a PDF, JPEG, PNG, or WebP receipt.', true);
      event.target.value = '';
      return;
    }
    setReceiptFile(file);
    setRemoveReceipt(false);
  };

  const submitExpense = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, categoryId: Number(form.categoryId) };
      if (receiptFile) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Unable to read the selected receipt.'));
          reader.readAsDataURL(receiptFile);
        });
        payload.receipt = {
          data: String(dataUrl).split(',')[1],
          mimeType: receiptFile.type,
          name: receiptFile.name
        };
      } else if (removeReceipt) {
        payload.removeReceipt = true;
      }

      const saved = editingExpense
        ? await api.updateExpense(editingExpense.id, payload)
        : await api.createExpense(payload);
      setExpenses(previous => editingExpense
        ? previous.map(expense => String(expense.id) === String(saved.id) ? saved : expense)
        : [saved, ...previous]);
      setFormOpen(false);
      onToast?.(editingExpense ? 'Expense updated successfully.' : 'Expense saved successfully.');
    } catch (error) {
      onToast?.(error.message || 'Unable to save the expense.', true);
    } finally {
      setSaving(false);
    }
  };

  const askDeleteExpense = (expense) => setConfirmState({
    title: 'Delete this expense?',
    message: `This permanently deletes ${expense.expenseId} (${expense.title}) and its attached receipt.`,
    confirmText: 'Delete expense',
    onConfirm: async () => {
      try {
        await api.deleteExpense(expense.id);
        setExpenses(previous => previous.filter(item => String(item.id) !== String(expense.id)));
        setViewingExpense(null);
        onToast?.('Expense deleted successfully.');
      } catch (error) {
        onToast?.(error.message || 'Unable to delete the expense.', true);
      } finally {
        setConfirmState(null);
      }
    }
  });

  const saveCategory = async (event) => {
    event.preventDefault();
    const name = categoryName.trim();
    if (!name) return;
    try {
      if (editingCategory) {
        const updated = await api.updateExpenseCategory(editingCategory.id, { name });
        setCategories(previous => previous.map(category => category.id === updated.id ? updated : category));
        setExpenses(previous => previous.map(expense => String(expense.categoryId) === String(updated.id)
          ? { ...expense, categoryName: updated.name }
          : expense));
        onToast?.('Expense category updated.');
      } else {
        const created = await api.createExpenseCategory({ name });
        setCategories(previous => [...previous, created].sort((a, b) => a.name.localeCompare(b.name)));
        onToast?.('Expense category added.');
      }
      setCategoryName('');
      setEditingCategory(null);
    } catch (error) {
      onToast?.(error.message || 'Unable to save the expense category.', true);
    }
  };

  const askDeleteCategory = (category) => setConfirmState({
    title: 'Delete this category?',
    message: `Delete "${category.name}"? Categories used by existing expenses cannot be removed.`,
    confirmText: 'Delete category',
    onConfirm: async () => {
      try {
        await api.deleteExpenseCategory(category.id);
        setCategories(previous => previous.filter(item => item.id !== category.id));
        onToast?.('Expense category deleted.');
      } catch (error) {
        onToast?.(error.message || 'Unable to delete the category.', true);
      } finally {
        setConfirmState(null);
      }
    }
  });

  const openReceipt = async (expense) => {
    setReceiptLoading(true);
    try {
      const file = await api.getExpenseReceipt(expense.id, expense.receiptName);
      const url = URL.createObjectURL(file.blob);
      setReceiptPreview({
        url,
        filename: file.filename,
        image: file.blob.type.startsWith('image/')
      });
    } catch (error) {
      onToast?.(error.message || 'Unable to open the receipt.', true);
    } finally {
      setReceiptLoading(false);
    }
  };

  const cards = [
    { key: 'all', label: 'Total Expenses', value: currency(summary.total), hint: `${expenses.length} recorded`, icon: 'fee', color: 'blue' },
    { key: 'today', label: "Today's Expenses", value: currency(summary.today), hint: 'Recorded today', icon: 'calendar', color: 'cyan' },
    { key: 'month', label: 'This Month', value: currency(summary.month), hint: 'Current month', icon: 'chart', color: 'purple' },
    { key: 'pending', label: 'Pending Payments', value: currency(summary.pending), hint: `${summary.pendingCount} unpaid`, icon: 'clock', color: 'orange' },
    { key: 'paid', label: 'Paid Expenses', value: currency(summary.paid), hint: 'Already paid', icon: 'check', color: 'green' }
  ];

  return (
    <div className="expenses-page">
      <div className="page-head expenses-heading">
        <div>
          <h2>Expenses</h2>
          <p>Track spending, manage payments, and review expense reports.</p>
        </div>
        <div className="expenses-heading-actions">
          <button className="btn" type="button" onClick={() => setCategoryModalOpen(true)}>
            <Icon name="filter" size={17} /> Manage categories
          </button>
          <button className="btn" type="button" onClick={() => loadData()} disabled={loading}>
            <span className={loading ? 'spin' : ''}><Icon name="refresh" size={17} /></span> Refresh
          </button>
          <button className="btn primary" type="button" onClick={openNewExpense}>
            <Icon name="plus" size={18} /> Add Expense
          </button>
        </div>
      </div>

      {loadError && (
        <div className="banner" role="alert">
          <div><b>Couldn't load expenses</b><span>{loadError}</span></div>
          <button className="btn" type="button" onClick={() => loadData()}>Try again</button>
        </div>
      )}

      <section className="expense-summary-grid" aria-label="Expense summaries">
        {cards.map(card => (
          <button
            key={card.key}
            className={`expense-summary-card ${summaryFilter === card.key ? 'selected' : ''}`}
            type="button"
            aria-pressed={summaryFilter === card.key}
            onClick={() => showSummaryFilter(card.key)}
          >
            <span className={`expense-summary-icon ${card.color}`}><Icon name={card.icon} size={19} /></span>
            <span className="expense-summary-label">{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </button>
        ))}
      </section>

      <section className="card expense-records-card">
        <div className="card-head expense-records-heading">
          <div>
            <h3>Expense records</h3>
            <p>{visibleExpenses.length} of {expenses.length} expenses</p>
          </div>
          <button className="btn sm" type="button" onClick={() => {
            showSummaryFilter('all');
            setSearch('');
          }}>
            Clear filters
          </button>
        </div>
        <div className="expense-filters">
          <label className="expense-search">
            <Icon name="search" size={18} />
            <input
              className="input"
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search title, vendor, category, ID..."
              aria-label="Search expenses"
            />
          </label>
          <select className="select" value={dateFilter} onChange={event => setDateFilter(event.target.value)} aria-label="Filter by date">
            <option value="all">All dates</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="custom">Custom date range</option>
          </select>
          <select className="select" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)} aria-label="Filter by category">
            <option value="all">All categories</option>
            {categories.map(category => <option key={category.id} value={String(category.id)}>{category.name}</option>)}
          </select>
          <select className="select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by payment status">
            <option value="all">All statuses</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
          </select>
          {dateFilter === 'custom' && (
            <div className="expense-date-range">
              <label>From <input className="input" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></label>
              <label>To <input className="input" type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} /></label>
            </div>
          )}
        </div>
        <div className="expense-table-scroll">
          <table className="expense-table">
            <thead>
              <tr>
                <SortableTh colKey="expenseId" label="Expense ID" sortKey={sort.key} sortDirection={sort.direction} onSort={toggleSort} />
                <SortableTh colKey="expenseDate" label="Date" sortKey={sort.key} sortDirection={sort.direction} onSort={toggleSort} />
                <SortableTh colKey="title" label="Expense" sortKey={sort.key} sortDirection={sort.direction} onSort={toggleSort} />
                <SortableTh colKey="categoryName" label="Category" sortKey={sort.key} sortDirection={sort.direction} onSort={toggleSort} />
                <SortableTh colKey="vendorName" label="Paid to" sortKey={sort.key} sortDirection={sort.direction} onSort={toggleSort} />
                <SortableTh colKey="amount" label="Amount" sortKey={sort.key} sortDirection={sort.direction} onSort={toggleSort} align="right" />
                <SortableTh colKey="paymentMethod" label="Method" sortKey={sort.key} sortDirection={sort.direction} onSort={toggleSort} />
                <SortableTh colKey="paymentStatus" label="Status" sortKey={sort.key} sortDirection={sort.direction} onSort={toggleSort} />
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="expense-empty-cell" colSpan="9">Loading expense records...</td></tr>
              ) : visibleExpenses.length ? visibleExpenses.map(expense => (
                <tr key={expense.id}>
                  <td className="expense-id-cell">{expense.expenseId}</td>
                  <td>{readableDate(expense.expenseDate)}</td>
                  <td><strong>{expense.title}</strong></td>
                  <td><span className="expense-category-tag">{expense.categoryName}</span></td>
                  <td>{expense.vendorName}</td>
                  <td className="expense-amount-cell">{currency(expense.amount)}</td>
                  <td>{expense.paymentMethod}</td>
                  <td><span className={`expense-status ${expense.paymentStatus.toLowerCase()}`}>{expense.paymentStatus}</span></td>
                  <td>
                    <div className="expense-row-actions">
                      <button className="icon-btn" type="button" title="View expense" aria-label={`View ${expense.expenseId}`} onClick={() => setViewingExpense(expense)}><Icon name="eye" size={17} /></button>
                      <button className="icon-btn" type="button" title="Edit expense" aria-label={`Edit ${expense.expenseId}`} onClick={() => openEditExpense(expense)}><Icon name="edit" size={16} /></button>
                      <button className="icon-btn expense-delete-btn" type="button" title="Delete expense" aria-label={`Delete ${expense.expenseId}`} onClick={() => askDeleteExpense(expense)}><Icon name="trash" size={16} /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td className="expense-empty-cell" colSpan="9">
                  {expenses.length ? 'No expenses match these filters.' : 'No expenses recorded yet. Add an expense to get started.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card expense-analysis-section">
        <div className="card-head expense-analysis-head">
          <div>
            <h3>Expense analysis & monthly reports</h3>
            <p>Category and monthly breakdowns from recorded expenses.</p>
          </div>
          <div className="expense-report-selectors">
            <label>
              <span>Month</span>
              <select className="select" value={reportMonth} onChange={event => setReportMonth(event.target.value)}>
                <option value="all">All months</option>
                {MONTHS.map((month, index) => <option key={month} value={String(index + 1).padStart(2, '0')}>{month}</option>)}
              </select>
            </label>
            <label>
              <span>Year</span>
              <select className="select" value={reportYear} onChange={event => setReportYear(event.target.value)}>
                {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="expense-report-stats">
          <div><span>Report total</span><strong>{currency(reportTotal)}</strong></div>
          <div><span>{comparisonLabel}</span><strong className={comparisonPercent > 0 ? 'expense-trend-up' : comparisonPercent < 0 ? 'expense-trend-down' : ''}>
            {comparisonPercent === null ? currency(previousTotal) : `${comparisonPercent > 0 ? '+' : ''}${comparisonPercent.toFixed(1)}%`}
          </strong></div>
          <div><span>Highest category</span><strong>{highestCategory}</strong></div>
          <div><span>Total paid</span><strong>{currency(reportPaid)}</strong></div>
          <div><span>Total pending</span><strong>{currency(reportPending)}</strong></div>
        </div>

        {reportRows.length ? (
          <>
            <div className="expense-chart-grid">
              <div className="expense-chart-card">
                <div className="expense-chart-title"><h4>Category share</h4><span>{reportMonth === 'all' ? reportYear : MONTHS[Number(reportMonth) - 1]}</span></div>
                <div className="expense-chart-container expense-pie-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={reportCategories} dataKey="amount" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={2}>
                        {reportCategories.map(item => <Cell key={item.name} fill={item.color} />)}
                      </Pie>
                      <Tooltip content={chartTooltip} />
                      <Legend verticalAlign="bottom" height={42} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="expense-chart-card">
                <div className="expense-chart-title"><h4>Category comparison</h4><span>{reportCategories.length} categories</span></div>
                <div className="expense-chart-container expense-bar-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportCategories} margin={{ top: 12, right: 12, left: 8, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" interval={0} angle={-24} textAnchor="end" height={58} tick={{ fontSize: 10 }} />
                      <YAxis tickFormatter={value => `₹${Number(value).toLocaleString('en-IN')}`} width={72} tick={{ fontSize: 10 }} />
                      <Tooltip content={chartTooltip} />
                      <Bar dataKey="amount" name="Amount spent" radius={[5, 5, 0, 0]}>
                        {reportCategories.map(item => <Cell key={item.name} fill={item.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            <div className="expense-monthly-chart-card">
              <div className="expense-chart-title"><h4>Monthly spending</h4><span>{reportYear}</span></div>
              <div className="expense-chart-container expense-monthly-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyReport} margin={{ top: 12, right: 18, left: 8, bottom: 6 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={value => `₹${Number(value).toLocaleString('en-IN')}`} width={74} tick={{ fontSize: 10 }} />
                    <Tooltip content={chartTooltip} />
                    <Legend />
                    <Bar dataKey="paid" name="Paid" fill="#0a8a5f" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pending" name="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="expense-category-report">
              <h4>Category-wise spending</h4>
              {reportCategories.length ? reportCategories.map(item => (
                <div className="expense-category-report-row" key={item.name}>
                  <span><i style={{ backgroundColor: item.color }} />{item.name}</span>
                  <strong>{currency(item.amount)}</strong>
                  <span>{reportTotal ? `${(item.amount / reportTotal * 100).toFixed(1)}%` : '0%'}</span>
                </div>
              )) : <p>No category spending in this period.</p>}
            </div>
            <div className="expense-monthly-table-wrap">
              <h4>Monthly totals</h4>
              <div className="expense-table-scroll">
                <table className="expense-table expense-monthly-table">
                  <thead><tr><th>Month</th><th>Total expenses</th><th>Paid</th><th>Pending</th></tr></thead>
                  <tbody>{monthlyReport.map(row => (
                    <tr key={row.month}>
                      <td>{row.month} {reportYear}</td>
                      <td>{currency(row.total)}</td>
                      <td>{currency(row.paid)}</td>
                      <td>{currency(row.pending)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="expense-analysis-empty">
            <span className="expense-empty-icon"><Icon name="chart" size={25} /></span>
            <strong>No expenses for this reporting period</strong>
            <span>Charts and monthly totals will appear after expenses are recorded.</span>
          </div>
        )}
      </section>

      {formOpen && (
        <div className="expense-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget && !saving) setFormOpen(false);
        }}>
          <section className="expense-modal expense-form-modal" role="dialog" aria-modal="true" aria-labelledby="expense-form-title">
            <header className="expense-modal-header">
              <div><span className="expense-modal-kicker">{editingExpense ? 'Update record' : 'New record'}</span><h3 id="expense-form-title">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3></div>
              <button className="icon-btn" type="button" aria-label="Close form" onClick={() => setFormOpen(false)}><Icon name="x" size={19} /></button>
            </header>
            <form onSubmit={submitExpense}>
              <div className="expense-form-grid">
                <label className="fld expense-field-wide"><span>Expense Title <em>*</em></span>
                  <input className="input" required maxLength={190} value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder="e.g. Monthly office supplies" />
                </label>
                <label className="fld"><span>Expense Category <em>*</em></span>
                  <select className="select" required value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })}>
                    <option value="">Select category</option>
                    {categories.map(category => <option key={category.id} value={String(category.id)}>{category.name}</option>)}
                  </select>
                </label>
                <label className="fld"><span>Amount (₹) <em>*</em></span>
                  <input className="input" type="number" min="0.01" max="9999999999.99" step="0.01" required value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} placeholder="0.00" />
                </label>
                <label className="fld"><span>Expense Date <em>*</em></span>
                  <input className="input" type="date" required value={form.expenseDate} onChange={event => setForm({ ...form, expenseDate: event.target.value })} />
                </label>
                <label className="fld"><span>Payment Method <em>*</em></span>
                  <select className="select" required value={form.paymentMethod} onChange={event => setForm({ ...form, paymentMethod: event.target.value })}>
                    {PAYMENT_METHODS.map(method => <option key={method}>{method}</option>)}
                  </select>
                </label>
                <label className="fld"><span>Payment Status <em>*</em></span>
                  <select className="select" required value={form.paymentStatus} onChange={event => setForm({ ...form, paymentStatus: event.target.value })}>
                    <option>Paid</option><option>Pending</option>
                  </select>
                </label>
                <label className="fld expense-field-wide"><span>Paid To / Vendor Name <em>*</em></span>
                  <input className="input" required maxLength={190} value={form.vendorName} onChange={event => setForm({ ...form, vendorName: event.target.value })} placeholder="Vendor or recipient" />
                </label>
                <label className="fld expense-field-wide"><span>Description / Notes</span>
                  <textarea className="textarea" maxLength={5000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Add any useful details..." />
                </label>
                <label className="fld expense-field-wide"><span>Upload Bill or Receipt <small>(optional · PDF, JPEG, PNG or WebP · max 5 MB)</small></span>
                  <input className="input expense-file-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={handleReceiptChange} />
                  {receiptFile && <span className="expense-file-name">{receiptFile.name}</span>}
                  {!receiptFile && editingExpense?.receiptName && !removeReceipt && (
                    <span className="expense-existing-receipt">{editingExpense.receiptName}
                      <button className="btn link sm" type="button" onClick={() => setRemoveReceipt(true)}>Remove receipt</button>
                    </span>
                  )}
                  {removeReceipt && <span className="expense-file-name">The existing receipt will be removed when saved.</span>}
                </label>
              </div>
              <footer className="expense-modal-footer">
                <button className="btn" type="button" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
                <button className="btn primary" type="submit" disabled={saving || !categories.length}>
                  {saving ? 'Saving...' : editingExpense ? 'Save Changes' : 'Save Expense'}
                </button>
              </footer>
              {!categories.length && <p className="expense-form-notice">Add an expense category before creating an expense.</p>}
            </form>
          </section>
        </div>
      )}

      {viewingExpense && (
        <div className="expense-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setViewingExpense(null);
        }}>
          <section className="expense-modal expense-detail-modal" role="dialog" aria-modal="true" aria-labelledby="expense-view-title">
            <header className="expense-modal-header">
              <div><span className="expense-modal-kicker">{viewingExpense.expenseId}</span><h3 id="expense-view-title">{viewingExpense.title}</h3></div>
              <button className="icon-btn" type="button" aria-label="Close details" onClick={() => setViewingExpense(null)}><Icon name="x" size={19} /></button>
            </header>
            <div className="expense-detail-grid">
              <div><span>Expense date</span><strong>{readableDate(viewingExpense.expenseDate)}</strong></div>
              <div><span>Category</span><strong>{viewingExpense.categoryName}</strong></div>
              <div><span>Paid to / vendor</span><strong>{viewingExpense.vendorName}</strong></div>
              <div><span>Amount</span><strong>{currency(viewingExpense.amount)}</strong></div>
              <div><span>Payment method</span><strong>{viewingExpense.paymentMethod}</strong></div>
              <div><span>Payment status</span><strong><span className={`expense-status ${viewingExpense.paymentStatus.toLowerCase()}`}>{viewingExpense.paymentStatus}</span></strong></div>
              <div className="expense-detail-wide"><span>Description / notes</span><p>{viewingExpense.description || 'No description provided.'}</p></div>
              {viewingExpense.receiptName && <div className="expense-detail-wide"><span>Bill or receipt</span><button className="btn sm" type="button" disabled={receiptLoading} onClick={() => openReceipt(viewingExpense)}><Icon name="receipt" size={16} />{receiptLoading ? 'Opening...' : viewingExpense.receiptName}</button></div>}
            </div>
            <footer className="expense-modal-footer">
              <button className="btn danger" type="button" onClick={() => askDeleteExpense(viewingExpense)}><Icon name="trash" size={16} /> Delete</button>
              <span className="expense-footer-spacer" />
              <button className="btn" type="button" onClick={() => setViewingExpense(null)}>Close</button>
              <button className="btn primary" type="button" onClick={() => openEditExpense(viewingExpense)}><Icon name="edit" size={16} /> Edit</button>
            </footer>
          </section>
        </div>
      )}

      {categoryModalOpen && (
        <div className="expense-modal-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) {
            setCategoryModalOpen(false);
            setCategoryName('');
            setEditingCategory(null);
          }
        }}>
          <section className="expense-modal expense-category-modal" role="dialog" aria-modal="true" aria-labelledby="expense-category-title">
            <header className="expense-modal-header">
              <div><span className="expense-modal-kicker">Expense settings</span><h3 id="expense-category-title">Manage categories</h3></div>
              <button className="icon-btn" type="button" aria-label="Close categories" onClick={() => {
                setCategoryModalOpen(false);
                setCategoryName('');
                setEditingCategory(null);
              }}><Icon name="x" size={19} /></button>
            </header>
            <form className="expense-category-form" onSubmit={saveCategory}>
              <label className="fld"><span>{editingCategory ? 'Edit category name' : 'New category name'}</span>
                <input className="input" value={categoryName} maxLength={120} required onChange={event => setCategoryName(event.target.value)} placeholder="e.g. Software subscriptions" />
              </label>
              <button className="btn primary" type="submit"><Icon name={editingCategory ? 'check' : 'plus'} size={17} />{editingCategory ? 'Save' : 'Add category'}</button>
              {editingCategory && <button className="btn" type="button" onClick={() => { setEditingCategory(null); setCategoryName(''); }}>Cancel</button>}
            </form>
            <div className="expense-category-list">
              {categories.map(category => (
                <div className="expense-category-list-row" key={category.id}>
                  <span>{category.name}{category.isDefault && <small>Predefined</small>}</span>
                  {!category.isDefault && <div>
                    <button className="icon-btn" type="button" title={`Edit ${category.name}`} aria-label={`Edit ${category.name}`} onClick={() => { setEditingCategory(category); setCategoryName(category.name); }}><Icon name="edit" size={16} /></button>
                    <button className="icon-btn expense-delete-btn" type="button" title={`Delete ${category.name}`} aria-label={`Delete ${category.name}`} onClick={() => askDeleteCategory(category)}><Icon name="trash" size={16} /></button>
                  </div>}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {receiptPreview && (
        <div className="expense-modal-backdrop expense-receipt-backdrop" onMouseDown={event => {
          if (event.target === event.currentTarget) setReceiptPreview(null);
        }}>
          <section className="expense-modal expense-receipt-modal" role="dialog" aria-modal="true" aria-label="Receipt preview">
            <header className="expense-modal-header">
              <div><span className="expense-modal-kicker">Attached document</span><h3>{receiptPreview.filename}</h3></div>
              <button className="icon-btn" type="button" aria-label="Close receipt" onClick={() => setReceiptPreview(null)}><Icon name="x" size={19} /></button>
            </header>
            {receiptPreview.image
              ? <img className="expense-receipt-image" src={receiptPreview.url} alt={receiptPreview.filename} />
              : <iframe className="expense-receipt-frame" title="Expense receipt" src={receiptPreview.url} />}
          </section>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmText={confirmState?.confirmText || 'Confirm'}
        danger
        className="expense-confirm-overlay"
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
}
