import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';
import { useTableSort } from '../hooks/useTableSort';
import { SortableTh } from '../components/SortableHeader';

/**
 * Parses any time slot string into minutes from midnight (0 - 1439).
 * Evaluates chronological order accurately for 12-hour AM/PM formats
 * (e.g., '06:00 AM - 07:00 AM' -> 360, '07:00 AM' -> 420, '12:00 PM' -> 720, '01:00 PM' -> 780).
 */
export function parseTimeSlotMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 9999;

  // Extract start time part (e.g. "06:00 AM" from "06:00 AM - 07:00 AM" or "06:00 AM to 07:00 AM")
  const startPart = timeStr.split(/[-–—]|to/i)[0].trim();
  const match = startPart.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!match) return 9999;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  let meridian = match[3] ? match[3].toUpperCase() : null;

  if (!meridian) {
    const fullMeridian = timeStr.match(/\b(am|pm)\b/i);
    if (fullMeridian) meridian = fullMeridian[1].toUpperCase();
  }

  if (meridian === 'PM' && hours < 12) {
    hours += 12;
  } else if (meridian === 'AM' && hours === 12) {
    hours = 0;
  }

  return hours * 60 + minutes;
}

/**
 * Sorts a batch array strictly chronologically by time slot, with stable tie-breaking.
 */
export function sortBatchesChronologically(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const timeA = parseTimeSlotMinutes(a?.batch_time);
    const timeB = parseTimeSlotMinutes(b?.batch_time);
    if (timeA !== timeB) return timeA - timeB;
    const courseA = String(a?.course_name || '');
    const courseB = String(b?.course_name || '');
    const cComp = courseA.localeCompare(courseB, undefined, { sensitivity: 'base' });
    if (cComp !== 0) return cComp;
    return String(a?.id || '').localeCompare(String(b?.id || ''), undefined, { numeric: true });
  });
}

// Fixed master daily schedule for the institute
const DEFAULT_BATCHES = [
  {
    id: 'b1',
    batch_time: '09:00 AM - 10:00 AM',
    instructor_name: 'Harjot Kaur',
    instructor_id: 2,
    course_name: 'C++',
    topic: 'Operators',
    student_count: 8,
    status: 'Ongoing',
    updated_at: '2026-10-14 11:30:00'
  },
  {
    id: 'b2',
    batch_time: '09:00 AM - 10:00 AM',
    instructor_name: 'Harjot Kaur',
    instructor_id: 2,
    course_name: 'Tally prime',
    topic: 'Chapter-30',
    student_count: 14,
    status: 'Ongoing',
    updated_at: '2026-10-14 11:30:00'
  },
  {
    id: 'b3',
    batch_time: '09:00 AM - 10:00 AM',
    instructor_name: 'Harjot Kaur',
    instructor_id: 2,
    course_name: 'Ms paint',
    topic: 'Drawings',
    student_count: 10,
    status: 'Ongoing',
    updated_at: '2026-10-14 11:30:00'
  },
  {
    id: 'b4',
    batch_time: '10:00 AM - 11:00 AM',
    instructor_name: 'Sahil',
    instructor_id: 1,
    course_name: 'Advance Excel',
    topic: 'VLOOKUP & Pivot Tables',
    student_count: 16,
    status: 'Upcoming',
    updated_at: '2026-10-14 09:30:00'
  },
  {
    id: 'b5',
    batch_time: '11:00 AM - 12:00 PM',
    instructor_name: 'Palwasha',
    instructor_id: 3,
    course_name: 'English Speaking Course',
    topic: 'Group Discussion & Pronunciation',
    student_count: 12,
    status: 'Upcoming',
    updated_at: '2026-10-14 08:45:00'
  },
  {
    id: 'b6',
    batch_time: '02:00 PM - 03:00 PM',
    instructor_name: 'Harjot Kaur',
    instructor_id: 2,
    course_name: 'ADCA (MS Office)',
    topic: 'MS Word Table Formatting & Mail Merge',
    student_count: 15,
    status: 'Upcoming',
    updated_at: '2026-10-14 08:00:00'
  },
  {
    id: 'b7',
    batch_time: '04:00 PM - 05:00 PM',
    instructor_name: 'Sahil',
    instructor_id: 1,
    course_name: 'Web Development',
    topic: 'HTML & CSS Flexbox/Grid',
    student_count: 9,
    status: 'Upcoming',
    updated_at: '2026-10-14 07:30:00'
  }
];

