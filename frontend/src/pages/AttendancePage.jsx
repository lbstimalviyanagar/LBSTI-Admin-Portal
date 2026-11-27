import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';
import { useTableSort } from '../hooks/useTableSort';
import { SortableTh } from '../components/SortableHeader';
import { parseSortableDate } from '../utils/tableSort';

// Helper to slugify status strings for pill styling
const slugify = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Safe date formatter for display and search indexing
const formatDateDisplay = (dateStr) => {
  if (!dateStr) return { display: '-', searchTerms: '' };
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
    if (isNaN(d.getTime())) return { display: dateStr, searchTerms: dateStr };
    const display = d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }); // e.g. "28 Oct 2026"
    const longMonth = d.toLocaleDateString('en-IN', { month: 'long' }); // e.g. "October"
    const weekday = d.toLocaleDateString('en-IN', { weekday: 'long' }); // e.g. "Wednesday"
    return {
      display,
      searchTerms: `${dateStr} ${display} ${longMonth} ${weekday}`.toLowerCase()
    };
  } catch (e) {
    return { display: dateStr, searchTerms: String(dateStr).toLowerCase() };
  }
};

// Safe time formatter for display and search indexing
const formatTimeDisplay = (timeStr) => {
  if (!timeStr) return { display: null, searchTerms: 'active in progress clocked in pending open - not clocked out' };
  try {
    const d = new Date(timeStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) {
      return { display: timeStr, searchTerms: String(timeStr).toLowerCase() };
    }
    const display = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      display,
      searchTerms: `${timeStr} ${display}`.toLowerCase()
    };
  } catch (e) {
    return { display: timeStr, searchTerms: String(timeStr).toLowerCase() };
  }
};

// Safe audit timestamp formatter
const formatAuditDateTime = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (e) {
    return dateStr;
  }
};

// Compute today in IST (YYYY-MM-DD)
const getTodayIST = () => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
};

// Compute yesterday in IST (YYYY-MM-DD)
const getYesterdayIST = () => {
  try {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch (e) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
};

// Helper to extract HH:MM from datetime or time string
const extractTimeString = (dateTimeStr) => {
  if (!dateTimeStr) return '';
  const trimmed = String(dateTimeStr).trim();
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(trimmed)) {
    return trimmed.slice(0, 5);
  }
  try {
    const d = new Date(trimmed.replace(' ', 'T'));
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
  } catch (e) {}
  const match = trimmed.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '';
};

// Calculate total hours from clock-in and clock-out HH:MM
const calculateTotalHours = (inTime, outTime, status) => {
  if (['Absent', 'Leave', 'On Leave'].includes(status)) return '0.00';
  if (!inTime || !outTime) {
    return status === 'Half Day' ? '4.00' : '';
  }
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  const inMin = inH * 60 + inM;
  const outMin = outH * 60 + outM;
  if (outMin > inMin) {
    return ((outMin - inMin) / 60).toFixed(2);
  }
  return '0.00';
};

