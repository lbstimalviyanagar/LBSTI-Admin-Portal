import React, { useState, useEffect } from 'react';
import Icon from '../components/Icons';
import api from '../services/api';
import ConfirmDialog from '../components/ConfirmDialog';
import ToastContainer from '../components/ToastContainer';
import { useToast } from '../hooks/useToast';
import { initials, avColor } from '../utils/helpers';

export default function UserManagementPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toasts, addToast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    role: 'counselor',
    password: '',
    profilePhotoUrl: ''
  });

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data || []);
    } catch (err) {
      addToast(err.message || 'Failed to load users', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        password: '', // Don't populate password
        profilePhotoUrl: user.profilePhotoUrl || ''
      });
    } else {
      setEditingUser(null);
      setFormData({
        username: '',
        fullName: '',
        role: 'counselor',
        password: '',
        profilePhotoUrl: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.fullName || !formData.role) {
      addToast("Please fill all required fields.", true);
      return;
    }
    if (!editingUser && !formData.password) {
      addToast("Password is required for new users.", true);
      return;
    }

    try {
      if (editingUser) {
        const patch = {
          fullName: formData.fullName,
          role: formData.role,
          profilePhotoUrl: formData.profilePhotoUrl || null
        };
        if (formData.password) patch.password = formData.password;
        
        await api.updateUser(editingUser.id, patch);
        addToast("User updated successfully.");
      } else {
        await api.createUser(formData);
        addToast("User created successfully.");
      }
      handleCloseModal();
      loadUsers();
    } catch (err) {
      addToast(err.message || "Failed to save user.", true);
    }
  };

  const handleDeleteUser = (id, name) => {
    if (String(id) === String(currentUser?.id)) {
      addToast("You cannot delete your own account.", true);
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: "Delete User",
      message: `Are you sure you want to delete the user account for ${name}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.deleteUser(id);
          addToast("User deleted successfully.");
          loadUsers();
        } catch (err) {
          addToast(err.message || "Failed to delete user.", true);
        } finally {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>User Management</h2>
          <p>Manage admin and counselor access to the portal.</p>
        </div>
        <button className="btn primary" onClick={() => handleOpenModal()}>
          <span className="ic"><Icon name="userPlus" size={18} /></span> Add User
        </button>
      </div>

      <div className="card section">
        <div className="tbl-scroll">
          <table className="mobile-table">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Username</th>
                <th scope="col">Role</th>
                <th scope="col">Created Date</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5">
                    <div className="skel" style={{ height: '160px' }} />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <div className="empty">
                      <b>No users found</b>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div className="person">
                        <span className="av" style={u.profilePhotoUrl ? { background: `url(${u.profilePhotoUrl}) center/cover no-repeat`, color: 'transparent' } : { background: avColor(u.fullName) }}>
                          {initials(u.fullName)}
                        </span>
                        <span><b>{u.fullName}</b></span>
                      </div>
                    </td>
                    <td>{u.username}</td>
                    <td>
                      <span className={`pill s-${u.role}`}>{u.role}</span>
                    </td>
                    <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="acts">
                        <button className="btn sm" onClick={() => handleOpenModal(u)}>
                          <Icon name="edit" size={15} /> Edit
                        </button>
                        <button 
                          className="btn sm danger icon" 
                          onClick={() => handleDeleteUser(u.id, u.fullName)}
                          disabled={String(u.id) === String(currentUser?.id)}
                          title={String(u.id) === String(currentUser?.id) ? "Cannot delete yourself" : "Delete user"}
                        >
                          <Icon name="trash" size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Form Modal */}
      {isModalOpen && (
        <div className="overlay" onMouseDown={(e) => e.target.className === 'overlay' && handleCloseModal()}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <header>
              <div className="t">
                <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
              </div>
              <button type="button" className="icon-btn" onClick={handleCloseModal}><Icon name="x" size={20} /></button>
            </header>
            <div className="form-body">
              <form id="user-form" onSubmit={handleSaveUser} className="fgrid">
                <div className="fld full">
                  <label>Full Name <em>*</em></label>
                  <input 
                    className="input" 
                    value={formData.fullName} 
                    onChange={e => setFormData({...formData, fullName: e.target.value})} 
                    required 
                  />
                </div>
                <div className="fld full">
                  <label>Username <em>*</em></label>
                  <input 
                    className="input" 
                    value={formData.username} 
                    onChange={e => setFormData({...formData, username: e.target.value})} 
                    disabled={!!editingUser}
                    required 
                  />
                  {editingUser && <small className="muted">Username cannot be changed.</small>}
                </div>
                <div className="fld full">
                  <label>Role <em>*</em></label>
                  <select 
                    className="select" 
                    value={formData.role} 
                    onChange={e => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="counselor">Counselor</option>
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                  </select>
                </div>
                <div className="fld full">
                  <label>Password {editingUser ? <small>(Leave blank to keep current)</small> : <em>*</em>}</label>
                  <input 
                    className="input" 
                    type="password"
                    value={formData.password} 
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required={!editingUser}
                  />
                </div>
                <div className="fld full">
                  <label>Profile Photo</label>
                  <input 
                    className="input" 
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const img = new Image();
                          img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_WIDTH = 200;
                            const MAX_HEIGHT = 200;
                            let width = img.width;
                            let height = img.height;
                            
                            if (width > height) {
                              if (width > MAX_WIDTH) {
                                height *= MAX_WIDTH / width;
                                width = MAX_WIDTH;
                              }
                            } else {
                              if (height > MAX_HEIGHT) {
                                width *= MAX_HEIGHT / height;
                                height = MAX_HEIGHT;
                              }
                            }
                            canvas.width = width;
                            canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            setFormData({...formData, profilePhotoUrl: canvas.toDataURL('image/jpeg', 0.85)});
                          };
                          img.src = ev.target.result;
                        };
                        reader.readAsDataURL(file);
                      }
                    }} 
                  />
                  {formData.profilePhotoUrl && (
                    <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={formData.profilePhotoUrl} style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }} alt="Profile Preview" />
                      <button type="button" className="btn sm danger" onClick={() => setFormData({...formData, profilePhotoUrl: ''})}>Remove Photo</button>
                    </div>
                  )}
                </div>
              </form>
            </div>
            <div className="form-actions">
              <button type="button" className="btn" onClick={handleCloseModal}>Cancel</button>
              <button className="btn primary" type="submit" form="user-form">
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        danger={true}
        confirmText="Delete"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
      
      <ToastContainer toasts={toasts} />
    </section>
  );
}
