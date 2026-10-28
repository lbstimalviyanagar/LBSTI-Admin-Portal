import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';

export default function TasksPage({ user, users = [], onToast }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ faculty: [] });

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('All');
  
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

  // Load filter options dynamically from backend API on mount
  useEffect(() => {
    let isMounted = true;
    if (typeof api.getTaskFilterOptions === 'function') {
      api.getTaskFilterOptions()
        .then(res => {
          if (isMounted && res && Array.isArray(res.faculty)) {
            setFilterOptions(res);
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, []);

  // Dynamically extract unique faculty/staff options from API, users prop, and loaded tasks
  const facultyOptions = useMemo(() => {
    const map = new Map();

    // 1. From API options
    if (Array.isArray(filterOptions?.faculty)) {
      filterOptions.faculty.forEach(f => {
        const name = (f.name || f.fullName || f.username || '').trim();
        if (name) {
          map.set(name.toLowerCase(), { id: f.id, name });
        }
      });
    }

    // 2. From users prop
    if (Array.isArray(users)) {
      users.forEach(u => {
        const name = (u.fullName || u.full_name || u.username || '').trim();
        if (name) {
          map.set(name.toLowerCase(), { id: u.id, name });
        }
      });
    }

    // 3. From loaded tasks
    tasks.forEach(t => {
      const assignedUser = users?.find(u => String(u.id) === String(t.assigned_to));
      const name = (t.assigned_to_name || assignedUser?.fullName || assignedUser?.full_name || assignedUser?.username || '').trim();
      if (name) {
        map.set(name.toLowerCase(), { id: t.assigned_to, name });
      }
    });

    return Array.from(map.values()).sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [tasks, users, filterOptions]);

  // Detect whether any filter is active
  const hasActiveFilters = Boolean(searchQuery.trim() || facultyFilter !== 'All');

  // Filter tasks dynamically based on search query and faculty filter
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return tasks.filter(task => {
      const assignedUser = users?.find(u => String(u.id) === String(task.assigned_to));
      const assignedName = (task.assigned_to_name || assignedUser?.fullName || assignedUser?.full_name || assignedUser?.username || '').trim();

      // 1. Faculty Filter
      if (facultyFilter !== 'All') {
        const selLower = facultyFilter.trim().toLowerCase();
        const matchesName = assignedName.toLowerCase() === selLower;
        const matchesId = String(task.assigned_to) === String(facultyFilter);
        if (!matchesName && !matchesId) return false;
      }

      // 2. Search Query Filter (Title, Description, Faculty/Staff, Due Date, Status, Remarks)
      if (tokens.length > 0) {
        const title = String(task.title || '').toLowerCase();
        const description = String(task.description || '').toLowerCase();
        const staff = assignedName.toLowerCase();
        const dueDate = String(task.due_date || '').toLowerCase();
        const status = String(task.status || '').toLowerCase();
        const remarks = String(task.remarks || '').toLowerCase();
        const searchableText = `${title} ${description} ${staff} ${dueDate} ${status} ${remarks}`;

        const allTokensMatch = tokens.every(token => searchableText.includes(token));
        if (!allTokensMatch) return false;
      }

      return true;
    });
  }, [tasks, facultyFilter, searchQuery, users]);

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery('');
    setFacultyFilter('All');
  };

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

  const renderTaskCard = (task) => {
    const assignedUser = users?.find(u => String(u.id) === String(task.assigned_to));
    const assignedName = task.assigned_to_name || assignedUser?.fullName || assignedUser?.full_name || assignedUser?.username || 'Staff';
    const avatarUrl = task.assigned_to_photo || assignedUser?.profilePhotoUrl || assignedUser?.profile_photo;

    return (
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#64748b' }}>
          <span>Due: {task.due_date || 'No date'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={assignedName} 
                style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} 
              />
            ) : (
              <span style={{ 
                width: '22px', 
                height: '22px', 
                borderRadius: '50%', 
                background: '#cbd5e1', 
                color: '#334155', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '0.7rem', 
                fontWeight: '600',
                flexShrink: 0
              }}>
                {assignedName ? assignedName.charAt(0).toUpperCase() : '?'}
              </span>
            )}
            <span>Assigned to: <strong>{assignedName}</strong></span>
          </div>
        </div>
        {task.remarks && (
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f1f5f9', borderRadius: '4px', fontSize: '0.85rem' }}>
            <strong>Remarks:</strong> {task.remarks}
          </div>
        )}
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {task.status !== 'Pending' && <button className="btn btn-sm" onClick={() => updateStatus(task.id, 'Pending')}>Set Pending</button>}
          {task.status !== 'In Progress' && <button className="btn btn-sm" onClick={() => updateStatus(task.id, 'In Progress')}>Set In Progress</button>}
          {task.status !== 'Completed' && <button className="btn btn-sm" onClick={() => updateStatus(task.id, 'Completed')}>Set Completed</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="page-section">
      {/* Page Header */}
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

      {/* Dynamic Search & Filtering Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search Bar */}
          <div className="search" style={{ minWidth: '220px', flex: '1 1 240px' }}>
            <span className="si"><Icon name="search" size={18} /></span>
            <input
              className="input"
              type="search"
              placeholder="Search title, description, staff, date, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              aria-label="Search tasks"
            />
          </div>

          {/* Faculty Dropdown Filter */}
          <div className="fl">
            <select
              className="select"
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              aria-label="Filter by faculty"
              title="Filter by faculty"
              style={{ minWidth: '160px' }}
            >
              <option value="All">All Faculties</option>
              {facultyOptions.map(f => (
                <option key={f.id || f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              className="btn"
              type="button"
              onClick={clearFilters}
              title="Clear all filters"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="ic"><Icon name="x" size={15} /></span>
              Clear Filters
            </button>
          )}

          {/* Result Count and Actions */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.86rem', color: 'var(--muted)', fontWeight: '600' }}>
              {hasActiveFilters
                ? `${filteredTasks.length} ${filteredTasks.length === 1 ? 'task' : 'tasks'} found (of ${tasks.length})`
                : `${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} total`}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading tasks...</div>
      ) : hasActiveFilters && filteredTasks.length === 0 ? (
        /* Helpful empty message when search / filter matches 0 tasks */
        <div className="card" style={{ padding: '48px 16px', textAlign: 'center' }}>
          <div className="ei" style={{ margin: '0 auto 12px' }}>
            <Icon name="search" size={26} />
          </div>
          <b style={{ fontSize: '1.05rem', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
            No tasks match
          </b>
          <span style={{ color: 'var(--muted)', display: 'block', maxWidth: '440px', margin: '0 auto 16px', fontSize: '0.9rem' }}>
            No tasks match your current search and faculty filter. Try adjusting your search query or clearing the filters.
          </span>
          <button className="btn" type="button" onClick={clearFilters}>
            <span className="ic"><Icon name="x" size={15} /></span>
            Clear Filters
          </button>
        </div>
      ) : (
        /* Kanban Columns: Pending, In Progress, Completed */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {['Pending', 'In Progress', 'Completed'].map(status => {
            const colTasks = filteredTasks.filter(t => t.status === status);
            return (
              <div 
                key={status} 
                style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#334155', fontWeight: '700' }}>{status}</h3>
                  <span style={{ 
                    fontSize: '0.78rem', 
                    fontWeight: '700', 
                    padding: '2px 8px', 
                    borderRadius: '10px', 
                    background: status === 'Completed' ? '#dcfce7' : status === 'In Progress' ? '#dbeafe' : '#fef3c7',
                    color: status === 'Completed' ? '#15803d' : status === 'In Progress' ? '#1d4ed8' : '#b45309'
                  }}>
                    {colTasks.length}
                  </span>
                </div>
                <div className="kanban-column" style={{ minHeight: '150px' }}>
                  {colTasks.map(renderTaskCard)}
                  {colTasks.length === 0 && (
                    <p className="muted" style={{ fontSize: '0.88rem', textAlign: 'center', padding: '2rem 1rem' }}>
                      {hasActiveFilters ? 'No matching tasks in this list.' : 'No tasks in this list. Drop tasks here.'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Modal (Create / Edit) */}
      {isModalOpen && (
        <div className="overlay" id="taskOverlay" onMouseDown={(e) => { if (e.target.id === 'taskOverlay') setIsModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <header>
              <div className="t">
                <h3>{editingTask ? 'Edit Task' : 'Assign Task'}</h3>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setIsModalOpen(false)}>
                <span className="ic"><Icon name="x" size={18} /></span>
              </button>
            </header>
            <div className="modal-body" style={{ maxHeight: 'calc(90vh - 70px)', overflowY: 'auto' }}>
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
