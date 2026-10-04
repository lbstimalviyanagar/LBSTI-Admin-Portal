import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';

export default function AttendancePage({ user, onToast }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleClockIn = async () => {
    try {
      await api.clockIn();
      onToast('Clocked in successfully.');
      loadRecords();
    } catch (err) {
      onToast(err.message || 'Failed to clock in.', true);
    }
  };

  const handleClockOut = async () => {
    try {
      await api.clockOut();
      onToast('Clocked out successfully.');
      loadRecords();
    } catch (err) {
      onToast(err.message || 'Failed to clock out.', true);
    }
  };

  return (
    <div className="page-section">
      <div className="page-head">
        <div>
          <h2>Staff Attendance</h2>
          <p>Track your daily clock-in and clock-out times.</p>
        </div>
        <div className="controls">
          <button className="btn btn-primary" onClick={handleClockIn}>
            <span className="ic"><Icon name="clock" size={16} /></span>
            Clock In
          </button>
          <button className="btn btn-danger" onClick={handleClockOut}>
            <span className="ic"><Icon name="clock" size={16} /></span>
            Clock Out
          </button>
        </div>
      </div>

      <div className="card table-container">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading attendance...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                {user?.role === 'admin' && <th>Staff Member</th>}
                <th>Date</th>
                <th>Clock In</th>
                <th>Clock Out</th>
                <th>Total Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.length > 0 ? records.map(r => (
                <tr key={r.id}>
                  {user?.role === 'admin' && <td>{r.staff_name || r.staff_id}</td>}
                  <td>{r.date}</td>
                  <td>{r.clock_in ? new Date(r.clock_in).toLocaleTimeString() : '-'}</td>
                  <td>{r.clock_out ? new Date(r.clock_out).toLocaleTimeString() : '-'}</td>
                  <td>{r.total_hours}</td>
                  <td>{r.status}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={user?.role === 'admin' ? 6 : 5} className="muted text-center py-8">
                    No attendance records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
