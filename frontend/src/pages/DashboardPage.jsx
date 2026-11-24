import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../components/Icons';
import EnquiryDashboard from '../components/EnquiryDashboard';
import api from '../services/api';
import {
  rangeOf,
  inRange,
  isPendingFU,
  fmtDay,
  fmtShort,
  initials,
  parseDate
} from '../utils/helpers';
import { hasMenuAccess } from '../utils/permissions';

// Module-level in-memory cache to prevent repeated re-fetching and loop requests
let dashboardCache = null;
let dashboardCacheTime = 0;
const CACHE_TTL_MS = 60000; // 60s cache

function normalizeDashboardRecords(value, resource) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  throw new Error(`The server returned an invalid ${resource} response.`);
}

export function clearDashboardCache() {
  dashboardCache = null;
  dashboardCacheTime = 0;
}

export default function DashboardPage({
  user,
  enquiries = [],
  fees = [],
  students = [],
  enrollments = [],
  users = [],
  loading = false,
  dashRangeKind = 'month',
  dashFrom = '',
  dashTo = '',
  refreshKey = 0,
  onNavigate,
  onOpenEdit,
  onConfirmAdmission,
  onDrillIntoTable,
  onGoToNewLead,
  onRefresh,
  onToast
}) {
  // Additional cross-module data state
  const [extraData, setExtraData] = useState({
    expenses: [],
    attendance: [],
    studentAttendance: [],
    batches: [],
    tasks: [],
    courses: []
  });
  const [extraLoading, setExtraLoading] = useState(true);
  const [extraLoadError, setExtraLoadError] = useState("");
  const [showEnquiryPipeline, setShowEnquiryPipeline] = useState(false);
  const [activeActivityTab, setActiveActivityTab] = useState('leads'); // 'leads' | 'payments' | 'batches' | 'attendance'

  const userRole = String(user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin';

  // Fetch cross-module statistics on mount (with caching to prevent infinite loops)
  useEffect(() => {
    let isMounted = true;

    // Use cached data if fresh (prevents redundant API calls on tab switching)
    if (dashboardCache && (Date.now() - dashboardCacheTime < CACHE_TTL_MS)) {
      setExtraData(dashboardCache);
      setExtraLoading(false);
      return;
    }

    async function loadExtraData() {
      try {
        const [expensesRes, attRes, studentAttRes, batchesRes, tasksRes, coursesRes] = await Promise.all([
          isAdmin ? api.getExpenses() : Promise.resolve([]),
          api.getAttendance(),
          api.getStudentAttendance(),
          api.getBatches(),
          api.getTasks(),
          api.getCourses()
        ]);

        const freshData = {
          expenses: normalizeDashboardRecords(expensesRes, 'expenses'),
          attendance: normalizeDashboardRecords(attRes, 'attendance'),
          studentAttendance: normalizeDashboardRecords(studentAttRes, 'student attendance'),
          batches: normalizeDashboardRecords(batchesRes, 'batches'),
          tasks: normalizeDashboardRecords(tasksRes, 'tasks'),
          courses: normalizeDashboardRecords(coursesRes, 'courses')
        };

        dashboardCache = freshData;
        dashboardCacheTime = Date.now();

        if (isMounted) {
          setExtraLoadError("");
          setExtraData(freshData);
        }
      } catch (err) {
        console.error('Error fetching dashboard extra data:', err);
        dashboardCache = null;
        if (isMounted) {
          setExtraLoadError(err.message || "Some dashboard data could not be loaded.");
        }
      } finally {
        if (isMounted) setExtraLoading(false);
      }
    }

    loadExtraData();
    return () => { isMounted = false; };
  }, [isAdmin, refreshKey]);

  // Compute Active Date Range
  const range = useMemo(() => {
    return rangeOf(dashRangeKind, dashFrom, dashTo);
  }, [dashRangeKind, dashFrom, dashTo]);

  // Today ISO date string
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filtered Enquiries
  const filteredEnquiries = useMemo(() => {
    return enquiries.filter(e => inRange(e, range));
  }, [enquiries, range]);

  // Filtered Fees
  const filteredFees = useMemo(() => {
    return fees.filter(f => {
      if (!range.start && !range.end) return true;
      const d = parseDate(f.paymentDate || f.createdAt || f.date);
      if (!d) return false;
      return (!range.start || d >= range.start) && (!range.end || d < range.end);
    });
  }, [fees, range]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return extraData.expenses.filter(ex => {
      if (!range.start && !range.end) return true;
      const d = parseDate(ex.date || ex.expense_date || ex.createdAt);
      if (!d) return false;
      return (!range.start || d >= range.start) && (!range.end || d < range.end);
    });
  }, [extraData.expenses, range]);

  // Calculations for KPI Metrics
  const stats = useMemo(() => {
    // 1. Enquiries
    const totalLeads = enquiries.length;
    const leadsInRange = filteredEnquiries.length;
    const confirmedAdmissions = filteredEnquiries.filter(e => e.status === 'Confirmed').length;
    const pendingFollowUps = filteredEnquiries.filter(e => isPendingFU(e)).length;

    // 2. Payments & Finances
    const totalCollectedAllTime = fees.reduce((sum, f) => sum + (Number(f.amount) || Number(f.paidAmount) || 0), 0);
    const totalCollectedRange = filteredFees.reduce((sum, f) => sum + (Number(f.amount) || Number(f.paidAmount) || 0), 0);
    const totalPendingBalance = students.reduce((sum, s) => sum + (Number(s.balance) || 0), 0);
    const totalTransactions = fees.length;

    // 3. Expenses
    const totalExpensesAllTime = extraData.expenses.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
    const totalExpensesRange = filteredExpenses.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
    const expenseCount = extraData.expenses.length;

    // 4. Students & Enrollments
    const totalStudents = students.length;
    const activeEnrollments = enrollments.filter(e => e.status === 'Active' || !e.status).length;
    const completedEnrollments = enrollments.filter(e => e.status === 'Completed').length;
    const droppedEnrollments = enrollments.filter(e => e.status === 'Dropped').length;

    // 5. Staff Attendance (Today)
    const todayStaffRecords = extraData.attendance.filter(a => String(a.date || '').slice(0, 10) === todayStr);
    const staffPresentCount = todayStaffRecords.filter(a => a.status === 'Present' || a.clock_in).length;
    const staffAbsentCount = todayStaffRecords.filter(a => a.status === 'Absent').length;
    const staffLeaveCount = todayStaffRecords.filter(a => a.status === 'Leave' || a.status === 'Half-Day').length;

    // 6. Student Attendance (Today)
    const todayStudentRecords = extraData.studentAttendance.filter(sa => String(sa.date || '').slice(0, 10) === todayStr);
    const studentPresentCount = todayStudentRecords.filter(sa => sa.status === 'Present').length;
    const studentAbsentCount = todayStudentRecords.filter(sa => sa.status === 'Absent').length;

    // 7. Batches
    const totalBatches = extraData.batches.length;
    const ongoingBatches = extraData.batches.filter(b => b.status === 'Ongoing').length;
    const upcomingBatches = extraData.batches.filter(b => b.status === 'Upcoming' || !b.status).length;
    const completedBatches = extraData.batches.filter(b => b.status === 'Completed').length;

    // 8. Tasks
    const totalTasks = extraData.tasks.length;
    const pendingTasks = extraData.tasks.filter(t => t.status !== 'Completed').length;
    const completedTasks = extraData.tasks.filter(t => t.status === 'Completed').length;
    const now = new Date();
    const overdueTasks = extraData.tasks.filter(t => t.status !== 'Completed' && t.due_date && new Date(t.due_date) < now).length;

    return {
      totalLeads,
      leadsInRange,
      confirmedAdmissions,
      pendingFollowUps,
      totalCollectedAllTime,
      totalCollectedRange,
      totalPendingBalance,
      totalTransactions,
      totalExpensesAllTime,
      totalExpensesRange,
      expenseCount,
      totalStudents,
      activeEnrollments,
      completedEnrollments,
      droppedEnrollments,
      staffPresentCount,
      staffAbsentCount,
      staffLeaveCount,
      studentPresentCount,
      studentAbsentCount,
      totalBatches,
      ongoingBatches,
      upcomingBatches,
      completedBatches,
      totalTasks,
      pendingTasks,
      completedTasks,
      overdueTasks
    };
  }, [enquiries, filteredEnquiries, fees, filteredFees, students, enrollments, extraData, filteredExpenses, todayStr]);

  // Recent 6 Enquiries
  const recentEnquiries = useMemo(() => {
    return [...enquiries]
      .sort((a, b) => new Date(b.createdAt || b.inquiryDate || 0) - new Date(a.createdAt || a.inquiryDate || 0))
      .slice(0, 6);
  }, [enquiries]);

  // Recent 6 Fee Transactions
  const recentFees = useMemo(() => {
    return [...fees]
      .sort((a, b) => new Date(b.paymentDate || b.createdAt || 0) - new Date(a.paymentDate || a.createdAt || 0))
      .slice(0, 6);
  }, [fees]);

  // Today's Batches
  const todayBatches = useMemo(() => {
    return extraData.batches.slice(0, 6);
  }, [extraData.batches]);

  // Today's Staff Attendance records
  const todayStaffAttendance = useMemo(() => {
    return extraData.attendance.filter(a => String(a.date || '').slice(0, 10) === todayStr).slice(0, 6);
  }, [extraData.attendance, todayStr]);

  const userName = user?.name || user?.fullName || 'Administrator';

  const rangeLabel = useMemo(() => {
    if (dashRangeKind === 'month') return 'This Month';
    if (dashRangeKind === 'today') return 'Today';
    if (dashRangeKind === 'week') return 'This Week';
    if (dashRangeKind === 'lastmonth') return 'Last Month';
    if (dashRangeKind === 'all') return 'All Time';
    if (dashRangeKind === 'custom') return `${dashFrom || 'Start'} to ${dashTo || 'End'}`;
    return 'Active Filter';
  }, [dashRangeKind, dashFrom, dashTo]);

  return (
    <div className="dashboard-master-container" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {extraLoadError && (
        <div className="banner" role="alert">
          <div>
            <b>Some dashboard data is unavailable</b>
            <span>{extraLoadError}</span>
          </div>
          <button className="btn" type="button" onClick={onRefresh}>
            Try again
          </button>
        </div>
      )}
      {/* ============================================================ */}
      {/* 1. WELCOME HERO BANNER & QUICK LAUNCH ACTIONS                */}
      {/* ============================================================ */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--navy-900) 0%, #1e293b 100%)',
          color: '#fff',
          borderRadius: '16px',
          padding: '24px 28px',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.25)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '20px'
        }}
      >
        <div style={{ maxWidth: '650px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.12)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, marginBottom: '10px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            LBSTIMN Central Portal &bull; {rangeLabel}
          </div>
          <h2 style={{ margin: 0, fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }}>
            Welcome back, {userName}
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.92rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            Here is your live institute overview across Enquiries, Payments, Students, Attendance, Batches, and Staff operations.
          </p>
        </div>

        {/* Quick Launch Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {onGoToNewLead && (
            <button
              className="btn"
              type="button"
              onClick={onGoToNewLead}
              style={{
                background: 'var(--brand)',
                color: '#fff',
                borderColor: 'var(--brand)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              <Icon name="plus" size={16} />
              New Enquiry
            </button>
          )}

          {hasMenuAccess(user, 'payments') && onNavigate && (
            <button
              className="btn"
              type="button"
              onClick={() => onNavigate('payments')}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600
              }}
            >
              <Icon name="fee" size={16} />
              Record Payment
            </button>
          )}

          {hasMenuAccess(user, 'batches') && onNavigate && (
            <button
              className="btn"
              type="button"
              onClick={() => onNavigate('batches')}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600
              }}
            >
              <Icon name="dashboard" size={16} />
              Batches
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. EXECUTIVE SUMMARY CARDS GRID (ALL SECTIONS)              */}
      {/* ============================================================ */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
              Institute Key Metrics & Summary
            </h3>
            <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
              Real-time analytics filtered by: <b>{rangeLabel}</b>
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn sm"
              type="button"
              onClick={() => setShowEnquiryPipeline(!showEnquiryPipeline)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <Icon name="inbox" size={14} />
              {showEnquiryPipeline ? 'Hide Enquiry Funnel' : 'View Enquiry Funnel'}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
            gap: '16px'
          }}
        >
          {/* Card 1: Enquiries & Admissions */}
          <div
            className="kpi-card"
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderTop: '4px solid #3b82f6',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onClick={() => onNavigate && onNavigate('table')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Enquiries & Admissions</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="inbox" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                {stats.leadsInRange}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                Total Leads: <b>{stats.totalLeads}</b>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: '#16a34a' }}><b>{stats.confirmedAdmissions}</b> Confirmed</span>
              <span style={{ color: '#d97706' }}><b>{stats.pendingFollowUps}</b> Follow-up</span>
              <span style={{ color: '#2563eb', fontWeight: 600 }}>Open &rarr;</span>
            </div>
          </div>

          {/* Card 2: Fee Collections */}
          <div
            className="kpi-card"
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderTop: '4px solid #10b981',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onClick={() => onNavigate && onNavigate('payments')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Fees Collected</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="fee" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#059669', lineHeight: 1.2 }}>
                ₹{stats.totalCollectedRange.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                All Time: ₹{stats.totalCollectedAllTime.toLocaleString('en-IN')}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: '#dc2626' }}>Due: ₹{stats.totalPendingBalance.toLocaleString('en-IN')}</span>
              <span style={{ color: '#64748b' }}>{stats.totalTransactions} Receipts</span>
              <span style={{ color: '#059669', fontWeight: 600 }}>Open &rarr;</span>
            </div>
          </div>

          {/* Card 3: Institute Expenses */}
          {isAdmin && (
            <div
              className="kpi-card"
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderTop: '4px solid #f59e0b',
                borderRadius: '12px',
                padding: '18px 20px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: onNavigate ? 'pointer' : 'default',
                transition: 'transform 0.15s, box-shadow 0.15s'
              }}
              onClick={() => onNavigate && onNavigate('expenses')}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Total Expenses</span>
                  <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fffbeb', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="fee" size={18} />
                  </span>
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#d97706', lineHeight: 1.2 }}>
                  ₹{stats.totalExpensesRange.toLocaleString('en-IN')}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Total Recorded: ₹{stats.totalExpensesAllTime.toLocaleString('en-IN')}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: '#64748b' }}>{stats.expenseCount} Expense Items</span>
                <span style={{ color: '#d97706', fontWeight: 600 }}>Open &rarr;</span>
              </div>
            </div>
          )}

          {/* Card 4: Students & Enrollments */}
          <div
            className="kpi-card"
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderTop: '4px solid #8b5cf6',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onClick={() => onNavigate && onNavigate('students')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Enrolled Students</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="users" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#7c3aed', lineHeight: 1.2 }}>
                {stats.totalStudents}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                Active Enrollments: <b>{stats.activeEnrollments}</b>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: '#16a34a' }}><b>{stats.completedEnrollments}</b> Completed</span>
              <span style={{ color: '#dc2626' }}><b>{stats.droppedEnrollments}</b> Dropped</span>
              <span style={{ color: '#7c3aed', fontWeight: 600 }}>Open &rarr;</span>
            </div>
          </div>

          {/* Card 5: Staff Attendance Today */}
          <div
            className="kpi-card"
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderTop: '4px solid #06b6d4',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onClick={() => onNavigate && onNavigate('attendance')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Staff Attendance Today</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ecfeff', color: '#0891b2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="clock" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0891b2', lineHeight: 1.2 }}>
                {stats.staffPresentCount} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#64748b' }}>Present</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                Date: {fmtDay(todayStr)}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: '#dc2626' }}><b>{stats.staffAbsentCount}</b> Absent</span>
              <span style={{ color: '#d97706' }}><b>{stats.staffLeaveCount}</b> Leave</span>
              <span style={{ color: '#0891b2', fontWeight: 600 }}>Open &rarr;</span>
            </div>
          </div>

          {/* Card 6: Batches Routine */}
          <div
            className="kpi-card"
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderTop: '4px solid #6366f1',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onClick={() => onNavigate && onNavigate('batches')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Batches & Classes</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="dashboard" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#4f46e5', lineHeight: 1.2 }}>
                {stats.totalBatches}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                Active Batches in Routine Schedule
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: '#16a34a' }}><b>{stats.ongoingBatches}</b> Ongoing</span>
              <span style={{ color: '#d97706' }}><b>{stats.upcomingBatches}</b> Upcoming</span>
              <span style={{ color: '#4f46e5', fontWeight: 600 }}>Open &rarr;</span>
            </div>
          </div>

          {/* Card 7: Student Attendance */}
          <div
            className="kpi-card"
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderTop: '4px solid #14b8a6',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onClick={() => onNavigate && onNavigate('student-attendance')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Student Attendance</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#ccfbf1', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="clipboard" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#0d9488', lineHeight: 1.2 }}>
                {stats.studentPresentCount} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#64748b' }}>Present Today</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                Total Recorded: {extraData.studentAttendance.length}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: '#dc2626' }}><b>{stats.studentAbsentCount}</b> Absent</span>
              <span style={{ color: '#0d9488', fontWeight: 600 }}>Manage &rarr;</span>
            </div>
          </div>

          {/* Card 8: Tasks & Follow-ups */}
          <div
            className="kpi-card"
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderTop: '4px solid #ec4899',
              borderRadius: '12px',
              padding: '18px 20px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: onNavigate ? 'pointer' : 'default',
              transition: 'transform 0.15s, box-shadow 0.15s'
            }}
            onClick={() => onNavigate && onNavigate('tasks')}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>Tasks & Deadlines</span>
                <span style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="check" size={18} />
                </span>
              </div>
              <div style={{ fontSize: '1.85rem', fontWeight: 800, color: '#db2777', lineHeight: 1.2 }}>
                {stats.pendingTasks} <span style={{ fontSize: '0.95rem', fontWeight: 500, color: '#64748b' }}>Pending</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                Total Assigned Tasks: {stats.totalTasks}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', marginTop: '14px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <span style={{ color: stats.overdueTasks > 0 ? '#dc2626' : '#64748b' }}><b>{stats.overdueTasks}</b> Overdue</span>
              <span style={{ color: '#16a34a' }}><b>{stats.completedTasks}</b> Done</span>
              <span style={{ color: '#db2777', fontWeight: 600 }}>Open &rarr;</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. OPTIONAL EXPANDED ENQUIRY FUNNEL PIPELINE                 */}
      {/* ============================================================ */}
      {showEnquiryPipeline && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#0f172a' }}>
              Enquiry Pipeline & Lead Source Analysis
            </h4>
            <button className="btn sm" type="button" onClick={() => setShowEnquiryPipeline(false)}>
              Close Funnel
            </button>
          </div>
          <EnquiryDashboard
            enquiries={enquiries}
            loading={loading}
            dashRangeKind={dashRangeKind}
            dashFrom={dashFrom}
            dashTo={dashTo}
            onOpenEdit={onOpenEdit}
            onConfirmAdmission={onConfirmAdmission}
            onDrillIntoTable={onDrillIntoTable}
            onGoToNewLead={onGoToNewLead}
          />
        </div>
      )}

      {/* ============================================================ */}
      {/* 4. RECENT ACTIVITIES & LIVE OPERATIONAL STREAMS              */}
      {/* ============================================================ */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              Recent Operational Activity
            </h3>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Latest updates across students, fees, schedules, and attendance.
            </span>
          </div>

          {/* Activity Sub-Tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn sm ${activeActivityTab === 'leads' ? 'primary' : ''}`}
              type="button"
              onClick={() => setActiveActivityTab('leads')}
            >
              Latest Leads
            </button>
            <button
              className={`btn sm ${activeActivityTab === 'payments' ? 'primary' : ''}`}
              type="button"
              onClick={() => setActiveActivityTab('payments')}
            >
              Recent Payments
            </button>
            <button
              className={`btn sm ${activeActivityTab === 'batches' ? 'primary' : ''}`}
              type="button"
              onClick={() => setActiveActivityTab('batches')}
            >
              Batches
            </button>
            <button
              className={`btn sm ${activeActivityTab === 'attendance' ? 'primary' : ''}`}
              type="button"
              onClick={() => setActiveActivityTab('attendance')}
            >
              Staff Today
            </button>
          </div>
        </div>

        {/* Tab 1: Recent Leads */}
        {activeActivityTab === 'leads' && (
          <div>
            {recentEnquiries.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>No enquiries found.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.86rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Student Name</th>
                      <th style={{ textAlign: 'left' }}>Course</th>
                      <th style={{ textAlign: 'left' }}>Phone</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'left' }}>Counselor</th>
                      <th style={{ textAlign: 'right' }}>Date</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentEnquiries.map(enq => (
                      <tr key={enq.id}>
                        <td style={{ fontWeight: 600 }}>{enq.name}</td>
                        <td>{enq.course || '—'}</td>
                        <td>{enq.phone || '—'}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: enq.status === 'Confirmed' ? '#dcfce7' : enq.status === 'Follow-up' ? '#fef9c3' : '#f1f5f9',
                              color: enq.status === 'Confirmed' ? '#16a34a' : enq.status === 'Follow-up' ? '#ca8a04' : '#475569'
                            }}
                          >
                            {enq.status || 'New'}
                          </span>
                        </td>
                        <td>{enq.counselor || '—'}</td>
                        <td style={{ textAlign: 'right', color: '#64748b' }}>{fmtShort(enq.createdAt || enq.inquiryDate)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => onOpenEdit && onOpenEdit(enq.id)}
                            title="Edit Lead"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button
                className="btn sm"
                type="button"
                onClick={() => onNavigate && onNavigate('table')}
                style={{ fontWeight: 600 }}
              >
                Go to All Enquiries &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Recent Payments */}
        {activeActivityTab === 'payments' && (
          <div>
            {recentFees.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>No fee payments recorded.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.86rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Receipt / ID</th>
                      <th style={{ textAlign: 'left' }}>Student Name</th>
                      <th style={{ textAlign: 'left' }}>Course</th>
                      <th style={{ textAlign: 'right' }}>Amount Paid</th>
                      <th style={{ textAlign: 'center' }}>Mode</th>
                      <th style={{ textAlign: 'right' }}>Payment Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentFees.map((fee, idx) => (
                      <tr key={fee.id || idx}>
                        <td style={{ fontWeight: 600, color: 'var(--brand)' }}>
                          #{fee.receiptNumber || fee.receipt_number || fee.id}
                        </td>
                        <td style={{ fontWeight: 600 }}>{fee.studentName || fee.name || '—'}</td>
                        <td>{fee.course || fee.courseName || '—'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                          ₹{Number(fee.amount || fee.paidAmount || 0).toLocaleString('en-IN')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px', fontSize: '0.78rem' }}>
                            {fee.paymentMode || fee.mode || 'Cash'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', color: '#64748b' }}>
                          {fmtShort(fee.paymentDate || fee.createdAt || fee.date)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button
                className="btn sm"
                type="button"
                onClick={() => onNavigate && onNavigate('payments')}
                style={{ fontWeight: 600 }}
              >
                Go to Payments & Receipts &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Batches Routine */}
        {activeActivityTab === 'batches' && (
          <div>
            {todayBatches.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>No batches configured.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.86rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Batch Name</th>
                      <th style={{ textAlign: 'left' }}>Course</th>
                      <th style={{ textAlign: 'left' }}>Time Slot</th>
                      <th style={{ textAlign: 'left' }}>Teacher / Faculty</th>
                      <th style={{ textAlign: 'center' }}>Students</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayBatches.map(b => (
                      <tr key={b.id}>
                        <td style={{ fontWeight: 600 }}>{b.batch_name || b.topic || `Batch #${b.id}`}</td>
                        <td>{b.course_name || '—'}</td>
                        <td>
                          <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, fontSize: '0.78rem' }}>
                            {b.batch_time}
                          </span>
                        </td>
                        <td>{b.instructor_name || 'Unassigned'}</td>
                        <td style={{ textAlign: 'center' }}>{b.student_count || 0}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: b.status === 'Ongoing' ? '#dcfce7' : b.status === 'Completed' ? '#f1f5f9' : '#fef9c3',
                              color: b.status === 'Ongoing' ? '#16a34a' : b.status === 'Completed' ? '#64748b' : '#ca8a04'
                            }}
                          >
                            {b.status || 'Upcoming'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button
                className="btn sm"
                type="button"
                onClick={() => onNavigate && onNavigate('batches')}
                style={{ fontWeight: 600 }}
              >
                Go to Batches Section &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Staff Attendance Today */}
        {activeActivityTab === 'attendance' && (
          <div>
            {todayStaffAttendance.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', padding: '30px 0' }}>
                No staff attendance recorded yet for today ({fmtDay(todayStr)}).
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: '0.86rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left' }}>Staff Member</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                      <th style={{ textAlign: 'left' }}>Check In</th>
                      <th style={{ textAlign: 'left' }}>Check Out</th>
                      <th style={{ textAlign: 'left' }}>Notes / Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayStaffAttendance.map(att => (
                      <tr key={att.id}>
                        <td style={{ fontWeight: 600 }}>{att.user_name || att.full_name || `User #${att.user_id}`}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background: att.status === 'Present' ? '#dcfce7' : att.status === 'Absent' ? '#fee2e2' : '#fef9c3',
                              color: att.status === 'Present' ? '#16a34a' : att.status === 'Absent' ? '#dc2626' : '#ca8a04'
                            }}
                          >
                            {att.status}
                          </span>
                        </td>
                        <td>{att.clock_in || '—'}</td>
                        <td>{att.clock_out || '—'}</td>
                        <td style={{ color: '#64748b' }}>{att.reason || att.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ marginTop: '12px', textAlign: 'right' }}>
              <button
                className="btn sm"
                type="button"
                onClick={() => onNavigate && onNavigate('attendance')}
                style={{ fontWeight: 600 }}
              >
                Go to Staff Attendance &rarr;
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* 5. ALL MODULES QUICK DIRECTORY / NAVIGATION HUB              */}
      {/* ============================================================ */}
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
        <h3 style={{ margin: '0 0 6px', fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
          Portal Sections & Directory
        </h3>
        <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: '#64748b' }}>
          Direct access to all 11 modules and sections of the LBSTIMN Admin Portal.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: '12px'
          }}
        >
          {/* Module: Enquiries */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('table')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb', marginBottom: '6px' }}>
                <Icon name="inbox" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Enquiries</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Manage student leads, follow-ups & conversions.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Payments */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('payments')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', marginBottom: '6px' }}>
                <Icon name="fee" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Payments</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Record student fees, dues & receipts.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Expenses */}
          {isAdmin && (
            <div
              style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => onNavigate && onNavigate('expenses')}
              className="module-tile"
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706', marginBottom: '6px' }}>
                  <Icon name="fee" size={18} />
                  <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Expenses</b>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Institute operational costs & categories.</p>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#d97706', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
            </div>
          )}

          {/* Module: Students */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('students')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#7c3aed', marginBottom: '6px' }}>
                <Icon name="users" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Students</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Registered student roster & enrollments.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#7c3aed', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Student Attendance */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('student-attendance')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0d9488', marginBottom: '6px' }}>
                <Icon name="clipboard" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Student Attendance</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Daily attendance tracking by batch.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#0d9488', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Staff Attendance */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('attendance')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0891b2', marginBottom: '6px' }}>
                <Icon name="clock" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Staff Attendance</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Employee check-ins & admin adjustments.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#0891b2', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Course Content */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('course-content')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4338ca', marginBottom: '6px' }}>
                <Icon name="book" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Course Content</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Curriculum modules, syllabus & notes.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#4338ca', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Batches */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('batches')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4f46e5', marginBottom: '6px' }}>
                <Icon name="dashboard" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Batches</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Routine schedules, teachers & timings.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Content Planner */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('social-planner')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#db2777', marginBottom: '6px' }}>
                <Icon name="calendar" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Content Planner</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Social media schedules & media calendar.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#db2777', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Tasks */}
          <div
            style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
            onClick={() => onNavigate && onNavigate('tasks')}
            className="module-tile"
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ea580c', marginBottom: '6px' }}>
                <Icon name="check" size={18} />
                <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Tasks</b>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Team task manager, deadlines & submissions.</p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#ea580c', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
          </div>

          {/* Module: Users */}
          {isAdmin && (
            <div
              style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s ease' }}
              onClick={() => onNavigate && onNavigate('users')}
              className="module-tile"
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', marginBottom: '6px' }}>
                  <Icon name="users" size={18} />
                  <b style={{ color: '#0f172a', fontSize: '0.9rem' }}>Users</b>
                </div>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>Manage portal staff & access permissions.</p>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, marginTop: '10px' }}>Open Module &rarr;</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
