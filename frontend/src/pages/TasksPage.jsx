import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';
import Icon from '../components/Icons';
import { getTimeLeft, formatDeadline } from '../utils/helpers';

export default function TasksPage({ user, users = [], students = [], onToast }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [filterOptions, setFilterOptions] = useState({ faculty: [], students: [] });
  const [activeTab, setActiveTab] = useState('all'); // 'all' or 'my_tasks'

  // Notifications modal & active alert state
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [notificationsList, setNotificationsList] = useState([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [checkingDeadlines, setCheckingDeadlines] = useState(false);

  // Real-time ticking clock for dynamic countdown recalculation
  const [nowTick, setNowTick] = useState(Date.now());

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
  // Role checks
  const userRole = String(user?.role || '').toLowerCase();
  const isFaculty = userRole === 'faculty' || userRole === 'teacher' || 
    String(user?.designation || '').toLowerCase().includes('faculty') || 
    String(user?.designation || '').toLowerCase().includes('teacher');
  const isFacultyOrAdmin = userRole === 'admin' || isFaculty;

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assigneeType: 'student', // 'student' or 'staff'
    assignedTo: '',
    assigneeName: '',
    assigneeEmail: '',
    assigneePhone: '',
    assigneeStudentId: '',
    submissionDeadline: '',
    status: 'Pending',
    remarks: ''
  });

  // Ticking timer: updates countdowns dynamically every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const loadTasks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getTasks();
      setTasks(data || []);
    } catch (err) {
      if (onToast && !silent) onToast(err.message || 'Failed to load tasks.', true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load filter options (faculty + students) from backend API on mount
  useEffect(() => {
    let isMounted = true;
    if (typeof api.getTaskFilterOptions === 'function') {
      api.getTaskFilterOptions()
        .then(res => {
          if (isMounted && res) {
            setFilterOptions(res);
          }
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, []);

  // Periodic automated deadline monitor trigger (runs in background every 60s)
  useEffect(() => {
    const monitorInterval = setInterval(() => {
      api.checkTaskDeadlines()
        .then(res => {
          if (res && res.triggeredCount > 0) {
            // Silently reload tasks to update alert flags & state
            loadTasks(true);
            if (onToast) {
              onToast(`Deadline alert: ${res.triggeredCount} notification(s) dispatched (In-App, Email, WhatsApp).`);
            }
          }
        })
        .catch(() => {});
    }, 60000);

    return () => clearInterval(monitorInterval);
  }, [loadTasks, onToast]);

  // Combined staff/faculty options
  const facultyOptions = useMemo(() => {
    const map = new Map();
    if (Array.isArray(filterOptions?.faculty)) {
      filterOptions.faculty.forEach(f => {
        const name = (f.name || f.fullName || f.username || '').trim();
        if (name) map.set(name.toLowerCase(), { id: f.id, name });
      });
    }
    if (Array.isArray(users)) {
      users.forEach(u => {
        const name = (u.fullName || u.full_name || u.username || '').trim();
        if (name) map.set(name.toLowerCase(), { id: u.id, name });
      });
    }
    tasks.forEach(t => {
      const name = (t.assigned_to_name || '').trim();
      if (name) map.set(name.toLowerCase(), { id: t.assigned_to, name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [tasks, users, filterOptions]);

  // Combined students options
  const studentOptions = useMemo(() => {
    const map = new Map();
    if (Array.isArray(students) && students.length > 0) {
      students.forEach(s => {
        const key = String(s.studentId || s.id);
        map.set(key, {
          id: s.id,
          studentId: s.studentId || `S-${s.id}`,
          name: s.name,
          phone: s.phone || '',
          email: s.email || '',
          course: s.course || ''
        });
      });
    }
    if (Array.isArray(filterOptions?.students)) {
      filterOptions.students.forEach(s => {
        const key = String(s.studentId || s.id);
        if (!map.has(key)) {
          map.set(key, {
            id: s.id,
            studentId: s.studentId,
            name: s.name,
            phone: s.phone || '',
            email: s.email || '',
            course: ''
          });
        }
      });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, [students, filterOptions]);

  // Detect urgent approaching and overdue tasks for in-app alert banner
  const { approachingTasks, overdueTasks } = useMemo(() => {
    const approaching = [];
    const overdue = [];

    tasks.forEach(t => {
      if (t.status === 'Submitted' || t.status === 'Completed' || !t.due_date) return;
      const tl = getTimeLeft(t.due_date, t.status);
      if (!tl) return;
      if (tl.isOverdue) {
        overdue.push({ task: t, timeLeft: tl });
      } else if (tl.isApproaching) {
        approaching.push({ task: t, timeLeft: tl });
      }
    });

    return { approachingTasks: approaching, overdueTasks: overdue };
  }, [tasks, nowTick]);

  // Detect whether any filter is active
  const hasActiveFilters = Boolean(searchQuery.trim() || facultyFilter !== 'All' || statusFilter !== 'All' || activeTab === 'my_tasks');

  // Filter tasks dynamically
  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return tasks.filter(task => {
      // 1. My tasks filter
      if (activeTab === 'my_tasks') {
        const currentUserId = String(user?.id || user?.sub || '');
        const isAssigned = String(task.assigned_to) === currentUserId ||
          String(task.assignee_student_id) === currentUserId ||
          String(task.assigned_to_name || '').toLowerCase() === String(user?.fullName || user?.username || '').toLowerCase();
        if (!isAssigned) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'All') {
        if (task.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      // 3. Faculty/Assignee Filter
      if (facultyFilter !== 'All') {
        const assignedName = (task.assigned_to_name || '').trim().toLowerCase();
        const selLower = facultyFilter.trim().toLowerCase();
        const matchesName = assignedName === selLower;
        const matchesId = String(task.assigned_to) === String(facultyFilter);
        if (!matchesName && !matchesId) return false;
      }

      // 4. Search query tokens
      if (tokens.length > 0) {
        const title = String(task.title || '').toLowerCase();
        const description = String(task.description || '').toLowerCase();
        const staff = String(task.assigned_to_name || '').toLowerCase();
        const dueDate = String(task.due_date || '').toLowerCase();
        const status = String(task.status || '').toLowerCase();
        const remarks = String(task.remarks || '').toLowerCase();
        const studentId = String(task.assignee_student_id || '').toLowerCase();
        const searchableText = `${title} ${description} ${staff} ${studentId} ${dueDate} ${status} ${remarks}`;

        const allTokensMatch = tokens.every(token => searchableText.includes(token));
        if (!allTokensMatch) return false;
      }

      return true;
    });
  }, [tasks, activeTab, statusFilter, facultyFilter, searchQuery, user]);

  const clearFilters = () => {
    setSearchQuery('');
    setFacultyFilter('All');
    setStatusFilter('All');
    setActiveTab('all');
  };

  // Convert MySQL DATETIME or ISO date to 'YYYY-MM-DDTHH:mm' for datetime-local input
  const toDateTimeLocal = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(String(dateStr).replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openNewTask = () => {
    setEditingTask(null);
    // Default deadline to today at 5:00 PM or 2 hours from now
    const defaultDate = new Date();
    defaultDate.setHours(17, 0, 0, 0);
    if (defaultDate <= new Date()) {
      defaultDate.setDate(defaultDate.getDate() + 1);
      defaultDate.setHours(11, 0, 0, 0);
    }
    const deadlineVal = toDateTimeLocal(defaultDate);

    setFormData({
      title: '',
      description: '',
      assigneeType: 'student',
      assignedTo: '',
      assigneeName: '',
      assigneeEmail: '',
      assigneePhone: '',
      assigneeStudentId: '',
      submissionDeadline: deadlineVal,
      status: 'Pending',
      remarks: ''
    });
    setIsModalOpen(true);
  };

  const openEditTask = (task) => {
    setEditingTask(task);
    const deadlineVal = toDateTimeLocal(task.due_date);

    setFormData({
      title: task.title,
      description: task.description || '',
      assigneeType: task.assignee_type || 'user',
      assignedTo: task.assigned_to,
      assigneeName: task.assignee_name || task.assigned_to_name || '',
      assigneeEmail: task.assignee_email || '',
      assigneePhone: task.assignee_phone || '',
      assigneeStudentId: task.assignee_student_id || '',
      submissionDeadline: deadlineVal,
      status: task.status || 'Pending',
      remarks: task.remarks || ''
    });
    setIsModalOpen(true);
  };

  const handleAssigneeChange = (e) => {
    const val = e.target.value;
    if (formData.assigneeType === 'student') {
      const match = studentOptions.find(s => String(s.id) === String(val) || String(s.studentId) === String(val));
      setFormData(prev => ({
        ...prev,
        assignedTo: val,
        assigneeName: match ? match.name : '',
        assigneeEmail: match ? match.email : '',
        assigneePhone: match ? match.phone : '',
        assigneeStudentId: match ? match.studentId : ''
      }));
    } else {
      const match = users.find(u => String(u.id) === String(val));
      setFormData(prev => ({
        ...prev,
        assignedTo: val,
        assigneeName: match ? (match.fullName || match.username) : '',
        assigneeEmail: match ? (match.email || '') : '',
        assigneePhone: match ? (match.phone || '') : '',
        assigneeStudentId: ''
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.submissionDeadline) {
      if (onToast) onToast('Please specify a Submission Deadline.', true);
      return;
    }

    try {
      const payload = {
        ...formData,
        dueDate: formData.submissionDeadline,
        submissionDeadline: formData.submissionDeadline
      };

      if (editingTask) {
        await api.updateTask(editingTask.id, payload);
        if (onToast) onToast('Task updated successfully.');
      } else {
        await api.createTask(payload);
        if (onToast) onToast('Task assigned successfully with automated deadline tracking.');
      }
      setIsModalOpen(false);
      loadTasks();
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to save task.', true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(id);
      if (onToast) onToast('Task deleted.');
      loadTasks();
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to delete task.', true);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      if (status === 'Submitted') {
        await api.submitTask(id, { status: 'Submitted' });
      } else {
        await api.updateTask(id, { status });
      }
      if (onToast) onToast(`Task marked as ${status}.`);
      loadTasks(true);
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to update status.', true);
    }
  };

  const handleManualCheckDeadlines = async () => {
    setCheckingDeadlines(true);
    try {
      const res = await api.checkTaskDeadlines();
      if (onToast) {
        onToast(`Deadline check complete. Dispatched ${res?.triggeredCount || 0} alert(s).`);
      }
      loadTasks(true);
    } catch (err) {
      if (onToast) onToast(err.message || 'Failed to run deadline check.', true);
    } finally {
      setCheckingDeadlines(false);
    }
  };

  const openNotificationsLog = async (taskId = null) => {
    setIsNotifModalOpen(true);
    setLoadingNotifs(true);
    try {
      const list = await api.getTaskNotifications(taskId);
      setNotificationsList(Array.isArray(list) ? list : []);
    } catch (err) {
      if (onToast) onToast('Failed to load notifications history.', true);
    } finally {
      setLoadingNotifs(false);
    }
  };

  // Direct WhatsApp Web Reminder dispatch
  const handleSendWhatsAppReminder = (task) => {
    const phone = task.assignee_phone;
    if (!phone) {
      if (onToast) onToast('No phone number recorded for this assignee.', true);
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const recipientPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const name = task.assigned_to_name || task.assignee_name || 'Student';
    const deadlineStr = formatDeadline(task.due_date);
    const tl = getTimeLeft(task.due_date, task.status);
    const timeLeftText = tl ? tl.text : 'soon';

    const msg = `Hello *${name}*,\nThis is a friendly reminder regarding your assigned task *"${task.title}"*.\n\n` +
      `📅 *Deadline:* ${deadlineStr}\n` +
      `⏳ *Status:* ${task.status} (${timeLeftText})\n\n` +
      `Please ensure your completed task is submitted through the portal on time.\n\n` +
      `_Lal Bahadur Shastri Training Institute (LBSTI)_`;

    const url = `https://wa.me/${recipientPhone}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (onToast) onToast(`Opening WhatsApp chat for ${name}...`);
  };

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData('taskId', id);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      const task = tasks.find(t => t.id.toString() === taskId);
      if (task && task.status !== newStatus) {
        setTasks(prev => prev.map(t => t.id.toString() === taskId ? { ...t, status: newStatus } : t));
        updateStatus(taskId, newStatus);
      }
    }
  };

  const renderTaskCard = (task) => {
    const assignedName = task.assigned_to_name || task.assignee_name || 'Assignee';
    const avatarUrl = task.assigned_to_photo;
    const isStudent = task.assignee_type === 'student' || Boolean(task.assignee_student_id);

    // Dynamic Time Left Countdown
    const tl = getTimeLeft(task.due_date, task.status);

    // Color badges: Green (plenty of time), Orange/Yellow (due within 24h), Red (overdue)
    const badgeStyles = {
      green: {
        background: '#ecfdf5',
        color: '#047857',
        border: '1px solid #a7f3d0'
      },
      orange: {
        background: '#fffbeb',
        color: '#b45309',
        border: '1px solid #fde68a'
      },
      red: {
        background: '#fef2f2',
        color: '#b91c1c',
        border: '1px solid #fecaca'
      }
    };

    const activeBadgeStyle = tl ? badgeStyles[tl.color] || badgeStyles.green : null;

    // Card border accent based on status
    const cardBorderColor = 
      task.status === 'Completed' ? '#10b981' :
      task.status === 'Submitted' ? '#059669' :
      task.status === 'In Progress' ? '#3b82f6' :
      (tl && tl.isOverdue) ? '#ef4444' : '#f59e0b';

    return (
      <div 
        key={task.id} 
        className="card task-kanban-card" 
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        style={{ 
          padding: '1rem', 
          marginBottom: '1rem', 
          cursor: 'grab', 
          borderLeft: `4px solid ${cardBorderColor}`,
          position: 'relative',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease'
        }}
      >
        {/* Header: Title and Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.98rem', fontWeight: 600, color: '#1e293b' }}>
              {task.title}
            </h4>

            {/* Dynamic Time Left Countdown Badge */}
            {tl && (
              <span 
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  ...activeBadgeStyle
                }}
                title={`Due: ${formatDeadline(task.due_date)}`}
              >
                <Icon name={tl.isOverdue ? 'alert' : 'calendar'} size={12} />
                <span>{tl.text}</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {/* Quick WhatsApp Reminder */}
            {task.assignee_phone && (
              <button 
                className="btn icon-btn" 
                onClick={() => handleSendWhatsAppReminder(task)} 
                title={`Send WhatsApp Reminder (${task.assignee_phone})`}
                style={{ color: '#25D366' }}
              >
                <Icon name="whatsapp" size={14} />
              </button>
            )}

            {/* Edit Button (Accessible to Faculty & Admin) */}
            {isFacultyOrAdmin && (
              <button 
                className="btn icon-btn" 
                onClick={() => openEditTask(task)} 
                title="Edit Task & Deadline"
              >
                <Icon name="edit" size={14} />
              </button>
            )}

            {/* Delete Button (Accessible to Admin & Creator) */}
            {isFacultyOrAdmin && (
              <button 
                className="btn icon-btn" 
                onClick={() => handleDelete(task.id)} 
                title="Delete Task"
                style={{ color: '#dc2626' }}
              >
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Task Description */}
        {task.description && (
          <p style={{ margin: '0.5rem 0 0.6rem 0', fontSize: '0.86rem', color: '#64748b', lineHeight: 1.45 }}>
            {task.description}
          </p>
        )}

        {/* Deadline and Assignee Meta */}
        <div style={{ 
          marginTop: '0.5rem', 
          paddingTop: '0.5rem', 
          borderTop: '1px solid #f1f5f9',
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          fontSize: '0.78rem', 
          color: '#64748b',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          {/* Submission Deadline Display */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontWeight: 600, color: '#475569' }}>Deadline:</span>
            <span style={{ color: tl?.isOverdue ? '#dc2626' : '#1e293b', fontWeight: tl?.isOverdue ? 700 : 500 }}>
              {formatDeadline(task.due_date)}
            </span>
          </div>

          {/* Assignee Avatar & Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={assignedName} 
                style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              <span style={{ 
                width: '20px', 
                height: '20px', 
                borderRadius: '50%', 
                background: isStudent ? '#e0e7ff' : '#cbd5e1', 
                color: isStudent ? '#4338ca' : '#334155', 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: '0.66rem', 
                fontWeight: '700'
              }}>
                {assignedName ? assignedName.charAt(0).toUpperCase() : '?'}
              </span>
            )}
            <span>
              {isStudent && <small style={{ color: '#6366f1', fontWeight: 600, marginRight: '3px' }}>[Student]</small>}
              <strong>{assignedName}</strong>
            </span>
          </div>
        </div>

        {/* Remarks / Submission notes */}
        {(task.remarks || task.submission_notes) && (
          <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.8rem', color: '#475569' }}>
            <strong>Remarks:</strong> {task.remarks || task.submission_notes}
          </div>
        )}

        {/* Action Buttons: Status Updates */}
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {task.status !== 'Pending' && (
            <button className="btn sm" type="button" onClick={() => updateStatus(task.id, 'Pending')}>
              Set Pending
            </button>
          )}
          {task.status !== 'In Progress' && (
            <button className="btn sm" type="button" onClick={() => updateStatus(task.id, 'In Progress')}>
              Set In Progress
            </button>
          )}
          {task.status !== 'Submitted' && (
            <button 
              className="btn sm" 
              type="button" 
              onClick={() => updateStatus(task.id, 'Submitted')}
              style={{ background: '#dcfce7', color: '#15803d', borderColor: '#86efac', fontWeight: 600 }}
              title="Mark as Submitted to stop overdue alerts"
            >
              ✓ Mark Submitted
            </button>
          )}
          {task.status !== 'Completed' && (
            <button className="btn sm" type="button" onClick={() => updateStatus(task.id, 'Completed')}>
              Set Completed
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page-section">
      {/* Page Header */}
      <div className="page-head">
        <div>
          <h2>Task Management & Deadlines</h2>
          <p>Assign tasks, monitor real-time submission countdowns, and trigger automated deadline alerts.</p>
        </div>

        <div className="controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Notification History Button */}
          <button 
            className="btn" 
            type="button" 
            onClick={() => openNotificationsLog()} 
            title="View alert dispatch logs (In-App, Email, WhatsApp)"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="bell" size={16} />
            <span>Alerts Log</span>
          </button>

          {/* Manual Deadline Monitor Trigger */}
          <button 
            className="btn" 
            type="button" 
            onClick={handleManualCheckDeadlines} 
            disabled={checkingDeadlines}
            title="Manually trigger deadline checking for approaching & overdue tasks"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="refresh" size={15} />
            <span>{checkingDeadlines ? 'Checking...' : 'Check Deadlines'}</span>
          </button>

          {/* Assign Task Button - Accessible to Faculty & Admins */}
          {isFacultyOrAdmin && (
            <button className="btn btn-primary" onClick={openNewTask} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <span className="ic"><Icon name="plus" size={16} /></span>
              Assign Task
            </button>
          )}
        </div>
      </div>

      {/* Automated In-App Alert Banners */}
      {overdueTasks.length > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '12px 16px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          color: '#991b1b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#dc2626' }}><Icon name="alert" size={20} /></span>
            <div>
              <strong style={{ fontSize: '0.92rem' }}>Overdue Task Alert ({overdueTasks.length})</strong>
              <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                {overdueTasks.slice(0, 3).map((o, idx) => (
                  <span key={o.task.id}>
                    {idx > 0 && ' | '}
                    <strong>{o.task.title}</strong> ({o.timeLeft.text})
                  </span>
                ))}
                {overdueTasks.length > 3 && ` and ${overdueTasks.length - 3} more`}
              </div>
            </div>
          </div>
          <button className="btn sm danger" onClick={() => setStatusFilter('Pending')}>
            View Overdue Tasks
          </button>
        </div>
      )}

      {approachingTasks.length > 0 && (
        <div style={{
          marginBottom: '1rem',
          padding: '12px 16px',
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '8px',
          color: '#92400e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ color: '#d97706' }}><Icon name="calendar" size={20} /></span>
            <div>
              <strong style={{ fontSize: '0.92rem' }}>Approaching Submission Deadlines ({approachingTasks.length})</strong>
              <div style={{ fontSize: '0.84rem', marginTop: '2px' }}>
                {approachingTasks.slice(0, 3).map((a, idx) => (
                  <span key={a.task.id}>
                    {idx > 0 && ' | '}
                    <strong>{a.task.title}</strong> ({a.timeLeft.text})
                  </span>
                ))}
                {approachingTasks.length > 3 && ` and ${approachingTasks.length - 3} more`}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#b45309' }}>
            Automated alerts active (In-App, Email, WhatsApp)
          </span>
        </div>
      )}

      {/* Dynamic Search & Filtering Toolbar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Tab Toggle: All Tasks vs My Tasks */}
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
            <button
              type="button"
              className={`btn sm ${activeTab === 'all' ? 'primary' : ''}`}
              onClick={() => setActiveTab('all')}
              style={{ padding: '4px 10px', fontSize: '0.82rem' }}
            >
              All Tasks
            </button>
            <button
              type="button"
              className={`btn sm ${activeTab === 'my_tasks' ? 'primary' : ''}`}
              onClick={() => setActiveTab('my_tasks')}
              style={{ padding: '4px 10px', fontSize: '0.82rem' }}
            >
              My Assigned Tasks
            </button>
          </div>

          {/* Search Bar */}
          <div className="search" style={{ minWidth: '220px', flex: '1 1 240px' }}>
            <span className="si"><Icon name="search" size={18} /></span>
            <input
              className="input"
              type="search"
              placeholder="Search title, description, staff, student, date..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              aria-label="Search tasks"
            />
          </div>

          {/* Assignee / Faculty Dropdown Filter */}
          <div className="fl">
            <select
              className="select"
              value={facultyFilter}
              onChange={(e) => setFacultyFilter(e.target.value)}
              aria-label="Filter by faculty or assignee"
              title="Filter by faculty or assignee"
              style={{ minWidth: '160px' }}
            >
              <option value="All">All Assignees</option>
              {facultyOptions.map(f => (
                <option key={f.id || f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="fl">
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              title="Filter by status"
              style={{ minWidth: '130px' }}
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Submitted">Submitted</option>
              <option value="Completed">Completed</option>
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
              Clear
            </button>
          )}

          {/* Result Count */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '0.86rem', color: 'var(--muted)', fontWeight: '600' }}>
              {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} found
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>Loading tasks and deadlines...</div>
      ) : hasActiveFilters && filteredTasks.length === 0 ? (
        <div className="card" style={{ padding: '48px 16px', textAlign: 'center' }}>
          <div className="ei" style={{ margin: '0 auto 12px' }}>
            <Icon name="search" size={26} />
          </div>
          <b style={{ fontSize: '1.05rem', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>
            No tasks match
          </b>
          <span style={{ color: 'var(--muted)', display: 'block', maxWidth: '440px', margin: '0 auto 16px', fontSize: '0.9rem' }}>
            No tasks match your current search and filter criteria. Try adjusting your query or resetting filters.
          </span>
          <button className="btn" type="button" onClick={clearFilters}>
            <span className="ic"><Icon name="x" size={15} /></span>
            Clear Filters
          </button>
        </div>
      ) : (
        /* Kanban Columns: Pending, In Progress, Submitted, Completed */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {[
            { key: 'Pending', label: 'Pending', bg: '#fef3c7', col: '#b45309' },
            { key: 'In Progress', label: 'In Progress', bg: '#dbeafe', col: '#1d4ed8' },
            { key: 'Submitted', label: 'Submitted', bg: '#dcfce7', col: '#15803d' },
            { key: 'Completed', label: 'Completed', bg: '#f1f5f9', col: '#475569' }
          ].map(col => {
            const colTasks = filteredTasks.filter(t => (t.status || 'Pending') === col.key);
            return (
              <div 
                key={col.key} 
                style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#334155', fontWeight: '700' }}>{col.label}</h3>
                  <span style={{ 
                    fontSize: '0.78rem', 
                    fontWeight: '700', 
                    padding: '2px 8px', 
                    borderRadius: '10px', 
                    background: col.bg,
                    color: col.col
                  }}>
                    {colTasks.length}
                  </span>
                </div>
                <div className="kanban-column" style={{ minHeight: '150px' }}>
                  {colTasks.map(renderTaskCard)}
                  {colTasks.length === 0 && (
                    <p className="muted" style={{ fontSize: '0.86rem', textAlign: 'center', padding: '2rem 1rem' }}>
                      {hasActiveFilters ? 'No tasks in this list.' : 'Drop tasks here.'}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Assignment / Edit Modal */}
      {isModalOpen && (
        <div className="overlay" id="taskOverlay" onMouseDown={(e) => { if (e.target.id === 'taskOverlay') setIsModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '540px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <header>
              <div className="t">
                <h3>{editingTask ? 'Edit Task' : 'Assign Task'}</h3>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setIsModalOpen(false)}>
                <span className="ic"><Icon name="x" size={18} /></span>
              </button>
            </header>

            <div className="modal-body" style={{ maxHeight: 'calc(92vh - 70px)', overflowY: 'auto' }}>
              <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Title */}
                <div className="fld">
                  <label htmlFor="task-title">Task Title <em>*</em></label>
                  <input 
                    id="task-title"
                    required 
                    className="input" 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})} 
                    placeholder="e.g. Lab Exercise 4: React Components"
                    disabled={!isFacultyOrAdmin && !editingTask} 
                  />
                </div>

                {/* Description */}
                <div className="fld">
                  <label htmlFor="task-description">Description / Instructions</label>
                  <textarea 
                    id="task-description"
                    className="textarea" 
                    rows={3}
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})} 
                    placeholder="Detailed task instructions, submission guidelines..."
                    disabled={!isFacultyOrAdmin && !editingTask} 
                  />
                </div>

                {isFacultyOrAdmin && (
                  <>
                    {/* Assignee Type Selector: Student or Staff */}
                    <div className="fld">
                      <label>Assign To Type <em>*</em></label>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '4px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
                          <input 
                            type="radio" 
                            name="assigneeType" 
                            value="student" 
                            checked={formData.assigneeType === 'student'} 
                            onChange={() => setFormData({...formData, assigneeType: 'student', assignedTo: '', assigneeName: '', assigneeEmail: '', assigneePhone: '', assigneeStudentId: ''})} 
                          />
                          <span>Student</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
                          <input 
                            type="radio" 
                            name="assigneeType" 
                            value="staff" 
                            checked={formData.assigneeType === 'staff'} 
                            onChange={() => setFormData({...formData, assigneeType: 'staff', assignedTo: '', assigneeName: '', assigneeEmail: '', assigneePhone: '', assigneeStudentId: ''})} 
                          />
                          <span>Faculty / Staff</span>
                        </label>
                      </div>
                    </div>

                    {/* Assignee Dropdown */}
                    <div className="fld">
                      <label htmlFor="task-assigned-to">
                        Assignee ({formData.assigneeType === 'student' ? 'Student' : 'Staff'}) <em>*</em>
                      </label>
                      {formData.assigneeType === 'student' ? (
                        <select 
                          id="task-assigned-to"
                          required 
                          className="select" 
                          value={formData.assignedTo} 
                          onChange={handleAssigneeChange}
                        >
                          <option value="">-- Select Enrolled Student --</option>
                          {studentOptions.map(s => (
                            <option key={s.studentId || s.id} value={s.id || s.studentId}>
                              {s.name} ({s.studentId || `ID: ${s.id}`}) {s.course ? `- ${s.course}` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <select 
                          id="task-assigned-to"
                          required 
                          className="select" 
                          value={formData.assignedTo} 
                          onChange={handleAssigneeChange}
                        >
                          <option value="">-- Select Staff / Faculty Member --</option>
                          {users?.map(u => (
                            <option key={u.id} value={u.id}>
                              {u.fullName || u.full_name || u.username} ({u.role || 'Staff'})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Automated Notification Details (Read-only verification) */}
                    {(formData.assigneePhone || formData.assigneeEmail) && (
                      <div style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.8rem', color: '#475569' }}>
                        <div><strong>Automated Alerts Destination:</strong></div>
                        {formData.assigneePhone && <div>• WhatsApp Webhook: <strong>{formData.assigneePhone}</strong></div>}
                        {formData.assigneeEmail && <div>• Notification Email: <strong>{formData.assigneeEmail}</strong></div>}
                      </div>
                    )}

                    {/* Exact Submission Deadline Field (datetime-local) */}
                    <div className="fld">
                      <label htmlFor="task-submission-deadline">
                        Submission Deadline <em>*</em>
                      </label>
                      <input 
                        id="task-submission-deadline"
                        type="datetime-local" 
                        required 
                        className="input" 
                        value={formData.submissionDeadline} 
                        onChange={e => setFormData({...formData, submissionDeadline: e.target.value})} 
                      />
                      <small style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '4px' }}>
                        Set the exact date and time (e.g. Today at 11:00 AM). Automated reminders trigger 2 hours prior and when overdue.
                      </small>
                    </div>
                  </>
                )}

                {/* Status & Remarks */}
                <div className="fgrid" style={{ gap: '12px' }}>
                  <div className="fld">
                    <label htmlFor="task-status">Status</label>
                    <select 
                      id="task-status"
                      className="select" 
                      value={formData.status} 
                      onChange={e => setFormData({...formData, status: e.target.value})}
                    >
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Submitted">Submitted</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>

                  <div className="fld">
                    <label htmlFor="task-remarks">Remarks / Submission Notes</label>
                    <input 
                      id="task-remarks"
                      className="input" 
                      placeholder="Optional remarks or notes..."
                      value={formData.remarks} 
                      onChange={e => setFormData({...formData, remarks: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="form-foot" style={{ marginTop: '1rem', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn primary">Save Task</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Notifications & Alert History Modal */}
      {isNotifModalOpen && (
        <div className="overlay" id="notifOverlay" onMouseDown={(e) => { if (e.target.id === 'notifOverlay') setIsNotifModalOpen(false); }}>
          <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: '650px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <header>
              <div className="t">
                <h3>Automated Deadline Alerts Log</h3>
              </div>
              <button className="icon-btn" type="button" aria-label="Close" onClick={() => setIsNotifModalOpen(false)}>
                <span className="ic"><Icon name="x" size={18} /></span>
              </button>
            </header>
            <div className="modal-body" style={{ maxHeight: 'calc(90vh - 70px)', overflowY: 'auto', padding: '1rem' }}>
              <p style={{ margin: '0 0 1rem 0', fontSize: '0.86rem', color: '#64748b' }}>
                Real-time delivery log of approaching deadline reminders and overdue notices dispatched via In-App alerts, Email, and WhatsApp Business API webhooks.
              </p>

              {loadingNotifs ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Loading notification history...</div>
              ) : notificationsList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
                  No automated notifications dispatched yet. Active deadlines will appear here when triggered.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notificationsList.map(n => {
                    const channelColors = {
                      in_app: { bg: '#e0e7ff', text: '#4338ca', label: 'In-App Alert' },
                      email: { bg: '#fef3c7', text: '#b45309', label: 'Automated Email' },
                      whatsapp: { bg: '#dcfce7', text: '#15803d', label: 'WhatsApp Webhook' }
                    };
                    const ch = channelColors[n.channel] || channelColors.in_app;

                    return (
                      <div key={n.id} style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: ch.bg, color: ch.text }}>
                            {ch.label}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            {n.created_at || 'Just now'}
                          </span>
                        </div>
                        <strong style={{ fontSize: '0.9rem', color: '#1e293b', display: 'block', margin: '4px 0 2px' }}>
                          {n.title}
                        </strong>
                        <p style={{ margin: '0 0 6px', fontSize: '0.84rem', color: '#475569' }}>
                          {n.message}
                        </p>
                        <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', gap: '12px' }}>
                          <span><strong>Recipient:</strong> {n.recipient_name || 'Assignee'}</span>
                          {n.recipient_phone && <span><strong>Phone:</strong> {n.recipient_phone}</span>}
                          {n.recipient_email && <span><strong>Email:</strong> {n.recipient_email}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
