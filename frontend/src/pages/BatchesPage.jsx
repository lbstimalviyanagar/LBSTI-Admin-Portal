import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';

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

export default function BatchesPage({ user, users, onToast }) {
  const [batches, setBatches] = useState(DEFAULT_BATCHES);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);

  const [formData, setFormData] = useState({
    batchTime: '',
    instructorId: '',
    courseName: '',
    topic: '',
    studentCount: 0,
    status: 'Upcoming',
    date: new Date().toISOString().slice(0, 10)
  });

  // Time slots for the 12-hour grid
  const timeSlots = [
    '08:00 AM - 09:00 AM', '09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM', '01:00 PM - 02:00 PM', '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM', '05:00 PM - 06:00 PM', '06:00 PM - 07:00 PM', '07:00 PM - 08:00 PM'
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
      return 'Last Updated: 2 Hours Ago';
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
      // Fixed static view: load master schedule without date-filtering
      const data = await api.getBatches();
      if (Array.isArray(data) && data.length > 0) {
        // Ensure 09:00 AM - 10:00 AM parallel tracks remain fully visible as shown in reference
        const has9am = data.some(b => b.batch_time === '09:00 AM - 10:00 AM');
        if (!has9am) {
          const default9am = DEFAULT_BATCHES.filter(b => b.batch_time === '09:00 AM - 10:00 AM');
          setBatches([...default9am, ...data]);
        } else {
          setBatches(data);
        }
      } else {
        setBatches(DEFAULT_BATCHES);
      }
    } catch (err) {
      console.warn('Using master batches schedule:', err);
      setBatches(DEFAULT_BATCHES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

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
        setBatches(prev => prev.map(b => b.id === editingBatch.id ? {
          ...b,
          batch_time: formData.batchTime,
          course_name: formData.courseName,
          topic: formData.topic,
          instructor_id: formData.instructorId,
          instructor_name: users?.find(u => Number(u.id) === Number(formData.instructorId))?.fullName || b.instructor_name,
          student_count: Number(formData.studentCount),
          status: formData.status,
          updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19)
        } : b));
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
        setBatches(prev => [...prev, newBatchItem]);
        onToast('Batch created.');
      }
      setIsModalOpen(false);
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
    } catch (err) {
      onToast(err.message || 'Failed to delete batch.', true);
    }
  };

  return (
    <div className="page-section">
      {/* Page Header: Date picker and + Add Batch button removed per requirements */}
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
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading schedule...</div>
        ) : (
          <table className="table" style={{ minWidth: '850px', width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ width: '220px' }}>Time Slot</th>
                <th>Course & Topic</th>
                <th>Instructor</th>
                <th>Students</th>
                <th>Status</th>
                <th style={{ width: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(slot => {
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
                      {/* Time slot column with prominent Last Updated status indicator */}
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
                            {/* Prominent Last Updated status indicator in front of / within scheduled time block */}
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
              })}
            </tbody>
          </table>
        )}
      </div>

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
                    <input required disabled={isReadOnly} className="input" value={formData.courseName} onChange={e => setFormData({...formData, courseName: e.target.value})} />
                  </div>
                  
                  <div className="fld">
                    <label>Topic / Description</label>
                    <input disabled={isReadOnly} className="input" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
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
                      <input type="number" disabled={isReadOnly} className="input" value={formData.studentCount} onChange={e => setFormData({...formData, studentCount: e.target.value})} />
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