export default function BatchesPage({ user, users = [], enrollments = [], enquiries = [], onToast }) {
  const [batches, setBatches] = useState(DEFAULT_BATCHES);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ courses: [], faculty: [] });

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [facultyFilter, setFacultyFilter] = useState('All');

  // Pagination State (Default 15 to fit the full 15-slot daily routine on page 1)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Unscheduled slots view toggle (only active when no filter is applied)
  const [showUnscheduled, setShowUnscheduled] = useState(true);

  const [formData, setFormData] = useState({
    batchTime: '',
    instructorId: '',
    courseName: '',
    topic: '',
    studentCount: 0,
    status: 'Upcoming',
    date: new Date().toISOString().slice(0, 10)
  });

  // Master institute routine time slots (08:00 AM to 09:00 PM)
  const timeSlots = [
    '08:00 AM - 09:00 AM', '09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM', '01:00 PM - 02:00 PM', '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM', '05:00 PM - 06:00 PM', '06:00 PM - 07:00 PM', '07:00 PM - 08:00 PM',
    '08:00 PM - 09:00 PM'
  ];

  // Calculate Last Updated status indicator for a slot
  const formatSlotLastUpdated = (slotBatches) => {
    if (!slotBatches || slotBatches.length === 0) {
      return 'Last Updated: Routine Active';
    }

    const timestamps = slotBatches
      .map(b => b.updated_at || b.created_at)
      .filter(Boolean)
      .map(t => new Date(String(t).replace(' ', 'T')).getTime())
      .filter(t => !isNaN(t));

    if (timestamps.length === 0) {
      return 'Last Updated: Today';
    }

    const latestTime = Math.max(...timestamps);
    const now = Date.now();
    const diffMinutes = Math.floor((now - latestTime) / (1000 * 60));

    if (diffMinutes < 0 || diffMinutes < 15) {
      return 'Last Updated: Just now';
    }
    if (diffMinutes < 60) {
      return `Last Updated: ${diffMinutes} Mins Ago`;
    }
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours === 1) {
      return 'Last Updated: 1 Hour Ago';
    }
    if (diffHours < 24) {
      return `Last Updated: ${diffHours} Hours Ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Last Updated: Yesterday';
    }
    return `Last Updated: ${diffDays} Days Ago`;
  };

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBatches();
      if (Array.isArray(data) && data.length > 0) {
        setBatches(sortBatchesChronologically(data));
      } else {
        setBatches(sortBatchesChronologically(DEFAULT_BATCHES));
      }
    } catch (err) {
      console.warn('Using master batches schedule:', err);
      setBatches(sortBatchesChronologically(DEFAULT_BATCHES));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();

    // Auto-refresh every 30 seconds to keep batch details up to date in real time
    const interval = setInterval(() => {
      loadBatches();
    }, 30000);

    const handleFocus = () => {
      loadBatches();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [loadBatches]);

  // Load filter options dynamically from backend API on mount
  useEffect(() => {
    let isMounted = true;
    if (typeof api.getBatchFilterOptions === 'function') {
      api.getBatchFilterOptions()
        .then(res => {
          if (isMounted && res && typeof res === 'object') {
            setFilterOptions(res);
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, []);

  // Dynamically extract unique course options from database records and loaded APIs
  const courseOptions = useMemo(() => {
    const set = new Set();
    if (Array.isArray(filterOptions?.courses)) {
      filterOptions.courses.forEach(c => {
        if (c && typeof c === 'string' && c.trim()) set.add(c.trim());
      });
    }
    batches.forEach(b => {
      if (b.course_name && b.course_name.trim()) set.add(b.course_name.trim());
    });
    if (Array.isArray(enrollments)) {
      enrollments.forEach(e => {
        if (e.course && typeof e.course === 'string' && e.course.trim()) set.add(e.course.trim());
      });
    }
    if (Array.isArray(enquiries)) {
      enquiries.forEach(e => {
        if (e.course && typeof e.course === 'string' && e.course.trim()) set.add(e.course.trim());
      });
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [batches, enrollments, enquiries, filterOptions]);

  // Dynamically extract unique faculty options from database records and loaded APIs
  const facultyOptions = useMemo(() => {
    const set = new Set();
    if (Array.isArray(filterOptions?.faculty)) {
      filterOptions.faculty.forEach(f => {
        const name = typeof f === 'string' ? f : (f.name || f.fullName);
        if (name && name.trim() && name.trim().toLowerCase() !== 'unassigned') {
          set.add(name.trim());
        }
      });
    }
    if (Array.isArray(users)) {
      users.forEach(u => {
        const name = (u.fullName || u.full_name || u.username || '').trim();
        if (name && name.toLowerCase() !== 'unassigned') {
          set.add(name);
        }
      });
    }
    batches.forEach(b => {
      const name = (b.instructor_name || '').trim();
      if (name && name.toLowerCase() !== 'unassigned') {
        set.add(name);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [batches, users, filterOptions]);

  // Detect whether any search/filter is active
  const hasActiveFilters = Boolean(searchQuery.trim() || courseFilter !== 'All' || facultyFilter !== 'All');

  // Multi-field dynamic filtering (course name, topic, faculty name, time slot, status)
  const filteredBatches = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return batches.filter(batch => {
      // 1. Course Filter
      if (courseFilter !== 'All') {
        if ((batch.course_name || '').trim().toLowerCase() !== courseFilter.toLowerCase()) {
          return false;
        }
      }

      // 2. Faculty Filter (including Unassigned)
      if (facultyFilter !== 'All') {
        if (facultyFilter === 'Unassigned') {
          const hasAssigned = Boolean(
            batch.instructor_name &&
            batch.instructor_name.trim() !== '' &&
            batch.instructor_name.trim().toLowerCase() !== 'unassigned' &&
            batch.instructor_id
          );
          if (hasAssigned) return false;
        } else {
          const bInst = (batch.instructor_name || '').trim().toLowerCase();
          const selInst = facultyFilter.trim().toLowerCase();
          const matchByName = bInst === selInst;
          const matchById = users?.some(u => 
            (u.fullName || u.full_name || u.username || '').trim().toLowerCase() === selInst &&
            Number(u.id) === Number(batch.instructor_id)
          );
          if (!matchByName && !matchById) return false;
        }
      }

      // 3. Search Bar Filter: course name, topic, faculty name, time slot, and status
      if (tokens.length > 0) {
        const course = String(batch.course_name || '').toLowerCase();
        const topic = String(batch.topic || '').toLowerCase();
        const instructor = String(batch.instructor_name || 'unassigned').toLowerCase();
        const time = String(batch.batch_time || '').toLowerCase();
        const status = String(batch.status || '').toLowerCase();
        const combined = `${course} ${topic} ${instructor} ${time} ${status}`;

        const allTokensMatch = tokens.every(token => combined.includes(token));
        if (!allTokensMatch) return false;
      }

      return true;
    });
  }, [batches, courseFilter, facultyFilter, searchQuery, users]);

  // Determine all time slots (including custom batch times not in fixed grid), strictly sorted chronologically
  const allTimeSlots = useMemo(() => {
    const slotSet = new Set(timeSlots);
    batches.forEach(b => {
      if (b.batch_time && typeof b.batch_time === 'string' && b.batch_time.trim()) {
        slotSet.add(b.batch_time.trim());
      }
    });
    return Array.from(slotSet).sort((a, b) => {
      const minA = parseTimeSlotMinutes(a);
      const minB = parseTimeSlotMinutes(b);
      if (minA !== minB) return minA - minB;
      return a.localeCompare(b, undefined, { numeric: true });
    });
  }, [batches, timeSlots]);

  // Sorting state for Batches table
  const {
    sortKey: batchSortKey,
    sortDirection: batchSortDir,
    handleSort: handleBatchSort,
    resetSort: resetBatchSort,
    sortList: sortBatches
  } = useTableSort({ key: null, direction: null });

  const isSortingActive = Boolean(batchSortKey && batchSortDir);
  const isCustomView = hasActiveFilters || isSortingActive;

  // Custom getters for special field matching and chronological sorting
  const batchCustomGetters = useMemo(() => ({
    batch_time: (b) => parseTimeSlotMinutes(b.batch_time),
    student_count: (b) => (b.student_count != null ? Number(b.student_count) : 0),
    instructor_name: (b) => b.instructor_name || 'Unassigned'
  }), []);

  const sortedBatches = useMemo(() => {
    if (!batchSortKey) {
      // Default view: sort chronologically from 06:00 AM onwards
      return sortBatchesChronologically(filteredBatches);
    }
    return sortBatches(filteredBatches, batchCustomGetters);
  }, [filteredBatches, batchSortKey, sortBatches, batchCustomGetters]);

  // Clear all filters & sorting
  const clearFilters = () => {
    setSearchQuery('');
    setCourseFilter('All');
    setFacultyFilter('All');
    resetBatchSort();
    setPage(1);
  };

  // Pagination calculations
  const totalCount = isCustomView
    ? sortedBatches.length
    : (showUnscheduled ? allTimeSlots.length : batches.length);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  const openNewBatch = (timeSlot = '') => {
    setEditingBatch(null);
    setFormData({
      batchTime: timeSlot,
      instructorId: user?.role === 'admin' ? '' : (user?.id || ''),
      courseName: '',
      topic: '',
      studentCount: 0,
      status: 'Upcoming',
      date: new Date().toISOString().slice(0, 10)
    });
    setIsModalOpen(true);
  };

  const openEditBatch = (batch) => {
    setEditingBatch(batch);
    setFormData({
      batchTime: batch.batch_time,
      instructorId: batch.instructor_id,
      courseName: batch.course_name,
      topic: batch.topic || '',
      studentCount: batch.student_count,
      status: batch.status,
      date: batch.date || new Date().toISOString().slice(0, 10)
    });
    setIsModalOpen(true);
  };

  const isOwner = (batch) => Number(batch?.instructor_id) === Number(user?.id);
  const canEditBatch = (batch) => user?.role === 'admin' || isOwner(batch) || !batch?.instructor_id;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBatch) {
        try {
          await api.updateBatch(editingBatch.id, formData);
        } catch (apiErr) {
          console.warn('API update failed, updating state locally:', apiErr);
        }
        setBatches(prev => sortBatchesChronologically(prev.map(b => b.id === editingBatch.id ? {
          ...b,
          batch_time: formData.batchTime,
          course_name: formData.courseName,
          topic: formData.topic,
          instructor_id: formData.instructorId,
          instructor_name: users?.find(u => Number(u.id) === Number(formData.instructorId))?.fullName || b.instructor_name,
          student_count: Number(formData.studentCount),
          status: formData.status,
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
        } : b)));
        onToast('Batch updated.');
      } else {
        const newBatchItem = {
          id: 'b_' + Date.now(),
          batch_time: formData.batchTime,
          course_name: formData.courseName,
          topic: formData.topic,
          instructor_id: formData.instructorId,
          instructor_name: users?.find(u => Number(u.id) === Number(formData.instructorId))?.fullName || (user?.fullName || user?.name || 'Harjot Kaur'),
          student_count: Number(formData.studentCount),
          status: formData.status,
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
        };
        try {
          const res = await api.createBatch(formData);
          if (res && res.id) newBatchItem.id = res.id;
        } catch (apiErr) {
          console.warn('API create failed, creating state locally:', apiErr);
        }
        setBatches(prev => sortBatchesChronologically([...prev, newBatchItem]));
        onToast('Batch created.');
      }
      setIsModalOpen(false);
      // Immediately reload fresh batch data from server
      loadBatches();
    } catch (err) {
      onToast(err.message || 'Failed to save batch.', true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this batch?")) return;
    try {
      try {
        await api.deleteBatch(id);
      } catch (apiErr) {
        console.warn('API delete failed, deleting state locally:', apiErr);
      }
      setBatches(prev => prev.filter(b => b.id !== id));
      onToast('Batch deleted.');
      loadBatches();
    } catch (err) {
      onToast(err.message || 'Failed to delete batch.', true);
    }
  };

  return (
    <div className="page-section">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h2>Daily Batch Management</h2>
          <p>Master daily schedule &bull; Consistent routine overview</p>
        </div>
        <div className="controls">
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: '10px',
            fontSize: '0.86rem',
            color: 'var(--muted)',
            fontWeight: '600'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#10b981',
              boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)'
            }} />
            Fixed Institute Routine
          </div>
        </div>
      </div>

      <div className="card table-container">
        {/* Dynamic Search & Filters Toolbar */}
        <div className="toolbar" style={{ flexWrap: 'wrap', gap: '12px', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
          {/* Search Bar */}
          <div className="search" style={{ minWidth: '220px', flex: '1 1 240px' }}>
            <span className="si"><Icon name="search" size={18} /></span>
            <input
              className="input"
              type="search"
              placeholder="Search course, topic, faculty, slot, status..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              autoComplete="off"
              aria-label="Search batches"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="filters-inline" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Course Dropdown Filter */}
            <div className="fl">
              <select
                className="select"
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by course"
                title="Filter by course"
              >
                <option value="All">All Courses</option>
                {courseOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Faculty Dropdown Filter */}
            <div className="fl">
              <select
                className="select"
                value={facultyFilter}
                onChange={(e) => {
                  setFacultyFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by faculty"
                title="Filter by faculty"
              >
                <option value="All">All Faculty</option>
                <option value="Unassigned">Unassigned</option>
                {facultyOptions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Clear Filters Button */}
            {(hasActiveFilters || isSortingActive) && (
              <button
                className="btn"
                type="button"
                onClick={clearFilters}
                title="Clear all search, filters, and sorting"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="ic"><Icon name="x" size={15} /></span>
                Clear Filters
              </button>
            )}

            {/* Routine Empty Slots Checkbox Toggle (when unfiltered) */}
            {!isCustomView && (
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  fontSize: '0.84rem',
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  marginLeft: '4px'
                }}
                title="Toggle display of empty time slots in the routine"
              >
                <input
                  type="checkbox"
                  checked={showUnscheduled}
                  onChange={e => {
                    setShowUnscheduled(e.target.checked);
                    setPage(1);
                  }}
                />
                Show routine empty slots
              </label>
            )}
          </div>

          {/* Result Count and Add Batch Action */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.86rem', color: 'var(--muted)', fontWeight: '600' }}>
              {isCustomView
                ? `${sortedBatches.length} ${sortedBatches.length === 1 ? 'batch' : 'batches'} found (of ${batches.length})`
                : `${batches.length} ${batches.length === 1 ? 'batch' : 'batches'} total`}
            </span>

            <button
              className="btn sm"
              type="button"
              onClick={loadBatches}
              title="Refresh latest batches from server"
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <span className={`ic ${loading ? 'spin' : ''}`}><Icon name="refresh" size={13} /></span>
              Refresh
            </button>

            {user?.role === 'admin' && (
              <button
                className="btn primary sm"
                type="button"
                onClick={() => openNewBatch()}
                title="Schedule a new batch"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <span className="ic"><Icon name="plus" size={15} /></span>
                Add Batch
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading schedule...</div>
        ) : (
          <table className="table" style={{ minWidth: '850px', width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <SortableTh colKey="batch_time" label="Time Slot" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} style={{ width: '220px' }} />
                <SortableTh colKey="course_name" label="Course & Topic" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} />
                <SortableTh colKey="instructor_name" label="Instructor" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} />
                <SortableTh colKey="student_count" label="Students" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} />
                <SortableTh colKey="status" label="Status" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} />
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* When search or filters yield 0 results */}
              {isCustomView && sortedBatches.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <div className="empty" style={{ padding: '48px 16px', textAlign: 'center' }}>
                      <div className="ei" style={{ margin: '0 auto 12px' }}>
                        <Icon name="search" size={24} />
                      </div>
                      <b style={{ fontSize: '1.05rem', color: 'var(--text)' }}>No batches match</b>
                      <span style={{ color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                        No batches match your current search, filter, or sorting criteria.
                      </span>
                      <button
                        className="btn"
                        type="button"
                        onClick={clearFilters}
                        style={{ marginTop: '16px' }}
                      >
                        <span className="ic"><Icon name="x" size={15} /></span>
                        Clear Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : isCustomView ? (
                /* Filtered or sorted view: Group matching batches by time slot and render paginated slice */
                (() => {
                  const paginatedBatches = sortedBatches.slice(startIndex, startIndex + pageSize);
                  
                  // Group consecutive batches with the same batch_time for rowSpan presentation
                  const slotGroups = [];
                  paginatedBatches.forEach(batch => {
                    const lastGroup = slotGroups[slotGroups.length - 1];
                    if (lastGroup && lastGroup.slot === batch.batch_time) {
                      lastGroup.batches.push(batch);
                    } else {
                      slotGroups.push({ slot: batch.batch_time, batches: [batch] });
                    }
                  });

                  return slotGroups.map(group => {
                    return group.batches.map((batch, index) => {
                      const canEdit = canEditBatch(batch);
                      return (
                        <tr
                          key={batch.id}
                          style={{
                            background: batch.status === 'Ongoing' ? '#f0fdf4' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {index === 0 && (
                            <td
                              rowSpan={group.batches.length}
                              style={{
                                fontWeight: '500',
                                color: '#1e293b',
                                verticalAlign: 'top',
                                background: '#fafbfc',
                                borderRight: '1px solid #edf2f7',
                                padding: '12px 14px'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: '700',
                                  letterSpacing: '0.01em',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  boxShadow: '0 1px 2px rgba(29, 78, 216, 0.05)',
                                  width: 'fit-content'
                                }}>
                                  <Icon name="clock" size={12} />
                                  <span>{formatSlotLastUpdated(group.batches)}</span>
                                </div>
                                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.94rem', letterSpacing: '-0.01em' }}>
                                  {group.slot}
                                </div>
                                <div style={{ marginTop: '2px' }}>
                                  <button
                                    className="btn icon-btn"
                                    onClick={() => openNewBatch(group.slot)}
                                    title="Add parallel batch for this slot"
                                    style={{ width: '28px', height: '28px', padding: 0 }}
                                  >
                                    <Icon name="plus" size={13} />
                                  </button>
                                </div>
                              </div>
                            </td>
                          )}
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            <strong style={{ display: 'block', fontSize: '0.94rem', color: '#0f172a' }}>{batch.course_name}</strong>
                            {batch.topic && (
                              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                                {batch.topic}
                              </div>
                            )}
                          </td>
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px', fontWeight: '500' }}>
                            {batch.instructor_name || 'Unassigned'}
                          </td>
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            <span style={{ fontWeight: '600', color: '#1e293b' }}>{batch.student_count}</span>
                          </td>
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              background: batch.status === 'Completed' ? '#f1f5f9' : batch.status === 'Ongoing' ? '#dcfce7' : '#fef9c3',
                              color: batch.status === 'Completed' ? '#475569' : batch.status === 'Ongoing' ? '#15803d' : '#854d0e',
                              border: `1px solid ${batch.status === 'Completed' ? '#e2e8f0' : batch.status === 'Ongoing' ? '#bbf7d0' : '#fef08a'}`
                            }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: batch.status === 'Completed' ? '#64748b' : batch.status === 'Ongoing' ? '#16a34a' : '#ca8a04'
                              }} />
                              {batch.status}
                            </span>
                          </td>
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            {canEdit ? (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn icon-btn" onClick={() => openEditBatch(batch)} title="Edit"><Icon name="edit" size={16} /></button>
                                {user?.role === 'admin' && (
                                  <button className="btn icon-btn" onClick={() => handleDelete(batch.id)} title="Delete"><Icon name="trash" size={16} /></button>
                                )}
                              </div>
                            ) : (
                              <button className="btn icon-btn" onClick={() => openEditBatch(batch)} title="View Details"><Icon name="eye" size={16} /></button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  });
                })()
              ) : showUnscheduled ? (
                /* Unfiltered Master Routine Schedule view: paginated over allSlots */
                allTimeSlots.slice(startIndex, startIndex + pageSize).map(slot => {
                  const slotBatches = batches.filter(b => b.batch_time === slot);
                  
                  if (slotBatches.length === 0) {
                    return (
                      <tr key={slot}>
                        <td style={{
                          fontWeight: '500',
                          color: '#64748b',
                          verticalAlign: 'top',
                          background: '#fafbfc',
                          borderRight: '1px solid #edf2f7',
                          padding: '12px 14px'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.72rem',
                              fontWeight: '600',
                              background: '#f1f5f9',
                              color: '#64748b',
                              border: '1px solid #e2e8f0',
                              width: 'fit-content'
                            }}>
                              <Icon name="clock" size={11} />
                              <span>Last Updated: Routine Active</span>
                            </div>
                            <div style={{ fontWeight: '600', color: '#64748b', fontSize: '0.9rem' }}>
                              {slot}
                            </div>
                          </div>
                        </td>
                        <td colSpan={5} className="muted" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                          No batch scheduled.
                          <button
                            className="btn btn-sm"
                            style={{ marginLeft: '1rem' }}
                            onClick={() => openNewBatch(slot)}
                          >
                            + Schedule
                          </button>
                        </td>
                      </tr>
                    );
                  }

                  return slotBatches.map((batch, index) => {
                    const canEdit = canEditBatch(batch);
                    return (
                      <tr
                        key={batch.id}
                        style={{
                          background: batch.status === 'Ongoing' ? '#f0fdf4' : 'transparent',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        {index === 0 && (
                          <td
                            rowSpan={slotBatches.length}
                            style={{
                              fontWeight: '500',
                              color: '#1e293b',
                              verticalAlign: 'top',
                              background: '#fafbfc',
                              borderRight: '1px solid #edf2f7',
                              padding: '12px 14px'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 9px',
                                borderRadius: '6px',
                                fontSize: '0.74rem',
                                fontWeight: '700',
                                letterSpacing: '0.01em',
                                background: '#eff6ff',
                                color: '#1d4ed8',
                                border: '1px solid #bfdbfe',
                                boxShadow: '0 1px 2px rgba(29, 78, 216, 0.05)',
                                width: 'fit-content'
                              }}>
                                <Icon name="clock" size={12} />
                                <span>{formatSlotLastUpdated(slotBatches)}</span>
                              </div>
                              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.94rem', letterSpacing: '-0.01em' }}>
                                {slot}
                              </div>
                              <div style={{ marginTop: '2px' }}>
                                <button
                                  className="btn icon-btn"
                                  onClick={() => openNewBatch(slot)}
                                  title="Add parallel batch for this slot"
                                  style={{ width: '28px', height: '28px', padding: 0 }}
                                >
                                  <Icon name="plus" size={13} />
                                </button>
                              </div>
                            </div>
                          </td>
                        )}
                        <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                          <strong style={{ display: 'block', fontSize: '0.94rem', color: '#0f172a' }}>{batch.course_name}</strong>
                          {batch.topic && (
                            <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                              {batch.topic}
                            </div>
                          )}
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: '12px 14px', fontWeight: '500' }}>
                          {batch.instructor_name || 'Unassigned'}
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                          <span style={{ fontWeight: '600', color: '#1e293b' }}>{batch.student_count}</span>
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '3px 10px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: '700',
                            background: batch.status === 'Completed' ? '#f1f5f9' : batch.status === 'Ongoing' ? '#dcfce7' : '#fef9c3',
                            color: batch.status === 'Completed' ? '#475569' : batch.status === 'Ongoing' ? '#15803d' : '#854d0e',
                            border: `1px solid ${batch.status === 'Completed' ? '#e2e8f0' : batch.status === 'Ongoing' ? '#bbf7d0' : '#fef08a'}`
                          }}>
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: batch.status === 'Completed' ? '#64748b' : batch.status === 'Ongoing' ? '#16a34a' : '#ca8a04'
                            }} />
                            {batch.status}
                          </span>
                        </td>
                        <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                          {canEdit ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn icon-btn" onClick={() => openEditBatch(batch)} title="Edit"><Icon name="edit" size={16} /></button>
                              {user?.role === 'admin' && (
                                <button className="btn icon-btn" onClick={() => handleDelete(batch.id)} title="Delete"><Icon name="trash" size={16} /></button>
                              )}
                            </div>
                          ) : (
                            <button className="btn icon-btn" onClick={() => openEditBatch(batch)} title="View Details"><Icon name="eye" size={16} /></button>
                          )}
                        </td>
                      </tr>
                    );
                  });
                })
              ) : (
                /* Compact unfiltered view: only batches displayed, sorted chronologically */
                (() => {
                  const paginatedBatches = sortedBatches.slice(startIndex, startIndex + pageSize);
                  const slotGroups = [];
                  paginatedBatches.forEach(batch => {
                    const lastGroup = slotGroups[slotGroups.length - 1];
                    if (lastGroup && lastGroup.slot === batch.batch_time) {
                      lastGroup.batches.push(batch);
                    } else {
                      slotGroups.push({ slot: batch.batch_time, batches: [batch] });
                    }
                  });

                  return slotGroups.map(group => {
                    return group.batches.map((batch, index) => {
                      const canEdit = canEditBatch(batch);
                      return (
                        <tr
                          key={batch.id}
                          style={{
                            background: batch.status === 'Ongoing' ? '#f0fdf4' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          {index === 0 && (
                            <td
                              rowSpan={group.batches.length}
                              style={{
                                fontWeight: '500',
                                color: '#1e293b',
                                verticalAlign: 'top',
                                background: '#fafbfc',
                                borderRight: '1px solid #edf2f7',
                                padding: '12px 14px'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 9px',
                                  borderRadius: '6px',
                                  fontSize: '0.74rem',
                                  fontWeight: '700',
                                  letterSpacing: '0.01em',
                                  background: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #bfdbfe',
                                  boxShadow: '0 1px 2px rgba(29, 78, 216, 0.05)',
                                  width: 'fit-content'
                                }}>
                                  <Icon name="clock" size={12} />
                                  <span>{formatSlotLastUpdated(group.batches)}</span>
                                </div>
                                <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.94rem', letterSpacing: '-0.01em' }}>
                                  {group.slot}
                                </div>
                                <div style={{ marginTop: '2px' }}>
                                  <button
                                    className="btn icon-btn"
                                    onClick={() => openNewBatch(group.slot)}
                                    title="Add parallel batch for this slot"
                                    style={{ width: '28px', height: '28px', padding: 0 }}
                                  >
                                    <Icon name="plus" size={13} />
                                  </button>
                                </div>
                              </div>
                            </td>
                          )}
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            <strong style={{ display: 'block', fontSize: '0.94rem', color: '#0f172a' }}>{batch.course_name}</strong>
                            {batch.topic && (
                              <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '2px' }}>
                                {batch.topic}
                              </div>
                            )}
                          </td>
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px', fontWeight: '500' }}>
                            {batch.instructor_name || 'Unassigned'}
                          </td>
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            <span style={{ fontWeight: '600', color: '#1e293b' }}>{batch.student_count}</span>
                          </td>
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              background: batch.status === 'Completed' ? '#f1f5f9' : batch.status === 'Ongoing' ? '#dcfce7' : '#fef9c3',
                              color: batch.status === 'Completed' ? '#475569' : batch.status === 'Ongoing' ? '#15803d' : '#854d0e',
                              border: `1px solid ${batch.status === 'Completed' ? '#e2e8f0' : batch.status === 'Ongoing' ? '#bbf7d0' : '#fef08a'}`
                            }}>
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: batch.status === 'Completed' ? '#64748b' : batch.status === 'Ongoing' ? '#16a34a' : '#ca8a04'
                              }} />
                              {batch.status}
                            </span>
                          </td>
                          <td style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            {canEdit ? (
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button className="btn icon-btn" onClick={() => openEditBatch(batch)} title="Edit"><Icon name="edit" size={16} /></button>
                                {user?.role === 'admin' && (
                                  <button className="btn icon-btn" onClick={() => handleDelete(batch.id)} title="Delete"><Icon name="trash" size={16} /></button>
                                )}
                              </div>
                            ) : (
                              <button className="btn icon-btn" onClick={() => openEditBatch(batch)} title="View Details"><Icon name="eye" size={16} /></button>
                            )}
                          </td>
                        </tr>
                      );
                    });
                  });
                })()
              )}
            </tbody>
          </table>
        )}

        {/* Pager Section */}
        <div className="pager">
          <span>
            {totalCount > 0
              ? `Showing ${startIndex + 1}–${Math.min(startIndex + pageSize, totalCount)} of ${totalCount}${hasActiveFilters ? ` (filtered from ${batches.length} total)` : ''}`
              : '0 results'}
          </span>
          <div className="btns">
            <span className="rows">
              Rows per page
              <select
                className="select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                aria-label="Rows per page"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </span>
            <button
              className="btn sm"
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>Page {currentPage} of {totalPages}</span>
            <button
              className="btn sm"
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Schedule / Edit Batch Modal */}
      {isModalOpen && (() => {
        const isReadOnly = Boolean(editingBatch && !canEditBatch(editingBatch));
        return (
          <div className="overlay" id="batchOverlay" onMouseDown={(e) => { if (e.target.id === 'batchOverlay') setIsModalOpen(false); }}>
            <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '550px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <header>
                <div className="t">
                  <h3>
                    {isReadOnly 
                      ? 'Batch Details (View Only)' 
                      : editingBatch 
                        ? 'Edit Batch' 
                        : 'Schedule Batch'}
                  </h3>
                </div>
                <button className="icon-btn" type="button" aria-label="Close" onClick={() => setIsModalOpen(false)}>
                  <span className="ic"><Icon name="x" size={18} /></span>
                </button>
              </header>
              <div className="modal-body" style={{ maxHeight: 'calc(90vh - 70px)', overflowY: 'auto' }}>
                <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="fld">
                    <label>Time Slot <em>*</em></label>
                    <select required disabled={isReadOnly} className="select" value={formData.batchTime} onChange={e => setFormData({...formData, batchTime: e.target.value})}>
                      <option value="">Select Time Slot</option>
                      {timeSlots.map(slot => (
                        <option key={slot} value={slot}>{slot}</option>
                      ))}
                      <option value="Other">Other Custom Time</option>
                    </select>
                  </div>
                  {formData.batchTime === 'Other' && (
                    <div className="fld">
                      <input required disabled={isReadOnly} className="input" placeholder="e.g. 07:00 AM - 08:00 AM" onChange={e => setFormData({...formData, batchTime: e.target.value})} />
                    </div>
                  )}
                  
                  <div className="fld">
                    <label>Course Name <em>*</em></label>
                    <input
                      required
                      disabled={isReadOnly}
                      className="input"
                      list="batchCourseOptions"
                      value={formData.courseName}
                      onChange={e => setFormData({...formData, courseName: e.target.value})}
                      placeholder="e.g. Advance Excel"
                    />
                    <datalist id="batchCourseOptions">
                      {courseOptions.map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  
                  <div className="fld">
                    <label>Topic / Description</label>
                    <input disabled={isReadOnly} className="input" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} placeholder="e.g. VLOOKUP & Pivot Tables" />
                  </div>

                  <div className="fld">
                    <label>Instructor</label>
                    <select disabled={isReadOnly || user?.role !== 'admin'} className="select" value={formData.instructorId} onChange={e => setFormData({...formData, instructorId: e.target.value})}>
                      <option value="">Select Instructor</option>
                      {users?.map(u => (
                        <option key={u.id} value={u.id}>{u.fullName || u.full_name || u.username}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="fld">
                      <label>Student Count</label>
                      <input type="number" min="0" disabled={isReadOnly} className="input" value={formData.studentCount} onChange={e => setFormData({...formData, studentCount: e.target.value})} />
                    </div>
                    <div className="fld">
                      <label>Status</label>
                      <select disabled={isReadOnly} className="select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="Upcoming">Upcoming</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-foot" style={{ marginTop: '1rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    {isReadOnly ? (
                      <button type="button" className="btn primary" onClick={() => setIsModalOpen(false)}>Close</button>
                    ) : (
                      <>
                        <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                        <button type="submit" className="btn primary">Save Batch</button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
