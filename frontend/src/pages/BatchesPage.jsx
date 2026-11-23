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
    batch_name: 'C++ Operators & Logic',
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
    batch_name: 'Tally Prime Mastery',
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
    batch_name: 'Ms Paint Foundation',
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
    batch_name: 'Advance Excel Formulas',
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
    batch_name: 'English Fluency & GD',
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
    batch_name: 'ADCA MS Office Core',
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
    batch_name: 'Web Dev Frontend Lab',
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
  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher';
  const canManageAny = isAdmin || isTeacher;

  const [batches, setBatches] = useState(DEFAULT_BATCHES);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [savingBatch, setSavingBatch] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ courses: [], faculty: [] });

  // Delete Confirmation Modal State
  const [batchToDelete, setBatchToDelete] = useState(null);
  const [deletingBatch, setDeletingBatch] = useState(false);

  // View Mode: 'routine' (Master Routine table) vs 'cards' (Responsive Cards view)
  const [viewMode, setViewMode] = useState('routine');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [facultyFilter, setFacultyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Unscheduled slots view toggle
  const [showUnscheduled, setShowUnscheduled] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    batchName: '',
    batchTime: '',
    instructorId: '',
    courseName: '',
    topic: '',
    studentCount: 0,
    students: '',
    status: 'Upcoming',
    date: new Date().toISOString().slice(0, 10)
  });

  // Master institute routine time slots (08:00 AM to 09:00 PM)
  const timeSlots = [
    '08:00 AM - 09:00 AM',
    '09:00 AM - 10:00 AM',
    '10:00 AM - 11:00 AM',
    '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM',
    '01:00 PM - 02:00 PM',
    '02:00 PM - 03:00 PM',
    '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM',
    '05:00 PM - 06:00 PM',
    '06:00 PM - 07:00 PM',
    '07:00 PM - 08:00 PM',
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

  // Dynamically extract unique course options
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

  // Dynamically extract unique faculty options
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
  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    courseFilter !== 'All' ||
    facultyFilter !== 'All' ||
    statusFilter !== 'All'
  );

  // Multi-field dynamic filtering
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

      // 3. Status Filter
      if (statusFilter !== 'All') {
        if ((batch.status || '').toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Search Bar Filter
      if (tokens.length > 0) {
        const bName = String(batch.batch_name || '').toLowerCase();
        const course = String(batch.course_name || '').toLowerCase();
        const topic = String(batch.topic || '').toLowerCase();
        const instructor = String(batch.instructor_name || 'unassigned').toLowerCase();
        const time = String(batch.batch_time || '').toLowerCase();
        const status = String(batch.status || '').toLowerCase();
        const students = String(batch.students || '').toLowerCase();
        const combined = `${bName} ${course} ${topic} ${instructor} ${time} ${status} ${students}`;

        const allTokensMatch = tokens.every(token => combined.includes(token));
        if (!allTokensMatch) return false;
      }

      return true;
    });
  }, [batches, courseFilter, facultyFilter, statusFilter, searchQuery, users]);

  // All time slots
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
  const isCustomView = hasActiveFilters || isSortingActive || viewMode === 'cards';

  // Custom getters for sorting
  const batchCustomGetters = useMemo(() => ({
    batch_time: (b) => parseTimeSlotMinutes(b.batch_time),
    student_count: (b) => (b.student_count != null ? Number(b.student_count) : 0),
    instructor_name: (b) => b.instructor_name || 'Unassigned',
    batch_name: (b) => b.batch_name || b.topic || b.course_name
  }), []);

  const sortedBatches = useMemo(() => {
    if (!batchSortKey) {
      return sortBatchesChronologically(filteredBatches);
    }
    return sortBatches(filteredBatches, batchCustomGetters);
  }, [filteredBatches, batchSortKey, sortBatches, batchCustomGetters]);

  const clearFilters = () => {
    setSearchQuery('');
    setCourseFilter('All');
    setFacultyFilter('All');
    setStatusFilter('All');
    resetBatchSort();
    setPage(1);
  };

  const totalCount = isCustomView
    ? sortedBatches.length
    : (showUnscheduled ? allTimeSlots.length : batches.length);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;

  // Role-based permissions
  const isOwner = (batch) => Number(batch?.instructor_id) === Number(user?.id);
  const canEditBatch = (batch) => isAdmin || (isTeacher && (isOwner(batch) || !batch?.instructor_id));
  const canDeleteBatch = (batch) => isAdmin || (isTeacher && (isOwner(batch) || !batch?.instructor_id));

  // Modal open handlers
  const openNewBatch = (timeSlot = '') => {
    setEditingBatch(null);
    setFormData({
      batchName: '',
      batchTime: timeSlot || (timeSlots[0] || '09:00 AM - 10:00 AM'),
      instructorId: isAdmin ? '' : (user?.id || ''),
      courseName: courseOptions[0] || '',
      topic: '',
      studentCount: 0,
      students: '',
      status: 'Upcoming',
      date: new Date().toISOString().slice(0, 10)
    });
    setIsModalOpen(true);
  };

  const openEditBatch = (batch) => {
    setEditingBatch(batch);
    setFormData({
      batchName: batch.batch_name || batch.topic || '',
      batchTime: batch.batch_time || '',
      instructorId: batch.instructor_id != null ? String(batch.instructor_id) : '',
      courseName: batch.course_name || '',
      topic: batch.topic || '',
      studentCount: batch.student_count != null ? batch.student_count : 0,
      students: batch.students || '',
      status: batch.status || 'Upcoming',
      date: batch.date ? String(batch.date).split('T')[0] : new Date().toISOString().slice(0, 10)
    });
    setIsModalOpen(true);
  };

  // Submit Add or Edit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.batchTime) {
      onToast('Please select a time slot.', true);
      return;
    }
    if (!formData.courseName) {
      onToast('Please provide a course name.', true);
      return;
    }

    setSavingBatch(true);
    try {
      const payload = {
        batchName: formData.batchName.trim() || formData.topic.trim() || `${formData.courseName} (${formData.batchTime})`,
        batchTime: formData.batchTime.trim(),
        courseName: formData.courseName.trim(),
        topic: formData.topic.trim() || formData.batchName.trim(),
        instructorId: formData.instructorId ? Number(formData.instructorId) : null,
        studentCount: Number(formData.studentCount) || 0,
        students: formData.students.trim(),
        status: formData.status,
        date: formData.date
      };

      if (editingBatch) {
        await api.updateBatch(editingBatch.id, payload);
        onToast('Batch updated successfully.');
      } else {
        await api.createBatch(payload);
        onToast('New batch created successfully.');
      }

      setIsModalOpen(false);
      loadBatches();
    } catch (err) {
      onToast(err.message || 'Failed to save batch.', true);
    } finally {
      setSavingBatch(false);
    }
  };

  // Delete Confirmation flow
  const promptDeleteBatch = (batch) => {
    setBatchToDelete(batch);
  };

  const confirmDeleteBatch = async () => {
    if (!batchToDelete) return;
    setDeletingBatch(true);
    try {
      await api.deleteBatch(batchToDelete.id);
      onToast('Batch deleted permanently.');
      setBatchToDelete(null);
      loadBatches();
    } catch (err) {
      onToast(err.message || 'Failed to delete batch.', true);
    } finally {
      setDeletingBatch(false);
    }
  };

  return (
    <div className="page-section">
      {/* Page Header */}
      <div className="page-head" style={{ flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2>Daily Batch Management</h2>
          <p>Schedule, manage, edit, and monitor active training batches and assigned faculty.</p>
        </div>

        <div className="controls" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Mode Toggle: Grid vs Cards */}
          <div
            className="segmented-control"
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid #e2e8f0'
            }}
          >
            <button
              type="button"
              className={`btn sm ${viewMode === 'routine' ? 'active' : ''}`}
              onClick={() => setViewMode('routine')}
              style={{
                background: viewMode === 'routine' ? '#fff' : 'transparent',
                fontWeight: viewMode === 'routine' ? 700 : 500,
                color: viewMode === 'routine' ? '#1e293b' : '#64748b',
                boxShadow: viewMode === 'routine' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '0.82rem'
              }}
              title="Table view with time slots"
            >
              Routine Table
            </button>
            <button
              type="button"
              className={`btn sm ${viewMode === 'cards' ? 'active' : ''}`}
              onClick={() => setViewMode('cards')}
              style={{
                background: viewMode === 'cards' ? '#fff' : 'transparent',
                fontWeight: viewMode === 'cards' ? 700 : 500,
                color: viewMode === 'cards' ? '#1e293b' : '#64748b',
                boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '0.82rem'
              }}
              title="Responsive Cards View"
            >
              Cards View
            </button>
          </div>

          {/* Add Batch Button (Accessible to Admin and Teachers) */}
          {canManageAny && (
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => openNewBatch()}
              title="Schedule a new training batch"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="ic"><Icon name="plus" size={16} /></span>
              Add Batch
            </button>
          )}

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              background: 'var(--card)',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: 'var(--muted)',
              fontWeight: '600'
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.2)'
              }}
            />
            {batches.length} Active Batches
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
              placeholder="Search batch name, course, topic, faculty, slot, status..."
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
            {/* Course Filter */}
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
                style={{ minWidth: '150px' }}
              >
                <option value="All">All Courses</option>
                {courseOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Faculty Filter */}
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
                style={{ minWidth: '150px' }}
              >
                <option value="All">All Faculty</option>
                <option value="Unassigned">Unassigned</option>
                {facultyOptions.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="fl">
              <select
                className="select"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by status"
                title="Filter by status"
                style={{ minWidth: '130px' }}
              >
                <option value="All">All Statuses</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Upcoming">Upcoming</option>
                <option value="Completed">Completed</option>
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

            {/* Routine Empty Slots Checkbox Toggle */}
            {!isCustomView && viewMode === 'routine' && (
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

          {/* Quick Refresh & Result Counter */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.86rem', color: 'var(--muted)', fontWeight: '600' }}>
              {isCustomView
                ? `${sortedBatches.length} ${sortedBatches.length === 1 ? 'batch' : 'batches'} found (of ${batches.length})`
                : `${batches.length} ${batches.length === 1 ? 'batch' : 'batches'} total`}
            </span>

            <button
              className="btn sm icon-btn"
              type="button"
              onClick={loadBatches}
              title="Refresh latest batches from server"
              disabled={loading}
              aria-label="Refresh"
            >
              <span className={`ic ${loading ? 'spin' : ''}`}><Icon name="refresh" size={15} /></span>
            </button>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VIEW 1: Responsive Cards View (Ideal for mobile & touch)    */}
        {/* ============================================================ */}
        {viewMode === 'cards' ? (
          <div style={{ padding: '20px' }}>
            {loading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--muted)' }}>
                Loading batches...
              </div>
            ) : sortedBatches.length === 0 ? (
              <div className="empty" style={{ padding: '40px 16px', textAlign: 'center' }}>
                <div className="ei" style={{ margin: '0 auto 12px' }}><Icon name="search" size={26} /></div>
                <b>No batches match criteria</b>
                <p style={{ color: 'var(--muted)', margin: '4px 0 12px' }}>
                  No batches match your selected search or filter settings.
                </p>
                <button className="btn" type="button" onClick={clearFilters}>Clear Filters</button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                  gap: '16px'
                }}
              >
                {sortedBatches.slice(startIndex, startIndex + pageSize).map((b) => {
                  const canEdit = canEditBatch(b);
                  const canDelete = canDeleteBatch(b);
                  const statusColor = b.status === 'Ongoing' ? '#16a34a' : b.status === 'Completed' ? '#64748b' : '#ca8a04';
                  const statusBg = b.status === 'Ongoing' ? '#dcfce7' : b.status === 'Completed' ? '#f1f5f9' : '#fef9c3';

                  return (
                    <div
                      key={b.id}
                      style={{
                        background: '#fff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        position: 'relative'
                      }}
                    >
                      <div>
                        {/* Header: Timing & Status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Icon name="clock" size={12} />
                            {b.batch_time}
                          </span>

                          <span
                            style={{
                              background: statusBg,
                              color: statusColor,
                              borderRadius: '12px',
                              padding: '2px 8px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor }} />
                            {b.status || 'Upcoming'}
                          </span>
                        </div>

                        {/* Batch Name & Course */}
                        <h4 style={{ margin: '0 0 4px', fontSize: '1.02rem', color: '#0f172a' }}>
                          {b.batch_name || b.topic || b.course_name}
                        </h4>
                        <div style={{ color: '#2563eb', fontWeight: 600, fontSize: '0.86rem', marginBottom: '8px' }}>
                          {b.course_name}
                        </div>

                        {b.topic && b.topic !== b.batch_name && (
                          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '10px' }}>
                            <b>Topic:</b> {b.topic}
                          </div>
                        )}

                        {/* Details Grid */}
                        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#475569' }}>
                          <div>
                            <b>Instructor:</b> {b.instructor_name || 'Unassigned'}
                          </div>
                          <div>
                            <b>Enrolled Students:</b> {b.student_count || 0} students
                          </div>
                          {b.students && (
                            <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>
                              <b>Students:</b> {b.students}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        {canEdit && (
                          <button
                            className="btn sm"
                            type="button"
                            onClick={() => openEditBatch(b)}
                            title="Edit batch details"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span className="ic"><Icon name="edit" size={13} /></span>
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn sm danger"
                            type="button"
                            onClick={() => promptDeleteBatch(b)}
                            title="Delete this batch"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span className="ic"><Icon name="trash" size={13} /></span>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ============================================================ */
          /* VIEW 2: Master Routine Table (Desktop & Tablets)             */
          /* ============================================================ */
          <div className="tbl-scroll" style={{ overflowX: 'auto' }}>
            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading schedule...</div>
            ) : (
              <table className="table mobile-card-stack" style={{ minWidth: '850px', width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <SortableTh colKey="batch_time" label="Time Slot" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} style={{ width: '220px' }} />
                    <SortableTh colKey="course_name" label="Course & Batch Details" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} />
                    <SortableTh colKey="instructor_name" label="Instructor" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} />
                    <SortableTh colKey="student_count" label="Students" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} />
                    <SortableTh colKey="status" label="Status" sortKey={batchSortKey} sortDirection={batchSortDir} onSort={handleBatchSort} />
                    <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
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
                          const canDelete = canDeleteBatch(batch);
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
                                  data-label="Time Slot"
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
                                      width: 'fit-content'
                                    }}>
                                      <Icon name="clock" size={12} />
                                      <span>{formatSlotLastUpdated(group.batches)}</span>
                                    </div>
                                    <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.94rem' }}>
                                      {group.slot}
                                    </div>
                                    {canManageAny && (
                                      <div style={{ marginTop: '2px' }}>
                                        <button
                                          className="btn icon-btn"
                                          type="button"
                                          onClick={() => openNewBatch(group.slot)}
                                          title="Add parallel batch for this slot"
                                          style={{ width: '28px', height: '28px', padding: 0 }}
                                        >
                                          <Icon name="plus" size={13} />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              )}
                              <td data-label="Course & Batch Details" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                                <strong style={{ display: 'block', fontSize: '0.94rem', color: '#0f172a' }}>
                                  {batch.course_name}
                                </strong>
                                {batch.batch_name && batch.batch_name !== batch.course_name && (
                                  <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
                                    {batch.batch_name}
                                  </div>
                                )}
                                {batch.topic && (
                                  <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                                    <b>Topic:</b> {batch.topic}
                                  </div>
                                )}
                                {batch.students && (
                                  <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                                    <b>Students:</b> {batch.students}
                                  </div>
                                )}
                              </td>
                              <td data-label="Instructor" style={{ verticalAlign: 'middle', padding: '12px 14px', fontWeight: '500' }}>
                                {batch.instructor_name || 'Unassigned'}
                              </td>
                              <td data-label="Students" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                                <span style={{ fontWeight: '600', color: '#1e293b' }}>{batch.student_count || 0}</span>
                              </td>
                              <td data-label="Status" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
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
                              <td data-label="Actions" style={{ verticalAlign: 'middle', padding: '12px 14px', textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                  {canEdit && (
                                    <button
                                      className="btn icon-btn"
                                      type="button"
                                      onClick={() => openEditBatch(batch)}
                                      title="Edit Batch"
                                      aria-label="Edit batch"
                                    >
                                      <Icon name="edit" size={15} />
                                    </button>
                                  )}
                                  {canDelete && (
                                    <button
                                      className="btn icon-btn"
                                      type="button"
                                      onClick={() => promptDeleteBatch(batch)}
                                      title="Delete Batch"
                                      aria-label="Delete batch"
                                      style={{ color: '#dc2626' }}
                                    >
                                      <Icon name="trash" size={15} />
                                    </button>
                                  )}
                                  {!canEdit && (
                                    <button
                                      className="btn icon-btn"
                                      type="button"
                                      onClick={() => openEditBatch(batch)}
                                      title="View Details"
                                      aria-label="View batch"
                                    >
                                      <Icon name="eye" size={15} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      });
                    })()
                  ) : showUnscheduled ? (
                    allTimeSlots.slice(startIndex, startIndex + pageSize).map(slot => {
                      const slotBatches = batches.filter(b => b.batch_time === slot);

                      if (slotBatches.length === 0) {
                        return (
                          <tr key={slot}>
                            <td data-label="Time Slot" style={{
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
                              <span>No batch scheduled.</span>
                              {canManageAny && (
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  style={{ marginLeft: '1rem' }}
                                  onClick={() => openNewBatch(slot)}
                                >
                                  + Schedule Batch
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      return slotBatches.map((batch, index) => {
                        const canEdit = canEditBatch(batch);
                        const canDelete = canDeleteBatch(batch);
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
                                data-label="Time Slot"
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
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe',
                                    width: 'fit-content'
                                  }}>
                                    <Icon name="clock" size={12} />
                                    <span>{formatSlotLastUpdated(slotBatches)}</span>
                                  </div>
                                  <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '0.94rem' }}>
                                    {slot}
                                  </div>
                                  {canManageAny && (
                                    <div style={{ marginTop: '2px' }}>
                                      <button
                                        className="btn icon-btn"
                                        type="button"
                                        onClick={() => openNewBatch(slot)}
                                        title="Add parallel batch for this slot"
                                        style={{ width: '28px', height: '28px', padding: 0 }}
                                      >
                                        <Icon name="plus" size={13} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            )}
                            <td data-label="Course & Batch Details" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                              <strong style={{ display: 'block', fontSize: '0.94rem', color: '#0f172a' }}>{batch.course_name}</strong>
                              {batch.batch_name && batch.batch_name !== batch.course_name && (
                                <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
                                  {batch.batch_name}
                                </div>
                              )}
                              {batch.topic && (
                                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                                  <b>Topic:</b> {batch.topic}
                                </div>
                              )}
                              {batch.students && (
                                <div style={{ fontSize: '0.78rem', color: 'var(--muted)', marginTop: '2px' }}>
                                  <b>Students:</b> {batch.students}
                                </div>
                              )}
                            </td>
                            <td data-label="Instructor" style={{ verticalAlign: 'middle', padding: '12px 14px', fontWeight: '500' }}>
                              {batch.instructor_name || 'Unassigned'}
                            </td>
                            <td data-label="Students" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                              <span style={{ fontWeight: '600', color: '#1e293b' }}>{batch.student_count || 0}</span>
                            </td>
                            <td data-label="Status" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
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
                            <td data-label="Actions" style={{ verticalAlign: 'middle', padding: '12px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                {canEdit && (
                                  <button
                                    className="btn icon-btn"
                                    type="button"
                                    onClick={() => openEditBatch(batch)}
                                    title="Edit Batch"
                                    aria-label="Edit batch"
                                  >
                                    <Icon name="edit" size={15} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    className="btn icon-btn"
                                    type="button"
                                    onClick={() => promptDeleteBatch(batch)}
                                    title="Delete Batch"
                                    aria-label="Delete batch"
                                    style={{ color: '#dc2626' }}
                                  >
                                    <Icon name="trash" size={15} />
                                  </button>
                                )}
                                {!canEdit && (
                                  <button
                                    className="btn icon-btn"
                                    type="button"
                                    onClick={() => openEditBatch(batch)}
                                    title="View Details"
                                    aria-label="View batch"
                                  >
                                    <Icon name="eye" size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })
                  ) : (
                    sortedBatches.slice(startIndex, startIndex + pageSize).map((batch) => {
                      const canEdit = canEditBatch(batch);
                      const canDelete = canDeleteBatch(batch);
                      return (
                        <tr
                          key={batch.id}
                          style={{
                            background: batch.status === 'Ongoing' ? '#f0fdf4' : 'transparent',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td data-label="Time Slot" style={{ verticalAlign: 'middle', padding: '12px 14px', fontWeight: '600' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Icon name="clock" size={13} />
                              {batch.batch_time}
                            </div>
                          </td>
                          <td data-label="Course & Batch Details" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            <strong style={{ display: 'block', fontSize: '0.94rem', color: '#0f172a' }}>{batch.course_name}</strong>
                            {batch.batch_name && batch.batch_name !== batch.course_name && (
                              <div style={{ fontSize: '0.85rem', color: '#2563eb', fontWeight: 600, marginTop: '2px' }}>
                                {batch.batch_name}
                              </div>
                            )}
                            {batch.topic && (
                              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                                <b>Topic:</b> {batch.topic}
                              </div>
                            )}
                          </td>
                          <td data-label="Instructor" style={{ verticalAlign: 'middle', padding: '12px 14px', fontWeight: '500' }}>
                            {batch.instructor_name || 'Unassigned'}
                          </td>
                          <td data-label="Students" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
                            <span style={{ fontWeight: '600', color: '#1e293b' }}>{batch.student_count || 0}</span>
                          </td>
                          <td data-label="Status" style={{ verticalAlign: 'middle', padding: '12px 14px' }}>
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
                          <td data-label="Actions" style={{ verticalAlign: 'middle', padding: '12px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              {canEdit && (
                                <button
                                  className="btn icon-btn"
                                  type="button"
                                  onClick={() => openEditBatch(batch)}
                                  title="Edit Batch"
                                  aria-label="Edit batch"
                                >
                                  <Icon name="edit" size={15} />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  className="btn icon-btn"
                                  type="button"
                                  onClick={() => promptDeleteBatch(batch)}
                                  title="Delete Batch"
                                  aria-label="Delete batch"
                                  style={{ color: '#dc2626' }}
                                >
                                  <Icon name="trash" size={15} />
                                </button>
                              )}
                              {!canEdit && (
                                <button
                                  className="btn icon-btn"
                                  type="button"
                                  onClick={() => openEditBatch(batch)}
                                  title="View Details"
                                  aria-label="View batch"
                                >
                                  <Icon name="eye" size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Pager Section */}
        <div className="pager" style={{ flexWrap: 'wrap', gap: '10px' }}>
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

      {/* ============================================================ */}
      {/* MODAL 1: Schedule / Edit Batch Modal                        */}
      {/* ============================================================ */}
      {isModalOpen && (() => {
        const isReadOnly = Boolean(editingBatch && !canEditBatch(editingBatch));
        return (
          <div
            className="overlay"
            id="batchOverlay"
            onMouseDown={(e) => { if (e.target.id === 'batchOverlay') setIsModalOpen(false); }}
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
          >
            <div
              className="modal"
              role="dialog"
              aria-modal="true"
              style={{
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)'
              }}
            >
              <header style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="t">
                  <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                    {isReadOnly 
                      ? 'Batch Details (View Only)' 
                      : editingBatch 
                        ? 'Edit Batch Details' 
                        : 'Create New Batch'}
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>
                    {editingBatch
                      ? `Updating schedule & assignments for #${editingBatch.id}`
                      : 'Set batch name, course, instructor, schedule, and student capacity.'}
                  </p>
                </div>
                <button
                  className="icon-btn"
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsModalOpen(false)}
                >
                  <span className="ic"><Icon name="x" size={18} /></span>
                </button>
              </header>

              <div className="modal-body" style={{ maxHeight: 'calc(90vh - 75px)', overflowY: 'auto' }}>
                <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Batch Name */}
                  <div className="fld">
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Batch Name *
                    </label>
                    <input
                      required
                      disabled={isReadOnly}
                      className="input"
                      value={formData.batchName}
                      onChange={e => setFormData({ ...formData, batchName: e.target.value })}
                      placeholder="e.g. Morning Advance Excel Batch A"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Course & Timing Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="fld">
                      <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                        Course Name *
                      </label>
                      <input
                        required
                        disabled={isReadOnly}
                        className="input"
                        list="batchCourseOptions"
                        value={formData.courseName}
                        onChange={e => setFormData({ ...formData, courseName: e.target.value })}
                        placeholder="Select or enter course"
                        style={{ width: '100%' }}
                      />
                      <datalist id="batchCourseOptions">
                        {courseOptions.map(c => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                    </div>

                    <div className="fld">
                      <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                        Timing / Time Slot *
                      </label>
                      <select
                        required
                        disabled={isReadOnly}
                        className="select"
                        value={timeSlots.includes(formData.batchTime) ? formData.batchTime : (formData.batchTime ? 'Other' : '')}
                        onChange={e => {
                          const val = e.target.value;
                          setFormData({ ...formData, batchTime: val === 'Other' ? (formData.batchTime || '07:00 AM - 08:00 AM') : val });
                        }}
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Select Time Slot --</option>
                        {timeSlots.map(slot => (
                          <option key={slot} value={slot}>{slot}</option>
                        ))}
                        <option value="Other">Custom Time Slot...</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom Time Slot if 'Other' */}
                  {(!timeSlots.includes(formData.batchTime) || formData.batchTime === 'Other') && (
                    <div className="fld">
                      <label style={{ fontWeight: 600, fontSize: '0.82rem', display: 'block', marginBottom: '4px' }}>
                        Specify Custom Time Slot *
                      </label>
                      <input
                        required
                        disabled={isReadOnly}
                        className="input"
                        value={formData.batchTime === 'Other' ? '' : formData.batchTime}
                        placeholder="e.g. 07:30 AM - 08:30 AM"
                        onChange={e => setFormData({ ...formData, batchTime: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  )}

                  {/* Assigned Teacher & Status */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="fld">
                      <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                        Assigned Teacher / Faculty
                      </label>
                      <select
                        disabled={isReadOnly}
                        className="select"
                        value={formData.instructorId}
                        onChange={e => setFormData({ ...formData, instructorId: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="">Unassigned</option>
                        {users?.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.fullName || u.full_name || u.username} {u.role ? `(${u.role})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="fld">
                      <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                        Batch Status *
                      </label>
                      <select
                        disabled={isReadOnly}
                        className="select"
                        value={formData.status}
                        onChange={e => setFormData({ ...formData, status: e.target.value })}
                        style={{ width: '100%' }}
                      >
                        <option value="Upcoming">Upcoming</option>
                        <option value="Ongoing">Ongoing</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                  </div>

                  {/* Student Count & Date */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="fld">
                      <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                        Student Count
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        disabled={isReadOnly}
                        className="input"
                        value={formData.studentCount}
                        onChange={e => setFormData({ ...formData, studentCount: e.target.value })}
                        placeholder="0"
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div className="fld">
                      <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                        Batch Schedule Date
                      </label>
                      <input
                        type="date"
                        disabled={isReadOnly}
                        className="input"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* Topic / Description */}
                  <div className="fld">
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Topic / Curriculum Module
                    </label>
                    <input
                      disabled={isReadOnly}
                      className="input"
                      value={formData.topic}
                      onChange={e => setFormData({ ...formData, topic: e.target.value })}
                      placeholder="e.g. Chapter 30: Cost Centers & GST Reconciliation"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Enrolled Students list / Notes */}
                  <div className="fld">
                    <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                      Enrolled Students (Names or IDs)
                    </label>
                    <textarea
                      disabled={isReadOnly}
                      className="input"
                      rows={3}
                      value={formData.students}
                      onChange={e => {
                        const val = e.target.value;
                        const items = val.split(/[\r\n,]+/).map(s => s.trim()).filter(Boolean);
                        setFormData({
                          ...formData,
                          students: val,
                          studentCount: items.length > 0 && (!formData.studentCount || formData.studentCount === 0) ? items.length : formData.studentCount
                        });
                      }}
                      placeholder="e.g. Saksham Arya, Taufeeq Ahmad Bhat, Kirandeep Kaur (one per line or comma-separated)"
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>

                  <div className="form-foot" style={{ marginTop: '8px', display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
                    {isReadOnly ? (
                      <button type="button" className="btn primary" onClick={() => setIsModalOpen(false)}>Close</button>
                    ) : (
                      <>
                        <button type="button" className="btn" onClick={() => setIsModalOpen(false)} disabled={savingBatch}>
                          Cancel
                        </button>
                        <button type="submit" className="btn primary" disabled={savingBatch}>
                          {savingBatch ? 'Saving...' : editingBatch ? 'Update Batch' : 'Create Batch'}
                        </button>
                      </>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ============================================================ */}
      {/* MODAL 2: Delete Confirmation Modal Popup                    */}
      {/* ============================================================ */}
      {batchToDelete && (
        <div
          className="overlay"
          id="deleteOverlay"
          onMouseDown={(e) => { if (e.target.id === 'deleteOverlay') setBatchToDelete(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px'
          }}
        >
          <div
            className="dialog"
            role="alertdialog"
            aria-modal="true"
            style={{
              maxWidth: '460px',
              width: '100%',
              background: '#fff',
              borderRadius: '12px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
              overflow: 'hidden'
            }}
          >
            <div style={{ padding: '20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Icon name="alert" size={22} />
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#0f172a' }}>
                  Delete Batch Confirmation
                </h4>
                <p style={{ margin: '0 0 12px', fontSize: '0.86rem', color: '#64748b', lineHeight: 1.5 }}>
                  Are you sure you want to permanently delete this batch? This action will remove the batch from the routine schedule.
                </p>

                {/* Batch Summary Card */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', fontSize: '0.82rem' }}>
                  <div><b>Batch Name:</b> {batchToDelete.batch_name || batchToDelete.topic || batchToDelete.course_name}</div>
                  <div style={{ marginTop: '3px' }}><b>Course:</b> {batchToDelete.course_name}</div>
                  <div style={{ marginTop: '3px' }}><b>Time Slot:</b> {batchToDelete.batch_time}</div>
                  <div style={{ marginTop: '3px' }}><b>Instructor:</b> {batchToDelete.instructor_name || 'Unassigned'}</div>
                </div>
              </div>
            </div>

            <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn"
                onClick={() => setBatchToDelete(null)}
                disabled={deletingBatch}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger-solid"
                onClick={confirmDeleteBatch}
                disabled={deletingBatch}
                style={{ background: '#dc2626', color: '#fff' }}
              >
                {deletingBatch ? 'Deleting...' : 'Yes, Delete Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