export default function AttendancePage({ user, users = [], onToast }) {
  const isAdmin = user?.role === 'admin';

  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [savingLeave, setSavingLeave] = useState(false);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loadingLeaveRequests, setLoadingLeaveRequests] = useState(true);
  const [reviewingLeaveId, setReviewingLeaveId] = useState(null);
  const [leaveForm, setLeaveForm] = useState({
    leave_type: 'Sick',
    start_date: getTodayIST(),
    end_date: getTodayIST(),
    reason: ''
  });
  const [filterOptions, setFilterOptions] = useState({ staff: [], statuses: [], dates: [] });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [staffFilter, setStaffFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [customDate, setCustomDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Admin Attendance Management Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    staff_id: '',
    date: getTodayIST(),
    status: 'Present',
    clock_in: '09:30',
    clock_out: '18:00',
    total_hours: '8.50',
    reason: ''
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    id: null,
    staff_id: '',
    date: '',
    status: 'Present',
    clock_in: '',
    clock_out: '',
    total_hours: '',
    reason: ''
  });

  // Audit Log Modal state
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilterStaff, setAuditFilterStaff] = useState('All');
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [targetAttendanceId, setTargetAttendanceId] = useState(null);

  // Load attendance records
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAttendance();
      setRecords(data || []);
    } catch (err) {
      onToast(err.message || 'Failed to load attendance records.', true);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  const loadLeaveRequests = useCallback(async () => {
    setLoadingLeaveRequests(true);
    try {
      setLeaveRequests(await api.getLeaveRequests());
    } catch (err) {
      onToast(err.message || 'Failed to load leave requests.', true);
    } finally {
      setLoadingLeaveRequests(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadRecords();
    loadLeaveRequests();
  }, [loadRecords, loadLeaveRequests]);

  // Load filter options from backend
  useEffect(() => {
    let isMounted = true;
    if (typeof api.getAttendanceFilterOptions === 'function') {
      api.getAttendanceFilterOptions()
        .then(res => {
          if (isMounted && res && typeof res === 'object') {
            setFilterOptions(res);
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, []);

  // Clock In handler (self)
  const handleClockIn = async () => {
    setClockingIn(true);
    try {
      await api.clockIn();
      onToast('Clocked in successfully.');
      loadRecords();
    } catch (err) {
      onToast(err.message || 'Failed to clock in.', true);
    } finally {
      setClockingIn(false);
    }
  };

  // Clock Out handler (self)
  const handleClockOut = async () => {
    setClockingOut(true);
    try {
      await api.clockOut();
      onToast('Clocked out successfully.');
      loadRecords();
    } catch (err) {
      onToast(err.message || 'Failed to clock out.', true);
    } finally {
      setClockingOut(false);
    }
  };

  // Dynamically extract unique staff members from API, users prop, and loaded attendance records
  const staffOptions = useMemo(() => {
    const map = new Map();

    // 1. From API options
    if (Array.isArray(filterOptions?.staff)) {
      filterOptions.staff.forEach(s => {
        const name = (s.name || s.fullName || s.username || '').trim();
        if (name) {
          map.set(String(s.id), { id: String(s.id), name });
        }
      });
    }

    // 2. From users prop
    if (Array.isArray(users)) {
      users.forEach(u => {
        const name = (u.fullName || u.full_name || u.username || '').trim();
        if (name && u.id) {
          if (!map.has(String(u.id))) {
            map.set(String(u.id), { id: String(u.id), name });
          }
        }
      });
    }

    // 3. From loaded records
    records.forEach(r => {
      const id = String(r.staff_id || '');
      const name = (r.staff_name || '').trim();
      if (id && name && !map.has(id)) {
        map.set(id, { id, name });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [filterOptions, users, records]);

  // Dynamically extract distinct historical dates from records and API options
  const distinctHistoricalDates = useMemo(() => {
    const set = new Set();
    if (Array.isArray(filterOptions?.dates)) {
      filterOptions.dates.forEach(d => {
        if (d && typeof d === 'string' && d.trim()) set.add(d.trim());
      });
    }
    records.forEach(r => {
      if (r.date && typeof r.date === 'string' && r.date.trim()) {
        set.add(r.date.trim());
      }
    });
    return Array.from(set).sort().reverse(); // Most recent first
  }, [filterOptions, records]);

  // Status options (from backend or default portal statuses)
  const statusOptions = useMemo(() => {
    const set = new Set(['Present', 'Half Day', 'Leave', 'On Leave', 'Absent']);
    if (Array.isArray(filterOptions?.statuses)) {
      filterOptions.statuses.forEach(s => {
        if (s && typeof s === 'string') set.add(s.trim());
      });
    }
    records.forEach(r => {
      if (r.status && typeof r.status === 'string' && r.status.trim()) {
        set.add(r.status.trim());
      }
    });
    return Array.from(set);
  }, [filterOptions, records]);

  // Pre-computed dates for quick range comparison
  const todayIST = useMemo(() => getTodayIST(), []);
  const yesterdayIST = useMemo(() => getYesterdayIST(), []);
  const currentMonthPrefix = useMemo(() => todayIST.substring(0, 7), [todayIST]); // YYYY-MM

  // Monday of current week in IST
  const mondayOfWeek = useMemo(() => {
    try {
      const now = new Date();
      const day = now.getDay(); // 0 is Sunday
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diff));
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(monday);
    } catch (e) {
      return todayIST;
    }
  }, [todayIST]);

  // Multi-filter matching: search query AND staff AND date AND status
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return records.filter(r => {
      // 1. Staff Filter
      if (staffFilter !== 'All') {
        const matchesId = String(r.staff_id) === String(staffFilter);
        const matchesName = (r.staff_name || '').toLowerCase() === staffFilter.toLowerCase();
        if (!matchesId && !matchesName) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'All') {
        const recStatus = (r.status || '').toLowerCase().trim();
        const selStatus = statusFilter.toLowerCase().trim();
        if (recStatus !== selStatus) return false;
      }

      // 3. Date Filter
      if (dateFilter !== 'All') {
        const recDate = String(r.date || '').trim();
        if (dateFilter === 'today') {
          if (recDate !== todayIST) return false;
        } else if (dateFilter === 'yesterday') {
          if (recDate !== yesterdayIST) return false;
        } else if (dateFilter === 'this_week') {
          if (recDate < mondayOfWeek || recDate > todayIST) return false;
        } else if (dateFilter === 'this_month') {
          if (!recDate.startsWith(currentMonthPrefix)) return false;
        } else if (dateFilter === 'custom') {
          if (customDate && recDate !== customDate) return false;
        } else {
          if (recDate !== dateFilter) return false;
        }
      }

      // 4. Search Query Filter
      if (q) {
        const staffNameStr = String(r.staff_name || '').toLowerCase();
        const staffIdStr = String(r.staff_id || '').toLowerCase();
        const statusStr = String(r.status || '').toLowerCase();
        const hoursStr = String(r.total_hours || '').toLowerCase();
        const reasonStr = String(r.modification_reason || '').toLowerCase();
        const modifiedByStr = String(r.last_modified_by || '').toLowerCase();
        const hoursLabel = `${hoursStr} hrs`;

        const dateMeta = formatDateDisplay(r.date);
        const clockInMeta = formatTimeDisplay(r.clock_in);
        const clockOutMeta = formatTimeDisplay(r.clock_out);

        const haystack = [
          staffNameStr,
          staffIdStr,
          statusStr,
          hoursStr,
          hoursLabel,
          reasonStr,
          modifiedByStr,
          dateMeta.searchTerms,
          clockInMeta.searchTerms,
          clockOutMeta.searchTerms
        ].join(' ');

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [records, searchQuery, staffFilter, dateFilter, customDate, statusFilter, todayIST, yesterdayIST, mondayOfWeek, currentMonthPrefix]);

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    staffFilter !== 'All' ||
    dateFilter !== 'All' ||
    (dateFilter === 'custom' && customDate) ||
    statusFilter !== 'All'
  );

  const clearFilters = () => {
    setSearchQuery('');
    setStaffFilter('All');
    setDateFilter('All');
    setCustomDate('');
    setStatusFilter('All');
    setPage(1);
  };

  useEffect(() => {
    setPage(1);
  }, [searchQuery, staffFilter, dateFilter, customDate, statusFilter, pageSize]);

  // Sorting state for Attendance table
  const {
    sortKey: attendanceSortKey,
    sortDirection: attendanceSortDir,
    handleSort: handleAttendanceSort,
    sortList: sortAttendance
  } = useTableSort({ key: 'date', direction: 'desc' });

  const attendanceCustomGetters = useMemo(() => ({
    clock_in: (r) => (r.clock_in ? parseSortableDate(r.clock_in) : null),
    clock_out: (r) => (r.clock_out ? parseSortableDate(r.clock_out) : null),
    total_hours: (r) => (r.total_hours != null && r.total_hours !== '' ? parseFloat(r.total_hours) : null)
  }), []);

  const sortedRecords = useMemo(() => {
    return sortAttendance(filteredRecords, attendanceCustomGetters);
  }, [filteredRecords, sortAttendance, attendanceCustomGetters]);

  const totalRecords = sortedRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRecords = sortedRecords.slice(startIndex, startIndex + pageSize);

  // -------------------------------------------------------------
  // Admin Action Handlers: Add Attendance
  // -------------------------------------------------------------
  const handleOpenAdd = () => {
    const defaultStaff = staffOptions.length > 0 ? staffOptions[0].id : '';
    setAddForm({
      staff_id: defaultStaff,
      date: getTodayIST(),
      status: 'Present',
      clock_in: '09:30',
      clock_out: '18:00',
      total_hours: '8.50',
      reason: ''
    });
    setShowAddModal(true);
  };

  const handleOpenLeave = () => {
    if (isAdmin) return;
    setLeaveForm({
      leave_type: 'Sick',
      start_date: getTodayIST(),
      end_date: getTodayIST(),
      reason: ''
    });
    setShowLeaveModal(true);
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (isAdmin) {
      onToast('Only staff members can submit leave requests.', true);
      return;
    }
    if (!leaveForm.start_date || !leaveForm.end_date || leaveForm.end_date < leaveForm.start_date || !leaveForm.leave_type || !leaveForm.reason.trim()) {
      onToast('Please complete all leave details.', true);
      return;
    }

    setSavingLeave(true);
    try {
      await api.submitLeaveRequest({
        leave_type: leaveForm.leave_type,
        start_date: leaveForm.start_date,
        end_date: leaveForm.end_date,
        reason: leaveForm.reason.trim()
      });
      onToast('Leave request submitted for approval.');
      setShowLeaveModal(false);
      await loadLeaveRequests();
    } catch (err) {
      onToast(err.message || 'Failed to submit leave request.', true);
    } finally {
      setSavingLeave(false);
    }
  };

  const handleReviewLeaveRequest = async (request, status) => {
    setReviewingLeaveId(request.id);
    try {
      await api.reviewLeaveRequest(request.id, status);
      onToast(`Leave request ${status.toLowerCase()}.`);
      await Promise.all([loadLeaveRequests(), loadRecords()]);
    } catch (err) {
      onToast(err.message || 'Failed to review leave request.', true);
    } finally {
      setReviewingLeaveId(null);
    }
  };

  const handleAddStatusChange = (newStatus) => {
    let inTime = addForm.clock_in;
    let outTime = addForm.clock_out;
    if (['Absent', 'Leave', 'On Leave'].includes(newStatus)) {
      inTime = '';
      outTime = '';
    } else if (!inTime) {
      inTime = '09:30';
      outTime = newStatus === 'Half Day' ? '13:30' : '18:00';
    }
    const hrs = calculateTotalHours(inTime, outTime, newStatus);
    setAddForm(prev => ({
      ...prev,
      status: newStatus,
      clock_in: inTime,
      clock_out: outTime,
      total_hours: hrs
    }));
  };

  const handleAddClockChange = (field, val) => {
    const updated = { ...addForm, [field]: val };
    const hrs = calculateTotalHours(
      field === 'clock_in' ? val : addForm.clock_in,
      field === 'clock_out' ? val : addForm.clock_out,
      addForm.status
    );
    if (hrs !== '') {
      updated.total_hours = hrs;
    }
    setAddForm(updated);
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    if (!addForm.staff_id) {
      onToast('Please select a staff member.', true);
      return;
    }
    if (!addForm.date) {
      onToast('Please choose a date.', true);
      return;
    }
    if (!addForm.reason.trim()) {
      onToast('A reason for adding this attendance record is required.', true);
      return;
    }

    setSavingAdd(true);
    try {
      const payload = {
        staff_id: addForm.staff_id,
        date: addForm.date,
        status: addForm.status,
        clock_in: addForm.clock_in ? `${addForm.clock_in}:00` : null,
        clock_out: addForm.clock_out ? `${addForm.clock_out}:00` : null,
        total_hours: addForm.total_hours !== '' ? parseFloat(addForm.total_hours) : 0,
        reason: addForm.reason.trim()
      };
      await api.adminAddAttendance(payload);
      onToast('Staff attendance added successfully and logged in audit history.');
      setShowAddModal(false);
      loadRecords();
    } catch (err) {
      onToast(err.message || 'Failed to add attendance record.', true);
    } finally {
      setSavingAdd(false);
    }
  };

  // -------------------------------------------------------------
  // Admin Action Handlers: Edit Attendance
  // -------------------------------------------------------------
  const handleOpenEdit = (rec) => {
    setEditingRecord(rec);
    const inTime = extractTimeString(rec.clock_in);
    const outTime = extractTimeString(rec.clock_out);
    setEditForm({
      id: rec.id,
      staff_id: String(rec.staff_id),
      date: rec.date ? rec.date.split('T')[0] : getTodayIST(),
      status: rec.status || 'Present',
      clock_in: inTime,
      clock_out: outTime,
      total_hours: rec.total_hours != null ? String(rec.total_hours) : '',
      reason: ''
    });
    setShowEditModal(true);
  };

  const handleEditStatusChange = (newStatus) => {
    let inTime = editForm.clock_in;
    let outTime = editForm.clock_out;
    if (['Absent', 'Leave', 'On Leave'].includes(newStatus)) {
      inTime = '';
      outTime = '';
    } else if (!inTime) {
      inTime = '09:30';
      outTime = newStatus === 'Half Day' ? '13:30' : '18:00';
    }
    const hrs = calculateTotalHours(inTime, outTime, newStatus);
    setEditForm(prev => ({
      ...prev,
      status: newStatus,
      clock_in: inTime,
      clock_out: outTime,
      total_hours: hrs
    }));
  };

  const handleEditClockChange = (field, val) => {
    const updated = { ...editForm, [field]: val };
    const hrs = calculateTotalHours(
      field === 'clock_in' ? val : editForm.clock_in,
      field === 'clock_out' ? val : editForm.clock_out,
      editForm.status
    );
    if (hrs !== '') {
      updated.total_hours = hrs;
    }
    setEditForm(updated);
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!editForm.reason.trim()) {
      onToast('Please enter a reason for this modification.', true);
      return;
    }

    setSavingEdit(true);
    try {
      const payload = {
        staff_id: editForm.staff_id,
        date: editForm.date,
        status: editForm.status,
        clock_in: editForm.clock_in ? `${editForm.clock_in}:00` : '',
        clock_out: editForm.clock_out ? `${editForm.clock_out}:00` : '',
        total_hours: editForm.total_hours !== '' ? parseFloat(editForm.total_hours) : 0,
        reason: editForm.reason.trim()
      };
      await api.adminUpdateAttendance(editForm.id, payload);
      onToast('Attendance record updated and audit log created successfully.');
      setShowEditModal(false);
      loadRecords();
    } catch (err) {
      onToast(err.message || 'Failed to update attendance record.', true);
    } finally {
      setSavingEdit(false);
    }
  };

  // -------------------------------------------------------------
  // Admin Action Handlers: Audit Log Viewer
  // -------------------------------------------------------------
  const loadAuditLogs = useCallback(async (attId = null) => {
    setLoadingAudit(true);
    try {
      const params = {};
      if (attId) params.attendance_id = attId;
      const logs = await api.getAttendanceAuditLogs(params);
      setAuditLogs(Array.isArray(logs) ? logs : []);
    } catch (err) {
      onToast(err.message || 'Failed to load audit logs.', true);
    } finally {
      setLoadingAudit(false);
    }
  }, [onToast]);

  const handleOpenGeneralAudit = () => {
    setTargetAttendanceId(null);
    setAuditFilterStaff('All');
    setAuditSearchQuery('');
    setShowAuditModal(true);
    loadAuditLogs(null);
  };

  const handleOpenRecordAudit = (attId) => {
    setTargetAttendanceId(attId);
    setAuditFilterStaff('All');
    setAuditSearchQuery('');
    setShowAuditModal(true);
    loadAuditLogs(attId);
  };

  const filteredAuditLogs = useMemo(() => {
    let list = auditLogs;
    if (targetAttendanceId) {
      list = list.filter(l => String(l.attendance_id) === String(targetAttendanceId));
    }
    if (auditFilterStaff !== 'All') {
      list = list.filter(l => String(l.staff_id) === String(auditFilterStaff));
    }
    if (auditSearchQuery.trim()) {
      const q = auditSearchQuery.trim().toLowerCase();
      list = list.filter(l => {
        const adminStr = String(l.admin_name || l.admin_full_name || '').toLowerCase();
        const staffStr = String(l.staff_name || '').toLowerCase();
        const reasonStr = String(l.reason || '').toLowerCase();
        const actionStr = String(l.action || '').toLowerCase();
        const dateStr = String(l.created_at || '').toLowerCase();
        return (
          adminStr.includes(q) ||
          staffStr.includes(q) ||
          reasonStr.includes(q) ||
          actionStr.includes(q) ||
          dateStr.includes(q)
        );
      });
    }
    return list;
  }, [auditLogs, targetAttendanceId, auditFilterStaff, auditSearchQuery]);

  return (
    <div className="page-section">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h2>Staff Attendance</h2>
          <p>
            {isAdmin
          ? 'Manage staff attendance, review leave requests, adjust records, and inspect audit history.'
          : 'Track your attendance, request leave, and review your attendance history.'}
          </p>
        </div>
        <div className="controls">
          {/* Admin Management Buttons */}
          {isAdmin && (
            <>
              <button
                className="btn btn-primary"
                type="button"
                onClick={handleOpenAdd}
                title="Add or mark missing attendance for staff"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="ic"><Icon name="plus" size={16} /></span>
                Add Staff Attendance
              </button>

              <button
                className="btn"
                type="button"
                onClick={handleOpenGeneralAudit}
                title="View complete audit log of modifications"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="ic"><Icon name="history" size={16} /></span>
                Audit Log
              </button>
            </>
          )}

          {/* Clock In / Clock Out for current user */}
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleClockIn}
            disabled={clockingIn || clockingOut}
            title="Clock In for today"
          >
            <span className="ic"><Icon name="clock" size={16} /></span>
            {clockingIn ? 'Clocking In...' : 'Clock In'}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={handleClockOut}
            disabled={clockingIn || clockingOut}
            title="Clock Out for today"
          >
            <span className="ic"><Icon name="clock" size={16} /></span>
            {clockingOut ? 'Clocking Out...' : 'Clock Out'}
          </button>
          {!isAdmin && (
            <button
              className="btn"
              type="button"
              onClick={handleOpenLeave}
              style={{ color: '#6d28d9', borderColor: '#c4b5fd' }}
              title="Submit a leave request for approval"
            >
              <span className="ic"><Icon name="calendar" size={16} /></span>
              Request Leave
            </button>
          )}
        </div>
      </div>

      <div className="card section" style={{ marginBottom: '1.25rem', padding: '1.1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{isAdmin ? 'Staff Leave Requests' : 'My Leave Requests'}</h3>
            <p style={{ margin: '3px 0 0', color: 'var(--muted)', fontSize: '0.82rem' }}>
              {isAdmin ? 'Approve or reject pending requests. Approved dates are recorded as On Leave.' : 'Requests remain pending until an administrator reviews them.'}
            </p>
          </div>
          <button className="btn" type="button" onClick={loadLeaveRequests} disabled={loadingLeaveRequests}>
            <span className={`ic ${loadingLeaveRequests ? 'spin' : ''}`}><Icon name="refresh" size={15} /></span>
            Refresh
          </button>
        </div>
        {loadingLeaveRequests ? (
          <div style={{ padding: '1rem', color: 'var(--muted)' }}>Loading leave requests...</div>
        ) : leaveRequests.length === 0 ? (
          <div style={{ padding: '1rem', border: '1px dashed var(--line)', borderRadius: '8px', color: 'var(--muted)' }}>
            No leave requests yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  {isAdmin && <th>Staff</th>}
                  <th>Dates</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {isAdmin && <th style={{ textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map(request => (
                  <tr key={request.id}>
                    {isAdmin && <td>{request.staff_name || `Staff #${request.staff_id}`}</td>}
                    <td>{formatDateDisplay(request.start_date).display} to {formatDateDisplay(request.end_date).display}</td>
                    <td>{request.leave_type}</td>
                    <td style={{ minWidth: '180px', whiteSpace: 'pre-wrap' }}>{request.reason}</td>
                    <td>
                      <span
                        className="pill"
                        style={{
                          background: request.status === 'Approved' ? '#dcfce7' : request.status === 'Rejected' ? '#fee2e2' : '#fef3c7',
                          color: request.status === 'Approved' ? '#166534' : request.status === 'Rejected' ? '#991b1b' : '#92400e'
                        }}
                      >
                        {request.status}
                      </span>
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {request.status === 'Pending' ? (
                          <span style={{ display: 'inline-flex', gap: '6px' }}>
                            <button className="btn primary" type="button" disabled={reviewingLeaveId === request.id} onClick={() => handleReviewLeaveRequest(request, 'Approved')}>
                              Approve
                            </button>
                            <button className="btn" type="button" disabled={reviewingLeaveId === request.id} onClick={() => handleReviewLeaveRequest(request, 'Rejected')}>
                              Reject
                            </button>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                            {request.reviewed_by_name ? `Reviewed by ${request.reviewed_by_name}` : ''}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dynamic Search & Filtering Toolbar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Real-time Dynamic Search Bar */}
          <div className="search" style={{ minWidth: '240px', flex: '1 1 260px' }}>
            <span className="si"><Icon name="search" size={18} /></span>
            <input
              className="input"
              type="search"
              placeholder="Search staff, date, clock-in, clock-out, status, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              aria-label="Search attendance records"
            />
          </div>

          {/* Staff Member Dropdown (Visible for Admins) */}
          {isAdmin && (
            <div className="fl">
              <select
                className="select"
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                aria-label="Filter by staff member"
                title="Filter by staff member"
                style={{ minWidth: '160px' }}
              >
                <option value="All">All Staff Members</option>
                {staffOptions.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Date Filter Dropdown */}
          <div className="fl">
            <select
              className="select"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter by date"
              title="Filter by date"
              style={{ minWidth: '140px' }}
            >
              <option value="today">Today ({formatDateDisplay(todayIST).display})</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_month">This Month</option>
              <option value="this_week">This Week</option>
              <option value="custom">Specific Date...</option>
              <option value="All">All Dates</option>
              {distinctHistoricalDates.length > 0 && (
                <optgroup label="Historical Dates">
                  {distinctHistoricalDates.map(d => (
                    <option key={d} value={d}>
                      {formatDateDisplay(d).display}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Custom Date Picker */}
          {dateFilter === 'custom' && (
            <div className="fl">
              <input
                className="input"
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                aria-label="Pick custom date"
                title="Pick custom date"
                style={{ minWidth: '150px' }}
              />
            </div>
          )}

          {/* Status Dropdown Filter */}
          <div className="fl">
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              title="Filter by status"
              style={{ minWidth: '140px' }}
            >
              <option value="All">All Statuses</option>
              {statusOptions.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              className="btn"
              type="button"
              onClick={clearFilters}
              title="Clear all active filters"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="ic"><Icon name="x" size={15} /></span>
              Clear Filters
            </button>
          )}

          {/* Quick Refresh & Result Count */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.86rem', color: 'var(--muted)', fontWeight: '600' }}>
              {hasActiveFilters
                ? `Showing ${filteredRecords.length} of ${records.length} records`
                : `${records.length} ${records.length === 1 ? 'record' : 'records'} total`}
            </span>
            <button
              className="btn icon-btn"
              type="button"
              onClick={loadRecords}
              title="Refresh attendance records"
              aria-label="Refresh attendance"
            >
              <span className={`ic ${loading ? 'spin' : ''}`}><Icon name="refresh" size={16} /></span>
            </button>
          </div>
        </div>
      </div>

      {/* Attendance Table Card */}
      <div className="card table-container">
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
            Loading attendance records...
          </div>
        ) : (
          <>
            <table className="table mobile-card-stack">
              <thead>
                <tr>
                  {isAdmin && (
                    <SortableTh colKey="staff_name" label="Staff Member" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  )}
                  <SortableTh colKey="date" label="Date" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  <SortableTh colKey="clock_in" label="Clock In" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  <SortableTh colKey="clock_out" label="Clock Out" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  <SortableTh colKey="total_hours" label="Total Hours" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  <SortableTh colKey="status" label="Status" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  {isAdmin && (
                    <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.length > 0 ? (
                  paginatedRecords.map(r => {
                    const dateMeta = formatDateDisplay(r.date);
                    const clockInMeta = formatTimeDisplay(r.clock_in);
                    const clockOutMeta = formatTimeDisplay(r.clock_out);
                    const statusSlug = slugify(r.status || 'present');

                    return (
                      <tr key={r.id}>
                        {isAdmin && (
                          <td data-label="Staff Member" data-card-primary>
                            <b>{r.staff_name || `Staff #${r.staff_id}`}</b>
                            {r.staff_username && (
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--muted)' }}>
                                @{r.staff_username}
                              </span>
                            )}
                          </td>
                        )}
                        <td data-label="Date">
                          <span>{dateMeta.display}</span>
                          {Boolean(r.is_admin_modified) && (
                            <div style={{ marginTop: '3px' }}>
                              <span
                                className="pill"
                                style={{
                                  background: '#fef3c7',
                                  color: '#92400e',
                                  border: '1px solid #fde68a',
                                  fontSize: '0.70rem',
                                  padding: '2px 6px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                title={`Adjusted by ${r.last_modified_by || 'Admin'}${r.last_modified_at ? ' on ' + formatAuditDateTime(r.last_modified_at) : ''}${r.modification_reason ? '\nReason: ' + r.modification_reason : ''}`}
                              >
                                ✏ Adjusted
                              </span>
                            </div>
                          )}
                        </td>
                        <td data-label="Clock In">
                          {clockInMeta.display ? (
                            <span>{clockInMeta.display}</span>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td data-label="Clock Out">
                          {clockOutMeta.display ? (
                            <span>{clockOutMeta.display}</span>
                          ) : r.clock_in && !['absent', 'leave'].includes(String(r.status || '').toLowerCase()) ? (
                            <span className="pill s-active" title="Clocked in, awaiting clock-out">
                              Active
                            </span>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td data-label="Total Hours">
                          {['absent', 'leave', 'on leave'].includes(String(r.status || '').toLowerCase()) ? (
                            <span className="muted">0.00 hrs</span>
                          ) : r.total_hours != null && r.total_hours !== '' ? (
                            <span>{Number(r.total_hours).toFixed(2)} hrs</span>
                          ) : !r.clock_out && r.clock_in ? (
                            <span className="muted" style={{ fontSize: '0.82rem' }}>In progress</span>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td data-label="Status">
                          <span className={`pill s-${statusSlug}`} title={r.leave_type ? `Leave type: ${r.leave_type}` : undefined}>
                            {r.status || 'Present'}
                          </span>
                          {r.leave_type && (
                            <span style={{ display: 'block', marginTop: '3px', fontSize: '0.75rem', color: 'var(--muted)' }}>
                              {r.leave_type}
                            </span>
                          )}
                        </td>
                        {isAdmin && (
                          <td data-label="Actions" data-card-actions style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                className="btn sm"
                                type="button"
                                onClick={() => handleOpenEdit(r)}
                                title="Edit check-in, check-out, date, or status"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}
                              >
                                <span className="ic"><Icon name="edit" size={13} /></span>
                                Edit
                              </button>
                              <button
                                className="btn sm icon-btn"
                                type="button"
                                onClick={() => handleOpenRecordAudit(r.id)}
                                title="View audit history for this record"
                                aria-label="View audit log"
                              >
                                <span className="ic"><Icon name="history" size={14} /></span>
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr className="empty-row">
                    <td colSpan={isAdmin ? 7 : 5}>
                      {records.length === 0 ? (
                        <div className="empty">
                          <div className="ei"><Icon name="inbox" size={24} /></div>
                          <b>No attendance records yet</b>
                          <span>Staff clock-in and clock-out entries will appear here.</span>
                        </div>
                      ) : (
                        <div className="empty">
                          <div className="ei"><Icon name="search" size={24} /></div>
                          <b>No attendance records match</b>
                          <span>No attendance entries matched your search query or selected filters.</span>
                          <br />
                          <button className="btn" type="button" onClick={clearFilters}>
                            <span className="ic"><Icon name="x" size={16} /></span> Clear filters
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {filteredRecords.length > 0 && (
              <div className="pager">
                <span>
                  Showing {startIndex + 1}–{Math.min(startIndex + pageSize, totalRecords)} of {totalRecords} {totalRecords === 1 ? 'record' : 'records'}
                </span>
                <div className="btns">
                  <span className="rows">
                    Rows per page:
                    <select
                      className="select"
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      aria-label="Rows per page"
                      style={{ marginLeft: '6px' }}
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </span>
                  <button
                    className="btn sm"
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    title="Previous page"
                  >
                    Previous
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: '600', padding: '0 4px' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="btn sm"
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    title="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL 1: Add Missing Staff Attendance (Admin Only)          */}
      {/* ============================================================ */}
      {showAddModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}
        >
          <div
            className="modal"
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '540px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
            }}
          >
            <div className="modal-head" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Add Staff Attendance</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Record missing attendance for an employee for today or previous dates.
                </p>
              </div>
              <button
                className="btn close-btn"
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitAdd}>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Staff Member */}
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                    Staff Member *
                  </label>
                  <select
                    className="select"
                    value={addForm.staff_id}
                    onChange={(e) => setAddForm({ ...addForm, staff_id: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  >
                    <option value="" disabled>-- Select Staff Member --</option>
                    {staffOptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date & Status Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Attendance Date *
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={addForm.date}
                      onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Attendance Status *
                    </label>
                    <select
                      className="select"
                      value={addForm.status}
                      onChange={(e) => handleAddStatusChange(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="Present">Present</option>
                      <option value="Half Day">Half Day</option>
                      <option value="Leave">Leave</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                </div>

                {/* Clock In & Clock Out */}
                {!['Absent', 'Leave'].includes(addForm.status) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <label className="label" style={{ fontWeight: 600, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                        Clock In
                      </label>
                      <input
                        type="time"
                        className="input"
                        value={addForm.clock_in}
                        onChange={(e) => handleAddClockChange('clock_in', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontWeight: 600, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                        Clock Out
                      </label>
                      <input
                        type="time"
                        className="input"
                        value={addForm.clock_out}
                        onChange={(e) => handleAddClockChange('clock_out', e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div>
                      <label className="label" style={{ fontWeight: 600, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                        Total Hours
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="24"
                        className="input"
                        value={addForm.total_hours}
                        onChange={(e) => setAddForm({ ...addForm, total_hours: e.target.value })}
                        placeholder="8.5"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>
                )}

                {/* Mandatory Reason */}
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                    Reason for Adding Attendance *
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={addForm.reason}
                    onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                    required
                    placeholder="e.g. Employee forgot to clock in; worked regular shift verified with department head."
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>
                    This reason will be permanently recorded in the administrator audit log.
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowAddModal(false)}
                  disabled={savingAdd}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingAdd}
                >
                  {savingAdd ? 'Saving...' : 'Add Attendance Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveModal && !isAdmin && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !savingLeave) setShowLeaveModal(false); }}
        >
          <div
            className="modal"
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
            }}
          >
            <div className="modal-head" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Request Leave</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Leave will be recorded in attendance only after it is approved.
                </p>
              </div>
              <button
                className="btn close-btn"
                type="button"
                onClick={() => setShowLeaveModal(false)}
                disabled={savingLeave}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmitLeave}>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Leave Type *
                    </label>
                    <select
                      className="select"
                      value={leaveForm.leave_type}
                      onChange={(e) => setLeaveForm({ ...leaveForm, leave_type: e.target.value })}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="Sick">Sick</option>
                      <option value="Casual">Casual</option>
                      <option value="Paid">Paid</option>
                      <option value="Unpaid">Unpaid</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Start Date *
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={leaveForm.start_date}
                      onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                    End Date *
                  </label>
                  <input
                    type="date"
                    className="input"
                    min={leaveForm.start_date}
                    value={leaveForm.end_date}
                    onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                    Reason *
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={leaveForm.reason}
                    onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                    required
                    maxLength={2000}
                    placeholder="Enter the reason for this leave."
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowLeaveModal(false)}
                  disabled={savingLeave}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={savingLeave}
                  style={{ color: '#fff', background: '#7c3aed', borderColor: '#7c3aed' }}
                >
                  {savingLeave ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 2: Edit Staff Attendance (Admin Only)                 */}
      {/* ============================================================ */}
      {showEditModal && editingRecord && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}
        >
          <div
            className="modal"
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
            }}
          >
            <div className="modal-head" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>Edit Attendance Record</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                  Modifying attendance for <b>{editingRecord.staff_name || `Staff #${editingRecord.staff_id}`}</b>
                </p>
              </div>
              <button
                className="btn close-btn"
                type="button"
                onClick={() => setShowEditModal(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitEdit}>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Previous State Card for Reference */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem' }}>
                  <div style={{ fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Original Record Summary:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', color: '#64748b' }}>
                    <div><b>Date:</b> {editingRecord.date}</div>
                    <div><b>Status:</b> {editingRecord.status || 'Present'}</div>
                    <div><b>Clock In:</b> {formatTimeDisplay(editingRecord.clock_in).display || 'None'}</div>
                    <div><b>Clock Out:</b> {formatTimeDisplay(editingRecord.clock_out).display || 'None'}</div>
                    <div><b>Total Hours:</b> {editingRecord.total_hours != null ? `${editingRecord.total_hours} hrs` : '-'}</div>
                  </div>
                </div>

                {/* Staff Selection (can reassign if wrong staff was marked) */}
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                    Staff Member *
                  </label>
                  <select
                    className="select"
                    value={editForm.staff_id}
                    onChange={(e) => setEditForm({ ...editForm, staff_id: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  >
                    {staffOptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {/* Date & Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Date *
                    </label>
                    <input
                      type="date"
                      className="input"
                      value={editForm.date}
                      onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Status *
                    </label>
                    <select
                      className="select"
                      value={editForm.status}
                      onChange={(e) => handleEditStatusChange(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    >
                      <option value="Present">Present</option>
                      <option value="Half Day">Half Day</option>
                      <option value="Leave">Leave</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Absent">Absent</option>
                    </select>
                  </div>
                </div>

                {/* Clock In, Clock Out, Total Hours */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                      Clock In Time
                    </label>
                    <input
                      type="time"
                      className="input"
                      value={editForm.clock_in}
                      onChange={(e) => handleEditClockChange('clock_in', e.target.value)}
                      disabled={['Absent', 'Leave', 'On Leave'].includes(editForm.status)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                      Clock Out Time
                    </label>
                    <input
                      type="time"
                      className="input"
                      value={editForm.clock_out}
                      onChange={(e) => handleEditClockChange('clock_out', e.target.value)}
                      disabled={['Absent', 'Leave', 'On Leave'].includes(editForm.status)}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label className="label" style={{ fontWeight: 600, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                      Total Hours
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="24"
                      className="input"
                      value={editForm.total_hours}
                      onChange={(e) => setEditForm({ ...editForm, total_hours: e.target.value })}
                      placeholder="0.00"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>

                {/* Mandatory Modification Reason */}
                <div>
                  <label className="label" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                    Reason for Modification *
                  </label>
                  <textarea
                    className="input"
                    rows={3}
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                    required
                    placeholder="Enter the specific reason for updating this record (e.g. Employee forgot to punch out at 6:00 PM; verified with shift supervisor)..."
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>
                    Every change is recorded in the permanent audit trail with admin name and timestamp.
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowEditModal(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Saving Changes...' : 'Save & Log Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL 3: Audit Log Viewer (Admin Only)                      */}
      {/* ============================================================ */}
      {showAuditModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1050,
            padding: '16px'
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowAuditModal(false); }}
        >
          <div
            className="modal"
            style={{
              background: '#fff',
              borderRadius: '12px',
              maxWidth: '840px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="modal-head" style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icon name="history" size={20} />
                  Staff Attendance Audit Log
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                  {targetAttendanceId
                    ? `Showing modification history for Attendance Entry #${targetAttendanceId}`
                    : 'Complete immutable log of all administrator attendance additions and adjustments.'}
                </p>
              </div>
              <button
                className="btn close-btn"
                type="button"
                onClick={() => setShowAuditModal(false)}
                aria-label="Close audit modal"
              >
                ×
              </button>
            </div>

            {/* Audit Toolbar */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--line)', background: '#f8fafc', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="search" style={{ minWidth: '220px', flex: 1 }}>
                <span className="si"><Icon name="search" size={16} /></span>
                <input
                  type="search"
                  className="input"
                  placeholder="Search admin, staff, reason, action..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  style={{ fontSize: '0.85rem' }}
                />
              </div>

              {!targetAttendanceId && (
                <div className="fl">
                  <select
                    className="select"
                    value={auditFilterStaff}
                    onChange={(e) => setAuditFilterStaff(e.target.value)}
                    style={{ fontSize: '0.85rem', minWidth: '150px' }}
                  >
                    <option value="All">All Staff Members</option>
                    {staffOptions.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {targetAttendanceId && (
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => { setTargetAttendanceId(null); loadAuditLogs(null); }}
                  title="Show all records"
                >
                  Show All Staff Logs
                </button>
              )}

              <button
                type="button"
                className="btn sm icon-btn"
                onClick={() => loadAuditLogs(targetAttendanceId)}
                title="Refresh audit log"
              >
                <span className={`ic ${loadingAudit ? 'spin' : ''}`}><Icon name="refresh" size={15} /></span>
              </button>
            </div>

            {/* Audit Log Content List */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              {loadingAudit ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                  Loading audit trail...
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <div style={{ marginBottom: '8px' }}><Icon name="inbox" size={30} /></div>
                  <b>No audit logs found</b>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem' }}>
                    Modifications made by administrators will be permanently listed here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredAuditLogs.map((log) => {
                    const prev = log.previous_data || {};
                    const next = log.updated_data || {};
                    const isCreate = log.action === 'CREATE';

                    return (
                      <div
                        key={log.id}
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '14px 16px',
                          background: '#fff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}
                      >
                        {/* Audit Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              className="pill"
                              style={{
                                background: isCreate ? '#dcfce7' : '#e0e7ff',
                                color: isCreate ? '#15803d' : '#4338ca',
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                padding: '3px 8px'
                              }}
                            >
                              {isCreate ? '+ MANUAL ENTRY' : '✏ MODIFICATION'}
                            </span>
                            <span style={{ fontWeight: 600, fontSize: '0.92rem', color: '#1e293b' }}>
                              {log.staff_name || `Staff #${log.staff_id}`}
                            </span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                              (Entry #{log.attendance_id})
                            </span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                            {formatAuditDateTime(log.created_at)}
                          </div>
                        </div>

                        {/* Admin Badge */}
                        <div style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '10px' }}>
                          Modified by: <b>{log.admin_name || log.admin_full_name || 'Admin'}</b>
                        </div>

                        {/* Changes Comparison */}
                        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '10px 12px', fontSize: '0.82rem', marginBottom: '10px' }}>
                          {isCreate ? (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                              <div><b>Date:</b> {next.date || '-'}</div>
                              <div><b>Status:</b> {next.status || 'Present'}</div>
                              <div><b>Clock In:</b> {formatTimeDisplay(next.clock_in).display || 'None'}</div>
                              <div><b>Clock Out:</b> {formatTimeDisplay(next.clock_out).display || 'None'}</div>
                              <div><b>Total Hours:</b> {next.total_hours != null ? `${next.total_hours} hrs` : '-'}</div>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {/* Date change */}
                              {prev.date !== next.date && (
                                <div>
                                  <span style={{ fontWeight: 600, color: '#475569' }}>Date: </span>
                                  <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{prev.date}</span>
                                  <span style={{ margin: '0 6px', color: '#64748b' }}>→</span>
                                  <span style={{ fontWeight: 600, color: '#16a34a' }}>{next.date}</span>
                                </div>
                              )}

                              {/* Status change */}
                              {prev.status !== next.status && (
                                <div>
                                  <span style={{ fontWeight: 600, color: '#475569' }}>Status: </span>
                                  <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>{prev.status || 'None'}</span>
                                  <span style={{ margin: '0 6px', color: '#64748b' }}>→</span>
                                  <span style={{ fontWeight: 600, color: '#16a34a' }}>{next.status || 'None'}</span>
                                </div>
                              )}

                              {/* Clock In change */}
                              {prev.clock_in !== next.clock_in && (
                                <div>
                                  <span style={{ fontWeight: 600, color: '#475569' }}>Clock In: </span>
                                  <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>
                                    {formatTimeDisplay(prev.clock_in).display || 'None'}
                                  </span>
                                  <span style={{ margin: '0 6px', color: '#64748b' }}>→</span>
                                  <span style={{ fontWeight: 600, color: '#16a34a' }}>
                                    {formatTimeDisplay(next.clock_in).display || 'None'}
                                  </span>
                                </div>
                              )}

                              {/* Clock Out change */}
                              {prev.clock_out !== next.clock_out && (
                                <div>
                                  <span style={{ fontWeight: 600, color: '#475569' }}>Clock Out: </span>
                                  <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>
                                    {formatTimeDisplay(prev.clock_out).display || 'None'}
                                  </span>
                                  <span style={{ margin: '0 6px', color: '#64748b' }}>→</span>
                                  <span style={{ fontWeight: 600, color: '#16a34a' }}>
                                    {formatTimeDisplay(next.clock_out).display || 'None'}
                                  </span>
                                </div>
                              )}

                              {/* Total Hours change */}
                              {String(prev.total_hours) !== String(next.total_hours) && (
                                <div>
                                  <span style={{ fontWeight: 600, color: '#475569' }}>Total Hours: </span>
                                  <span style={{ textDecoration: 'line-through', color: '#ef4444' }}>
                                    {prev.total_hours != null ? `${prev.total_hours} hrs` : '-'}
                                  </span>
                                  <span style={{ margin: '0 6px', color: '#64748b' }}>→</span>
                                  <span style={{ fontWeight: 600, color: '#16a34a' }}>
                                    {next.total_hours != null ? `${next.total_hours} hrs` : '-'}
                                  </span>
                                </div>
                              )}

                              {/* In case fields were unchanged or re-saved */}
                              {prev.date === next.date &&
                               prev.status === next.status &&
                               prev.clock_in === next.clock_in &&
                               prev.clock_out === next.clock_out &&
                               String(prev.total_hours) === String(next.total_hours) && (
                                <div style={{ color: '#64748b' }}>
                                  Record re-validated by administrator ({next.status || 'Present'}, {formatTimeDisplay(next.clock_in).display || '-'} to {formatTimeDisplay(next.clock_out).display || '-'})
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Stated Reason */}
                        <div style={{ background: '#fef3c7', borderLeft: '3px solid #f59e0b', padding: '8px 12px', borderRadius: '4px', fontSize: '0.82rem', color: '#92400e' }}>
                          <b>Modification Reason:</b> "{log.reason}"
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setShowAuditModal(false)}
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
