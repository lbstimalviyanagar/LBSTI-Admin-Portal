import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';

export default function TasksPage({ user, users, onToast }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  
  const [formData, setFormData] = useState({
    title: '', description: '', assignedTo: '', dueDate: '', status: 'Pending', remarks: ''
  });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTasks();
      setTasks(data || []);
    } catch (err) {
      onToast(err.message || 'Failed to load tasks.', true);
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const openNewTask = () => {
    setEditingTask(null);
    setFormData({ title: '', description: '', assignedTo: '', dueDate: '', status: 'Pending', remarks: '' });
    setIsModalOpen(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title,
      description: task.description || '',
      assignedTo: task.assigned_to,
      dueDate: task.due_date || '',
      status: task.status,
      remarks: task.remarks || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        await api.updateTask(editingTask.id, formData);
        onToast('Task updated.');
      } else {
        await api.createTask(formData);
        onToast('Task created.');
      }
      setIsModalOpen(false);
      loadTasks();
    } catch (err) {
      onToast(err.message || 'Failed to save task.', true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await api.deleteTask(id);
      onToast('Task deleted.');
      loadTasks();
    } catch (err) {
      onToast(err.message || 'Failed to delete task.', true);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      await api.updateTask(id, { status });
      onToast(`Task marked as ${status}.`);
      loadTasks();
    } catch (err) {
      onToast(err.message || 'Failed to update status.', true);
    }
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('taskId', id);
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // allow drop
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      const task = tasks.find(t => t.id.toString() === taskId);
      if (task && task.status !== newStatus) {
        // Optimistic UI update
        setTasks(prev => prev.map(t => t.id.toString() === taskId ? { ...t, status: newStatus } : t));
        updateStatus(taskId, newStatus);
      }
    }
  };

  const renderTaskCard = (task) => (
    <div 
      key={task.id} 
      className="card" 
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      style={{ padding: '1rem', marginBottom: '1rem', cursor: 'grab', borderLeft: task.status === 'Completed' ? '4px solid #10b981' : task.status === 'In Progress' ? '4px solid #3b82f6' : '4px solid #f59e0b' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>{task.title}</h4>
        <div>
          <button className="btn icon-btn" onClick={() => openEditTask(task)} title="Edit"><Icon name="edit" size={14} /></button>
          {user?.role === 'admin' && (
            <button className="btn icon-btn" onClick={() => handleDelete(task.id)} title="Delete"><Icon name="trash" size={14} /></button>
          )}
        </div>
      </div>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#64748b' }}>{task.description}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
        <span>Due: {task.due_date || 'No date'}</span>
        <span>Assigned to: {task.assigned_to_name || task.assigned_to}</span>
      </div>
      {task.remarks && (
        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.85rem' }}>
          <strong>Remarks:</strong> {task.remarks}
        </div>
      )}
      <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
        {task.status !== 'Pending' && <button className="btn btn-sm" onClick={() => updateStatus(task.id, 'Pending')}>Set Pending</button>}
        {task.status !== 'In Progress' && <button className="btn btn-sm" onClick={() => updateStatus(task.id, 'In Progress')}>Set In Progress</button>}
        {task.status !== 'Completed' && <button className="btn btn-sm" onClick={() => updateStatus(task.id, 'Completed')}>Set Completed</button>}
      </div>
    </div>
  );

  return (
    <div className="page-section">
      <div className="page-head">
        <div>
          <h2>Task Management</h2>
          <p>Manage and track staff assignments.</p>
        </div>
        {user?.role === 'admin' && (
          <div className="controls">
            <button className="btn btn-primary" onClick={openNewTask}>
              <span className="ic"><Icon name="plus" size={16} /></span>
              Assign Task
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading tasks...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {['Pending', 'In Progress', 'Completed'].map(status => (
            <div 
              key={status} 
              style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
            >
              <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: '#334155' }}>{status}</h3>
              <div className="kanban-column" style={{ minHeight: '150px' }}>
                {tasks.filter(t => t.status === status).map(renderTaskCard)}
                {tasks.filter(t => t.status === status).length === 0 && (
                  <p className="muted" style={{ fontSize: '0.9rem' }}>No tasks in this list. Drop tasks here.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="overlay" id="taskOverlay" onMouseDown={(e) => { if (e.target.id === 'taskOverlay') setIsModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '500px' }}>
            <header>
              <div className="t">
                <h3>{editingTask ? 'Edit Task' : 'Assign Task'}</h3>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setIsModalOpen(false)}>
                <span className="ic"><Icon name="x" size={18} /></span>
              </button>
            </header>
            <div className="modal-body">
              <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="fld">
                  <label>Title <em>*</em></label>
                  <input required className="input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} disabled={user?.role !== 'admin' && !editingTask} />
                </div>
                <div className="fld">
                  <label>Description</label>
                  <textarea className="textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} disabled={user?.role !== 'admin' && !editingTask} />
                </div>
                {user?.role === 'admin' && (
                  <>
                    <div className="fld">
                      <label>Assign To <em>*</em></label>
                      <select required className="select" value={formData.assignedTo} onChange={e => setFormData({...formData, assignedTo: e.target.value})}>
                        <option value="">Select Staff</option>
                        {users?.map(u => (
                          <option key={u.id} value={u.id}>{u.fullName || u.full_name || u.username}</option>
                        ))}
                      </select>
                    </div>
                    <div className="fld">
                      <label>Due Date</label>
                      <input type="date" className="input" value={formData.dueDate} onChange={e => setFormData({...formData, dueDate: e.target.value})} />
                    </div>
                  </>
                )}
                {editingTask && (
                  <>
                    <div className="fld">
                      <label>Status</label>
                      <select className="select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                      </select>
                    </div>
                    <div className="fld">
                      <label>Remarks / Update</label>
                      <textarea className="textarea" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} />
                    </div>
                  </>
                )}
                <div className="form-foot" style={{ marginTop: '1rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Save Task</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
