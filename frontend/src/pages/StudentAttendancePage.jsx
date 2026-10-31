import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';
import { BATCHES, fmtDay, initials, parseDate } from '../utils/helpers';

// Helper to get today's date in IST (YYYY-MM-DD)
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

export default function StudentAttendancePage({ user, onToast }) {
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'history' | 'summary'

  // Global student data
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for recording
  const [attendanceDate, setAttendanceDate] = useState(getTodayIST);
  const [batchFilter, setBatchFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Daily attendance state: map studentId -> { status: 'Present'|'Absent'|'Leave', remarks: '' }
  const [attendanceMap, setAttendanceMap] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [loadingDayRecords, setLoadingDayRecords] = useState(false);

  // History tab state
  const [selectedStudentForHistory, setSelectedStudentForHistory] = useState(null);
  const [studentHistory, setStudentHistory] = useState([]);
  const [studentHistoryStats, setStudentHistoryStats] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Summary tab state
  const [summaryMonth, setSummaryMonth] = useState(() => getTodayIST().slice(0, 7)); // YYYY-MM
  const [summaryData, setSummaryData] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  // Fetch initial student & enrollment data
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const [stuRes, enrRes] = await Promise.all([
        api.getStudents().catch(() => []),
        api.getEnrollments().catch(() => [])
      ]);
      setStudents(Array.isArray(stuRes) ? stuRes : (stuRes?.data || []));
      setEnrollments(Array.isArray(enrRes) ? enrRes : (enrRes?.data || []));
    } catch (err) {
      console.error(err);
      if (onToast) onToast('Failed to load students data', true);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load existing attendance for selected date
  const loadDateAttendance = useCallback(async (date) => {
    if (!date) return;
    setLoadingDayRecords(true);
    try {
      const records = await api.getStudentAttendance({ date });
      const list = Array.isArray(records) ? records : (records?.data || []);
      const newMap = {};
      list.forEach(r => {
        newMap[String(r.student_id)] = {
          status: r.status,
          remarks: r.remarks || '',
          id: r.id
        };
      });
      setAttendanceMap(newMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDayRecords(false);
    }
  }, []);

  useEffect(() => {
    if (attendanceDate) {
      loadDateAttendance(attendanceDate);
    }
  }, [attendanceDate, loadDateAttendance]);

  // Merge students with active enrollments
  const studentList = useMemo(() => {
    return students.map(s => {
      const enr = enrollments.find(e => String(e.studentId || e.student_id) === String(s.id || s.studentId));
      return {
        id: s.id || s.studentId,
        studentId: s.studentId || s.id,
        name: s.name || s.studentName || s.fullName || 'Student',
        phone: s.phone || s.contactNumber || s.contact_number || '',
        course: enr?.course || enr?.course_name || s.course || 'General',
        batchTime: enr?.batchTime || enr?.batch_time || s.batchTime || s.batch_time || 'General Batch',
        status: s.status || 'Active'
      };
    });
  }, [students, enrollments]);

  // Courses list
  const courses = useMemo(() => {
    const set = new Set();
    studentList.forEach(s => {
      if (s.course) set.add(s.course);
    });
    return ['All', ...Array.from(set).sort()];
  }, [studentList]);

  // Filtered students for recording table
  const filteredStudents = useMemo(() => {
    return studentList.filter(s => {
      if (courseFilter !== 'All' && s.course !== courseFilter) return false;
      if (batchFilter !== 'All' && s.batchTime !== batchFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (s.name || '').toLowerCase();
        const phone = (s.phone || '').toLowerCase();
        const sid = String(s.studentId || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !sid.includes(q)) return false;
      }
      return true;
    });
  }, [studentList, courseFilter, batchFilter, searchQuery]);

  // Status counters for the selected date
  const dayStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let leave = 0;
    let unmarked = 0;

    filteredStudents.forEach(s => {
      const record = attendanceMap[String(s.id)];
      if (!record || !record.status) {
        unmarked++;
      } else if (record.status === 'Present') {
        present++;
      } else if (record.status === 'Absent') {
        absent++;
      } else if (record.status === 'Leave') {
        leave++;
      }
    });

    const totalMarked = present + absent + leave;
    const rate = totalMarked > 0 ? Math.round((present / totalMarked) * 100) : 0;

    return { total: filteredStudents.length, present, absent, leave, unmarked, totalMarked, rate };
  }, [filteredStudents, attendanceMap]);

  // Set status for single student
  const setStudentStatus = (studentId, status) => {
    setAttendanceMap(prev => ({
      ...prev,
      [String(studentId)]: {
        ...(prev[String(studentId)] || {}),
        status: prev[String(studentId)]?.status === status ? '' : status
      }
    }));
  };

  // Set remarks for single student
  const setStudentRemarks = (studentId, remarks) => {
    setAttendanceMap(prev => ({
      ...prev,
      [String(studentId)]: {
        ...(prev[String(studentId)] || {}),
        remarks
      }
    }));
  };

  // Mark all filtered students as Present
  const handleMarkAllPresent = () => {
    const updated = { ...attendanceMap };
    filteredStudents.forEach(s => {
      updated[String(s.id)] = {
        ...(updated[String(s.id)] || {}),
        status: 'Present'
      };
    });
    setAttendanceMap(updated);
    if (onToast) onToast(`Marked ${filteredStudents.length} students as Present`);
  };

  // Clear all marked attendance for filtered students
  const handleClearAll = () => {
    const updated = { ...attendanceMap };
    filteredStudents.forEach(s => {
      if (updated[String(s.id)]) {
        updated[String(s.id)] = {
          ...(updated[String(s.id)] || {}),
          status: ''
        };
      }
    });
    setAttendanceMap(updated);
  };

  // Save Attendance to Backend
  const handleSaveAttendance = async () => {
    // Collect records to save
    const recordsToSave = [];
    filteredStudents.forEach(s => {
      const rec = attendanceMap[String(s.id)];
      if (rec && rec.status) {
        recordsToSave.push({
          student_id: s.id,
          student_name: s.name,
          course_name: s.course,
          batch_time: s.batchTime,
          date: attendanceDate,
          status: rec.status,
          remarks: rec.remarks || ''
        });
      }
    });

    if (recordsToSave.length === 0) {
      if (onToast) onToast('Please mark attendance for at least one student before saving', true);
      return;
    }

    setSavingAttendance(true);
    try {
      await api.recordStudentAttendance(recordsToSave);
      if (onToast) onToast(`Attendance saved for ${recordsToSave.length} students (${attendanceDate})`);
      await loadDateAttendance(attendanceDate);
    } catch (err) {
      console.error(err);
      if (onToast) onToast(err.message || 'Failed to save attendance', true);
    } finally {
      setSavingAttendance(false);
    }
  };

  // Load individual student history
  const handleViewStudentHistory = async (student) => {
    setSelectedStudentForHistory(student);
    setActiveTab('history');
    setHistoryLoading(true);
    try {
      const res = await api.getStudentAttendanceHistory(student.id);
      const history = res?.history || (Array.isArray(res) ? res : []);
      const stats = res?.stats || null;
      setStudentHistory(history);
      setStudentHistoryStats(stats);
    } catch (err) {
      console.error(err);
      if (onToast) onToast('Failed to load student history', true);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Load monthly summary data
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.getStudentAttendanceSummary({ month: summaryMonth });
      setSummaryData(Array.isArray(res) ? res : (res?.data || []));
    } catch (err) {
      console.error(err);
    } finally {
      setSummaryLoading(false);
    }
  }, [summaryMonth]);

  useEffect(() => {
    if (activeTab === 'summary') {
      loadSummary();
    }
  }, [activeTab, loadSummary]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Student ID', 'Student Name', 'Course', 'Batch Time', 'Phone', 'Date', 'Status', 'Remarks'];
    const rows = filteredStudents.map(s => {
      const rec = attendanceMap[String(s.id)] || {};
      return [
        `"${s.studentId || s.id}"`,
        `"${s.name}"`,
        `"${s.course}"`,
        `"${s.batchTime}"`,
        `"${s.phone}"`,
        `"${attendanceDate}"`,
        `"${rec.status || 'Not Marked'}"`,
        `"${(rec.remarks || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Attendance_${attendanceDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (onToast) onToast('Attendance report exported to CSV');
  };

  return (
    <div className="student-attendance-page" style={{ paddingBottom: '3rem' }}>
      {/* Page Header */}
      <div className="page-head" style={{ marginBottom: '1.25rem' }}>
        <div>
          <h2>Student Attendance</h2>
          <p>Record daily student attendance by batch, manage attendance history, and review reports.</p>
        </div>
        <div className="controls">
          <button
            className="btn"
            type="button"
            onClick={handleExportCSV}
            title="Export filtered records to CSV"
          >
            <span className="ic"><Icon name="download" size={16} /></span>
            Export CSV
          </button>
          <button
            className="btn"
            type="button"
            onClick={() => {
              loadInitialData();
              loadDateAttendance(attendanceDate);
            }}
            title="Refresh"
          >
            <span className={`ic ${loading ? 'spin' : ''}`}><Icon name="refresh" size={16} /></span>
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="tabs" role="tablist" style={{ marginBottom: '1.25rem' }}>
        <button
          className="tab"
          role="tab"
          aria-selected={activeTab === 'record'}
          onClick={() => setActiveTab('record')}
        >
          <span className="ic"><Icon name="clock" size={18} /></span>
          Daily Attendance Sheet
        </button>
        <button
          className="tab"
          role="tab"
          aria-selected={activeTab === 'history'}
          onClick={() => setActiveTab('history')}
        >
          <span className="ic"><Icon name="users" size={18} /></span>
          Student History {selectedStudentForHistory ? `(${selectedStudentForHistory.name})` : ''}
        </button>
        <button
          className="tab"
          role="tab"
          aria-selected={activeTab === 'summary'}
          onClick={() => setActiveTab('summary')}
        >
          <span className="ic"><Icon name="dashboard" size={18} /></span>
          Monthly Summary & Reports
        </button>
      </div>

      {/* TAB 1: Daily Attendance Sheet */}
      {activeTab === 'record' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Top Control & Filter Bar */}
          <div className="card section" style={{ margin: 0, padding: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', alignItems: 'end' }}>
              <div>
                <label className="label">Attendance Date</label>
                <input
                  type="date"
                  className="input"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  style={{ width: '100%', fontWeight: 600 }}
                />
              </div>

              <div>
                <label className="label">Course</label>
                <select
                  className="select"
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  style={{ width: '100%' }}
                >
                  {courses.map(c => (
                    <option key={c} value={c}>{c === 'All' ? 'All Courses' : c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Batch Time</label>
                <select
                  className="select"
                  value={batchFilter}
                  onChange={(e) => setBatchFilter(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="All">All Batch Slots</option>
                  {BATCHES.map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Search Student</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Name, Phone, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            {/* Quick Action Buttons & Summary Counters */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '1rem' }}>
              {/* Counters */}
              <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                <span style={{ color: '#475569' }}>Total Enrolled: <b>{dayStats.total}</b></span>
                <span style={{ color: '#047857' }}>● Present: <b>{dayStats.present}</b></span>
                <span style={{ color: '#b91c1c' }}>● Absent: <b>{dayStats.absent}</b></span>
                <span style={{ color: '#d97706' }}>● Leave: <b>{dayStats.leave}</b></span>
                <span style={{ color: '#64748b' }}>○ Unmarked: <b>{dayStats.unmarked}</b></span>
                {dayStats.totalMarked > 0 && (
                  <span style={{ padding: '3px 10px', background: '#ecfdf5', color: '#047857', borderRadius: '12px', fontWeight: 600 }}>
                    {dayStats.rate}% Attendance
                  </span>
                )}
              </div>

              {/* Batch Controls */}
              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleMarkAllPresent}
                  style={{ fontSize: '0.85rem' }}
                >
                  ✓ Mark All Present
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={handleClearAll}
                  style={{ fontSize: '0.85rem' }}
                >
                  Clear All
                </button>
                <button
                  type="button"
                  className="btn primary"
                  disabled={savingAttendance}
                  onClick={handleSaveAttendance}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1.1rem' }}
                >
                  {savingAttendance ? 'Saving...' : '💾 Save Attendance'}
                </button>
              </div>
            </div>
          </div>

          {/* Student Attendance Table */}
          <div className="card section" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
            {loadingDayRecords ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                <span>Loading attendance for {attendanceDate}...</span>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <p>No students match the current filter criteria.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem', color: '#475569' }}>
                      <th style={{ padding: '0.85rem 1rem', width: '50px' }}>#</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Student Name</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Course & Batch</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Contact</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center', width: '240px' }}>Attendance Status</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Remarks / Reason</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right', width: '90px' }}>History</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((s, idx) => {
                      const rec = attendanceMap[String(s.id)] || {};
                      const currentStatus = rec.status || '';

                      return (
                        <tr
                          key={s.id || idx}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            backgroundColor: currentStatus === 'Present' ? '#f0fdf4' : currentStatus === 'Absent' ? '#fef2f2' : currentStatus === 'Leave' ? '#fffbeb' : '#ffffff'
                          }}
                        >
                          {/* Index */}
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#64748b' }}>
                            {idx + 1}
                          </td>

                          {/* Student Details */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: '#e0e7ff',
                                color: '#3730a3',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.8rem'
                              }}>
                                {initials(s.name)}
                              </div>
                              <div>
                                <b style={{ fontSize: '0.92rem', color: '#0f172a', display: 'block' }}>{s.name}</b>
                                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>ID: {s.studentId || s.id}</span>
                              </div>
                            </div>
                          </td>

                          {/* Course & Batch */}
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.88rem' }}>
                            <span style={{ fontWeight: 600, color: '#1e293b', display: 'block' }}>{s.course}</span>
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{s.batchTime}</span>
                          </td>

                          {/* Contact */}
                          <td style={{ padding: '0.85rem 1rem', fontSize: '0.85rem', color: '#334155' }}>
                            {s.phone ? (
                              <a href={`tel:${s.phone}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                                {s.phone}
                              </a>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>–</span>
                            )}
                          </td>

                          {/* Status Toggles (Present / Absent / Leave) */}
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                              <button
                                type="button"
                                onClick={() => setStudentStatus(s.id, 'Present')}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  border: 'none',
                                  borderRight: '1px solid #cbd5e1',
                                  backgroundColor: currentStatus === 'Present' ? '#16a34a' : '#ffffff',
                                  color: currentStatus === 'Present' ? '#ffffff' : '#16a34a',
                                  transition: 'background-color 0.1s ease'
                                }}
                              >
                                P (Present)
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentStatus(s.id, 'Absent')}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  border: 'none',
                                  borderRight: '1px solid #cbd5e1',
                                  backgroundColor: currentStatus === 'Absent' ? '#dc2626' : '#ffffff',
                                  color: currentStatus === 'Absent' ? '#ffffff' : '#dc2626',
                                  transition: 'background-color 0.1s ease'
                                }}
                              >
                                A (Absent)
                              </button>
                              <button
                                type="button"
                                onClick={() => setStudentStatus(s.id, 'Leave')}
                                style={{
                                  padding: '0.35rem 0.75rem',
                                  fontSize: '0.82rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  border: 'none',
                                  backgroundColor: currentStatus === 'Leave' ? '#d97706' : '#ffffff',
                                  color: currentStatus === 'Leave' ? '#ffffff' : '#d97706',
                                  transition: 'background-color 0.1s ease'
                                }}
                              >
                                L (Leave)
                              </button>
                            </div>
                          </td>

                          {/* Remarks */}
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <input
                              type="text"
                              className="input"
                              placeholder="Reason / notes..."
                              value={rec.remarks || ''}
                              onChange={(e) => setStudentRemarks(s.id, e.target.value)}
                              style={{ width: '100%', fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
                            />
                          </td>

                          {/* Individual History Link */}
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => handleViewStudentHistory(s)}
                              style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem' }}
                              title="View student attendance history"
                            >
                              <span className="ic"><Icon name="clock" size={13} /></span>
                              Logs
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Individual Student Attendance History */}
      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Student Picker Bar */}
          <div className="card section" style={{ margin: 0, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Student Attendance History</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Select a student to inspect full attendance logs, attendance rate, and leave records.
                </p>
              </div>

              <div style={{ minWidth: '260px' }}>
                <select
                  className="select"
                  value={selectedStudentForHistory?.id || ''}
                  onChange={(e) => {
                    const found = studentList.find(s => String(s.id) === String(e.target.value));
                    if (found) handleViewStudentHistory(found);
                  }}
                  style={{ width: '100%', fontSize: '0.9rem' }}
                >
                  <option value="">-- Choose a Student --</option>
                  {studentList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.course})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Selected Student Stat Card */}
          {selectedStudentForHistory ? (
            <div>
              <div className="card section" style={{ margin: 0, padding: '1.25rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: '#0f172a' }}>{selectedStudentForHistory.name}</h2>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.35rem', fontSize: '0.85rem', color: '#475569' }}>
                      <span><b>Course:</b> {selectedStudentForHistory.course}</span>
                      <span><b>Batch:</b> {selectedStudentForHistory.batchTime}</span>
                      <span><b>Phone:</b> {selectedStudentForHistory.phone || '–'}</span>
                    </div>
                  </div>

                  {studentHistoryStats && (
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Total Sessions</span>
                        <b style={{ fontSize: '1.1rem', color: '#0f172a' }}>{studentHistoryStats.total}</b>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#166534', display: 'block' }}>Present</span>
                        <b style={{ fontSize: '1.1rem', color: '#16a34a' }}>{studentHistoryStats.present}</b>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca' }}>
                        <span style={{ fontSize: '0.75rem', color: '#991b1b', display: 'block' }}>Absent</span>
                        <b style={{ fontSize: '1.1rem', color: '#dc2626' }}>{studentHistoryStats.absent}</b>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem 1rem', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7' }}>
                        <span style={{ fontSize: '0.75rem', color: '#92400e', display: 'block' }}>Leave</span>
                        <b style={{ fontSize: '1.1rem', color: '#d97706' }}>{studentHistoryStats.leave}</b>
                      </div>
                      <div style={{ textAlign: 'center', padding: '0.5rem 1.25rem', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <span style={{ fontSize: '0.75rem', color: '#1e40af', display: 'block' }}>Attendance Rate</span>
                        <b style={{ fontSize: '1.25rem', color: '#2563eb' }}>{studentHistoryStats.percentage}%</b>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* History Table */}
              <div className="card section" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
                {historyLoading ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                    <span>Loading student records...</span>
                  </div>
                ) : studentHistory.length === 0 ? (
                  <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                    <p>No recorded attendance history for this student yet.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem', color: '#475569' }}>
                          <th style={{ padding: '0.85rem 1rem' }}>Date</th>
                          <th style={{ padding: '0.85rem 1rem' }}>Batch Time</th>
                          <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                          <th style={{ padding: '0.85rem 1rem' }}>Remarks</th>
                          <th style={{ padding: '0.85rem 1rem' }}>Logged At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {studentHistory.map((item, idx) => {
                          const statusColor = item.status === 'Present' ? '#16a34a' : item.status === 'Absent' ? '#dc2626' : '#d97706';
                          const statusBg = item.status === 'Present' ? '#dcfce7' : item.status === 'Absent' ? '#fee2e2' : '#fef3c7';

                          return (
                            <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: '#0f172a' }}>
                                {fmtDay(item.date)}
                              </td>
                              <td style={{ padding: '0.85rem 1rem', color: '#475569', fontSize: '0.88rem' }}>
                                {item.batch_time || '–'}
                              </td>
                              <td style={{ padding: '0.85rem 1rem' }}>
                                <span style={{
                                  padding: '3px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  backgroundColor: statusBg,
                                  color: statusColor
                                }}>
                                  {item.status}
                                </span>
                              </td>
                              <td style={{ padding: '0.85rem 1rem', color: '#475569', fontSize: '0.85rem' }}>
                                {item.remarks || '–'}
                              </td>
                              <td style={{ padding: '0.85rem 1rem', color: '#94a3b8', fontSize: '0.8rem' }}>
                                {item.created_at ? fmtDay(item.created_at) : '–'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card section" style={{ margin: 0, padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
              <span className="ic" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}><Icon name="users" size={36} /></span>
              <p>Please select a student from the dropdown above to view their attendance history.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Monthly Summary & Reports */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Month Selector Bar */}
          <div className="card section" style={{ margin: 0, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Monthly Attendance Summary</h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  Comprehensive breakdown of student presence, absence, and attendance percentages for {summaryMonth}.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <label className="label" style={{ margin: 0 }}>Select Month:</label>
                <input
                  type="month"
                  className="input"
                  value={summaryMonth}
                  onChange={(e) => setSummaryMonth(e.target.value)}
                  style={{ fontWeight: 600 }}
                />
              </div>
            </div>
          </div>

          {/* Summary Data Table */}
          <div className="card section" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
            {summaryLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <div className="spinner" style={{ margin: '0 auto 0.5rem' }} />
                <span>Computing monthly summary...</span>
              </div>
            ) : summaryData.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                <p>No attendance records found for {summaryMonth}.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0', textAlign: 'left', fontSize: '0.85rem', color: '#475569' }}>
                      <th style={{ padding: '0.85rem 1rem' }}>Student Name</th>
                      <th style={{ padding: '0.85rem 1rem' }}>Course</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Total Classes</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Present</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Absent</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Leave</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>Attendance Rate</th>
                      <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.map((row, idx) => {
                      const pct = Number(row.percentage || 0);
                      const rateColor = pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';

                      return (
                        <tr key={row.student_id || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <b style={{ color: '#0f172a' }}>{row.student_name}</b>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'block' }}>ID: {row.student_id}</span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', color: '#334155', fontSize: '0.88rem' }}>
                            {row.course_name || '–'}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', fontWeight: 600 }}>
                            {row.total_classes}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>
                            {row.present_count}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#dc2626', fontWeight: 600 }}>
                            {row.absent_count}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center', color: '#d97706', fontWeight: 600 }}>
                            {row.leave_count}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '0.82rem',
                              fontWeight: 700,
                              color: rateColor,
                              background: pct >= 75 ? '#dcfce7' : pct >= 50 ? '#fef3c7' : '#fee2e2'
                            }}>
                              {pct}%
                            </span>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => {
                                const s = studentList.find(st => String(st.id) === String(row.student_id));
                                if (s) handleViewStudentHistory(s);
                              }}
                              style={{ padding: '0.3rem 0.55rem', fontSize: '0.78rem' }}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
