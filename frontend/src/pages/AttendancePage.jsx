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

export default function AttendancePage({ user, users = [], onToast }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
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

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

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

  // Clock In handler
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

  // Clock Out handler
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
    const set = new Set(['Present', 'Half Day', 'Leave', 'Absent']);
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
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
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
          // Specific date selected
          if (recDate !== dateFilter) return false;
        }
      }

      // 4. Search Query Filter (Dynamic across staff name, date, clock-in, clock-out, total hours, and status)
      if (q) {
        const staffNameStr = String(r.staff_name || '').toLowerCase();
        const staffIdStr = String(r.staff_id || '').toLowerCase();
        const statusStr = String(r.status || '').toLowerCase();
        const hoursStr = String(r.total_hours || '').toLowerCase();
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
          dateMeta.searchTerms,
          clockInMeta.searchTerms,
          clockOutMeta.searchTerms
        ].join(' ');

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [records, searchQuery, staffFilter, dateFilter, customDate, statusFilter, todayIST, yesterdayIST, mondayOfWeek, currentMonthPrefix]);

  // Check if any filters are currently active
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    staffFilter !== 'All' ||
    dateFilter !== 'All' ||
    (dateFilter === 'custom' && customDate) ||
    statusFilter !== 'All'
  );

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setStaffFilter('All');
    setDateFilter('All');
    setCustomDate('');
    setStatusFilter('All');
    setPage(1);
  };

  // Reset to page 1 whenever filters or search query change
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

  // Custom getters for safe time/hours comparison
  const attendanceCustomGetters = useMemo(() => ({
    clock_in: (r) => (r.clock_in ? parseSortableDate(r.clock_in) : null),
    clock_out: (r) => (r.clock_out ? parseSortableDate(r.clock_out) : null),
    total_hours: (r) => (r.total_hours != null && r.total_hours !== '' ? parseFloat(r.total_hours) : null)
  }), []);

  const sortedRecords = useMemo(() => {
    return sortAttendance(filteredRecords, attendanceCustomGetters);
  }, [filteredRecords, sortAttendance, attendanceCustomGetters]);

  // Pagination calculations
  const totalRecords = sortedRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedRecords = sortedRecords.slice(startIndex, startIndex + pageSize);

  return (
    <div className="page-section">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h2>Staff Attendance</h2>
          <p>Track and filter daily staff clock-in, clock-out, and attendance history.</p>
        </div>
        <div className="controls">
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
        </div>
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
              placeholder="Search staff, date, clock-in, clock-out, status, hours..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              aria-label="Search attendance records"
            />
          </div>

          {/* Staff Member Dropdown (Visible for Admins) */}
          {user?.role === 'admin' && (
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

          {/* Custom Date Picker (when 'Specific Date...' is chosen) */}
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
                  {user?.role === 'admin' && (
                    <SortableTh colKey="staff_name" label="Staff Member" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  )}
                  <SortableTh colKey="date" label="Date" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  <SortableTh colKey="clock_in" label="Clock In" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  <SortableTh colKey="clock_out" label="Clock Out" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  <SortableTh colKey="total_hours" label="Total Hours" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
                  <SortableTh colKey="status" label="Status" sortKey={attendanceSortKey} sortDirection={attendanceSortDir} onSort={handleAttendanceSort} />
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
                        {user?.role === 'admin' && (
                          <td data-label="Staff Member">
                            <b>{r.staff_name || `Staff #${r.staff_id}`}</b>
                          </td>
                        )}
                        <td data-label="Date">
                          <span>{dateMeta.display}</span>
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
                          ) : (
                            <span className="pill s-active" title="Clocked in, awaiting clock-out">
                              Active
                            </span>
                          )}
                        </td>
                        <td data-label="Total Hours">
                          {r.total_hours != null && r.total_hours !== '' ? (
                            <span>{r.total_hours} hrs</span>
                          ) : !r.clock_out && r.clock_in ? (
                            <span className="muted" style={{ fontSize: '0.82rem' }}>In progress</span>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td data-label="Status">
                          <span className={`pill s-${statusSlug}`}>
                            {r.status || 'Present'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr className="empty-row">
                    <td colSpan={user?.role === 'admin' ? 6 : 5}>
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
    </div>
  );
}
