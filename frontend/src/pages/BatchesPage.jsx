import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';

export default function BatchesPage({ user, users, onToast }) {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);

  const [formData, setFormData] = useState({
    batchTime: '', instructorId: '', courseName: '', topic: '', studentCount: 0, status: 'Upcoming', date: selectedDate
  });

  // Time slots for the 12-hour grid
  const timeSlots = [
    '08:00 AM - 09:00 AM', '09:00 AM - 10:00 AM', '10:00 AM - 11:00 AM', '11:00 AM - 12:00 PM',
    '12:00 PM - 01:00 PM', '01:00 PM - 02:00 PM', '02:00 PM - 03:00 PM', '03:00 PM - 04:00 PM',
    '04:00 PM - 05:00 PM', '05:00 PM - 06:00 PM', '06:00 PM - 07:00 PM', '07:00 PM - 08:00 PM'
  ];

  const loadBatches = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBatches(selectedDate);
      setBatches(data || []);
    } catch (err) {
      onToast(err.message || 'Failed to load batches.', true);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, onToast]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const openNewBatch = (timeSlot = '') => {
    setEditingBatch(null);
    setFormData({ batchTime: timeSlot, instructorId: '', courseName: '', topic: '', studentCount: 0, status: 'Upcoming', date: selectedDate });
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
      date: batch.date
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBatch) {
        await api.updateBatch(editingBatch.id, formData);
        onToast('Batch updated.');
      } else {
        await api.createBatch(formData);
        onToast('Batch created.');
      }
      setIsModalOpen(false);
      loadBatches();
    } catch (err) {
      onToast(err.message || 'Failed to save batch.', true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this batch?")) return;
    try {
      await api.deleteBatch(id);
      onToast('Batch deleted.');
      loadBatches();
    } catch (err) {
      onToast(err.message || 'Failed to delete batch.', true);
    }
  };

  return (
    <div className="page-section">
      <div className="page-head">
        <div>
          <h2>Daily Batch Management</h2>
          <p>Manage the institute's daily schedule.</p>
        </div>
        <div className="controls">
          <input type="date" className="input" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
          {user?.role === 'admin' && (
            <button className="btn btn-primary" onClick={() => openNewBatch()}>
              <span className="ic"><Icon name="plus" size={16} /></span>
              Add Batch
            </button>
          )}
        </div>
      </div>

      <div className="card table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading schedule...</div>
        ) : (
          <table className="table" style={{ minWidth: '800px' }}>
            <thead>
              <tr>
                <th style={{ width: '200px' }}>Time Slot</th>
                <th>Course & Topic</th>
                <th>Instructor</th>
                <th>Students</th>
                <th>Status</th>
                {user?.role === 'admin' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {timeSlots.map(slot => {
                const slotBatches = batches.filter(b => b.batch_time === slot);
                
                if (slotBatches.length === 0) {
                  return (
                    <tr key={slot}>
                      <td style={{ fontWeight: '500', color: '#64748b' }}>{slot}</td>
                      <td colSpan={user?.role === 'admin' ? 5 : 4} className="muted">
                        No batch scheduled.
                        {user?.role === 'admin' && (
                          <button className="btn btn-sm" style={{ marginLeft: '1rem' }} onClick={() => openNewBatch(slot)}>+ Schedule</button>
                        )}
                      </td>
                    </tr>
                  );
                }

                return slotBatches.map((batch, index) => (
                  <tr key={batch.id} style={{ background: batch.status === 'Ongoing' ? '#f0fdf4' : 'transparent' }}>
                    {index === 0 && (
                      <td rowSpan={slotBatches.length} style={{ fontWeight: '500', color: '#1e293b' }}>
                        {slot}
                        {user?.role === 'admin' && (
                          <div style={{ marginTop: '0.5rem' }}>
                            <button className="btn icon-btn" onClick={() => openNewBatch(slot)} title="Add overlapping batch"><Icon name="plus" size={12} /></button>
                          </div>
                        )}
                      </td>
                    )}
                    <td>
                      <strong>{batch.course_name}</strong>
                      {batch.topic && <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{batch.topic}</div>}
                    </td>
                    <td>{batch.instructor_name || 'Unassigned'}</td>
                    <td>{batch.student_count}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem',
                        background: batch.status === 'Completed' ? '#e2e8f0' : batch.status === 'Ongoing' ? '#bbf7d0' : '#fef08a'
                      }}>
                        {batch.status}
                      </span>
                    </td>
                    {user?.role === 'admin' && (
                      <td>
                        <button className="btn icon-btn" onClick={() => openEditBatch(batch)} title="Edit"><Icon name="edit" size={16} /></button>
                        <button className="btn icon-btn" onClick={() => handleDelete(batch.id)} title="Delete"><Icon name="trash" size={16} /></button>
                      </td>
                    )}
                  </tr>
                ));
              })}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && user?.role === 'admin' && (
        <div className="overlay" id="batchOverlay" onMouseDown={(e) => { if (e.target.id === 'batchOverlay') setIsModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '550px' }}>
            <header>
              <div className="t">
                <h3>{editingBatch ? 'Edit Batch' : 'Schedule Batch'}</h3>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setIsModalOpen(false)}>
                <span className="ic"><Icon name="x" size={18} /></span>
              </button>
            </header>
            <div className="modal-body">
              <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="fld">
                  <label>Time Slot <em>*</em></label>
                  <select required className="select" value={formData.batchTime} onChange={e => setFormData({...formData, batchTime: e.target.value})}>
                    <option value="">Select Time Slot</option>
                    {timeSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                    <option value="Other">Other Custom Time</option>
                  </select>
                </div>
                {formData.batchTime === 'Other' && (
                  <div className="fld">
                    <input required className="input" placeholder="e.g. 07:00 AM - 08:00 AM" onChange={e => setFormData({...formData, batchTime: e.target.value})} />
                  </div>
                )}
                
                <div className="fld">
                  <label>Course Name <em>*</em></label>
                  <input required className="input" value={formData.courseName} onChange={e => setFormData({...formData, courseName: e.target.value})} />
                </div>
                
                <div className="fld">
                  <label>Topic / Description</label>
                  <input className="input" value={formData.topic} onChange={e => setFormData({...formData, topic: e.target.value})} />
                </div>

                <div className="fld">
                  <label>Instructor</label>
                  <select className="select" value={formData.instructorId} onChange={e => setFormData({...formData, instructorId: e.target.value})}>
                    <option value="">Select Instructor</option>
                    {users?.map(u => (
                      <option key={u.id} value={u.id}>{u.fullName || u.full_name || u.username}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="fld">
                    <label>Student Count</label>
                    <input type="number" className="input" value={formData.studentCount} onChange={e => setFormData({...formData, studentCount: e.target.value})} />
                  </div>
                  <div className="fld">
                    <label>Status</label>
                    <select className="select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                      <option value="Upcoming">Upcoming</option>
                      <option value="Ongoing">Ongoing</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="form-foot" style={{ marginTop: '1rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Save Batch</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
