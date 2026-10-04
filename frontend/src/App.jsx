import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import DashboardPage from './pages/DashboardPage';
import NewEnquiryPage from './pages/NewEnquiryPage';
import EnquiriesPage from './pages/EnquiriesPage';
import PaymentsPage from './pages/PaymentsPage';
import StudentsPage from './pages/StudentsPage';
import LoginPage from './pages/LoginPage';
import UserManagementPage from './pages/UserManagementPage';
import AttendancePage from './pages/AttendancePage';
import TasksPage from './pages/TasksPage';
import BatchesPage from './pages/BatchesPage';
import EditLeadModal from './components/EditLeadModal';
import ConfirmDialog from './components/ConfirmDialog';
import DailyReminder from './components/DailyReminder';
import ToastContainer from './components/ToastContainer';
import Icon from './components/Icons';
import { useAuth } from './hooks/useAuth';
import { useToast } from './hooks/useToast';
import api from './services/api';
import { COUNSELORS, ORG, WHATSAPP_NUMBER } from './utils/helpers';

export default function App() {
  const { user, setUser, loading: authLoading, logout } = useAuth();
  const { toasts, addToast } = useToast();

  const [enquiries, setEnquiries] = useState([]);
  const [fees, setFees] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Navigation & View state
  const [tab, setTab] = useState('dashboard'); // 'dashboard' | 'new' | 'table' | 'payments' | 'students'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Dashboard time range filter
  const [dashRangeKind, setDashRangeKind] = useState('all');
  const [dashFrom, setDashFrom] = useState('');
  const [dashTo, setDashTo] = useState('');

  // Table filter & pagination state
  const [filterParams, setFilterParams] = useState({
    q: '',
    course: 'All',
    source: 'All',
    counselor: 'All',
    status: 'All',
    dateKind: 'all',
    from: '',
    to: '',
    sort: { key: 'createdAt', dir: 'desc' },
    page: 1,
    size: 10
  });

  // Modals & Dialogs
  const [editLeadId, setEditLeadId] = useState(null);
  const [confirmDialogState, setConfirmDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    danger: false,
    success: false,
    onConfirm: () => {}
  });

  // Fetch initial data
  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setLoadError('');
    try {
      const [enquiryList, feeList, studentList, enrollmentList, usersRes] = await Promise.all([
        api.getEnquiries(),
        api.getFees().catch(() => []),
        api.getStudents().catch(() => []),
        api.getEnrollments().catch(() => []),
        api.getUsers().catch(() => [])
      ]);
      setEnquiries(enquiryList || []);
      setFees(feeList || []);
      setStudents(studentList || []);
      setEnrollments(enrollmentList || []);
      setUsersList(usersRes || []);
    } catch (err) {
      console.error(err);
      if (err.code === 401) {
        logout();
      } else {
        setLoadError(err.message || "Couldn't load data from the server.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [logout]);

  // Load data whenever user signs in
  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  // Handle Logout
  const handleLogout = () => {
    logout();
    setEnquiries([]);
    setFees([]);
    setStudents([]);
    setEnrollments([]);
    addToast("Logged out successfully");
  };

  // Create Enquiry Handler
  const handleCreateEnquiry = async (data) => {
    try {
      const created = await api.createEnquiry(data);
      if (created) {
        setEnquiries(prev => [created, ...prev]);
      } else {
        await loadData(true);
      }
      addToast("Lead added successfully.");
      setTab('table');
    } catch (err) {
      addToast(err.message || "Failed to create lead.", true);
      throw err;
    }
  };

  // Update Enquiry Handler
  const handleUpdateEnquiry = async (id, patch) => {
    try {
      const updated = await api.updateEnquiry(id, patch);
      setEnquiries(prev => prev.map(e => (String(e.id) === String(id) ? { ...e, ...patch, ...updated } : e)));
      addToast("Lead updated successfully.");
      setEditLeadId(null);
    } catch (err) {
      addToast(err.message || "Failed to update lead.", true);
      throw err;
    }
  };

  // Delete Enquiry Handler
  const handleDeleteEnquiry = (id) => {
    const lead = enquiries.find(e => String(e.id) === String(id));
    setConfirmDialogState({
      isOpen: true,
      title: "Delete this lead?",
      message: `This permanently removes ${lead?.name || 'this lead'} and all associated notes and fees.`,
      confirmText: "Delete lead",
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteEnquiry(id);
          setEnquiries(prev => prev.filter(e => String(e.id) !== String(id)));
          setFees(prev => prev.filter(f => String(f.enquiryId) !== String(id)));
          setEditLeadId(null);
          addToast("Lead deleted successfully.");
        } catch (err) {
          addToast(err.message || "Failed to delete lead.", true);
        } finally {
          setConfirmDialogState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Confirm Admission Handler
  const handleConfirmAdmission = (id) => {
    const lead = enquiries.find(e => String(e.id) === String(id));
    if (!lead || lead.status === "Confirmed") return;

    setConfirmDialogState({
      isOpen: true,
      title: "Confirm admission?",
      message: `${lead.name || 'This student'} will be marked as Confirmed. Use this only after the admission is confirmed.`,
      confirmText: "Confirm admission",
      success: true,
      onConfirm: async () => {
        try {
          await api.confirmEnquiry(id);
          setEnquiries(prev => prev.map(e => (String(e.id) === String(id) ? { ...e, status: "Confirmed" } : e)));
          addToast(`Admission confirmed for ${lead.name || 'student'}`);
        } catch (err) {
          addToast(err.message || "Failed to confirm admission.", true);
        } finally {
          setConfirmDialogState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Save Fee Payment Handler
  const handleSavePayment = async (payload) => {
    try {
      const created = await api.createFee(payload);
      if (created) {
        setFees(prev => [created, ...prev]);
      } else {
        const freshFees = await api.getFees();
        setFees(freshFees || []);
      }
      addToast("Fee payment recorded successfully.");
    } catch (err) {
      addToast(err.message || "Failed to record payment.", true);
      throw err;
    }
  };

  // Delete Fee Payment Handler
  const handleDeletePayment = (id) => {
    setConfirmDialogState({
      isOpen: true,
      title: "Delete this payment?",
      message: "This removes the fee payment record permanently.",
      confirmText: "Delete payment",
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteFee(id);
          setFees(prev => prev.filter(f => String(f.id) !== String(id)));
          addToast("Payment record deleted.");
        } catch (err) {
          addToast(err.message || "Failed to delete payment.", true);
        } finally {
          setConfirmDialogState(prev => ({ ...prev, isOpen: false }));
        }
      }
    });
  };

  // Drill into table from charts
  const handleDrillIntoTable = (patch) => {
    setFilterParams(prev => ({
      ...prev,
      q: '',
      course: 'All',
      source: 'All',
      counselor: 'All',
      status: 'All',
      dateKind: dashRangeKind,
      from: dashFrom,
      to: dashTo,
      page: 1,
      ...patch
    }));
    setTab('table');
    if (Object.keys(patch).length > 0) {
      addToast(`Filtered by ${Object.values(patch)[0]}`);
    }
  };

  // Build list of counselors dynamically from assignments + defaults
  const counselorList = Array.from(
    new Set([...COUNSELORS, ...enquiries.map(e => e.assignedTo).filter(Boolean), user?.name].filter(Boolean))
  ).sort();

  const activeLeadToEdit = editLeadId ? enquiries.find(e => String(e.id) === String(editLeadId)) : null;

  if (authLoading) {
    return (
      <div className="boot-splash">
        <div className="spinner" />
        <p>Loading Admin Portal…</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoginSuccess={(loggedInUser) => setUser(loggedInUser)} />;
  }

  return (
    <div id="app" className={`${sidebarCollapsed ? 'collapsed' : ''} ${mobileNavOpen ? 'nav-open' : ''}`}>
      {/* Sidebar */}
      <Sidebar
        user={user}
        tab={tab}
        setTab={setTab}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onNavClick={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="main">
        <Topbar
          user={user}
          enquiries={enquiries}
          onOpenEdit={(id) => setEditLeadId(id)}
          collapsed={sidebarCollapsed}
          onToggleSidebar={() => {
            setSidebarCollapsed(!sidebarCollapsed);
            setMobileNavOpen(!mobileNavOpen);
          }}
        />

        <div className="content">
          {/* Header & Controls for Enquiries section */}
          {(tab === 'dashboard' || tab === 'new' || tab === 'table') && (
            <div className="page-head">
              <div>
                <h2>Enquiries Management</h2>
                <p>Track and manage student leads and view analytics.</p>
              </div>

              {tab === 'dashboard' && (
                <div className="controls">
                  <label className="sr-only" htmlFor="range">Time range</label>
                  <select
                    className="select"
                    id="range"
                    value={dashRangeKind}
                    onChange={(e) => setDashRangeKind(e.target.value)}
                  >
                    <option value="all">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="lastmonth">Last Month</option>
                    <option value="custom">Custom Range</option>
                  </select>

                  {dashRangeKind === 'custom' && (
                    <div className="custom-range">
                      <input
                        className="input"
                        type="date"
                        value={dashFrom}
                        onChange={(e) => setDashFrom(e.target.value)}
                      />
                      <span className="muted">to</span>
                      <input
                        className="input"
                        type="date"
                        value={dashTo}
                        onChange={(e) => setDashTo(e.target.value)}
                      />
                    </div>
                  )}

                  <button
                    className="btn"
                    type="button"
                    onClick={() => loadData(false)}
                  >
                    <span className={`ic ${loading ? 'spin' : ''}`}><Icon name="refresh" size={18} /></span>
                    Refresh
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Enquiries Sub Tabs */}
          {(tab === 'dashboard' || tab === 'new' || tab === 'table') && (
            <div className="tabs" role="tablist" aria-label="Enquiries sections">
              <button
                className="tab"
                role="tab"
                aria-selected={tab === 'dashboard'}
                onClick={() => setTab('dashboard')}
              >
                <span className="ic"><Icon name="dashboard" size={18} /></span>
                Dashboard
              </button>
              <button
                className="tab"
                role="tab"
                aria-selected={tab === 'new'}
                onClick={() => setTab('new')}
              >
                <span className="ic"><Icon name="plus" size={18} /></span>
                New Enquiry
              </button>
              <button
                className="tab"
                role="tab"
                aria-selected={tab === 'table'}
                onClick={() => setTab('table')}
              >
                <span className="ic"><Icon name="table" size={18} /></span>
                Enquiries Table
                <span className="count"> ({enquiries.length})</span>
              </button>
            </div>
          )}

          {/* Error Banner */}
          {loadError && (tab === 'dashboard' || tab === 'new' || tab === 'table') && (
            <div className="banner" role="alert">
              <div>
                <b>Couldn't load data from server</b>
                <span>{loadError}</span>
              </div>
              <button className="btn" type="button" onClick={() => loadData(false)}>
                Try again
              </button>
            </div>
          )}

          {/* Page Routing */}
          {tab === 'dashboard' && (
            <DashboardPage
              enquiries={enquiries}
              loading={loading}
              dashRangeKind={dashRangeKind}
              dashFrom={dashFrom}
              dashTo={dashTo}
              onOpenEdit={(id) => setEditLeadId(id)}
              onConfirmAdmission={handleConfirmAdmission}
              onDrillIntoTable={handleDrillIntoTable}
              onGoToNewLead={() => setTab('new')}
            />
          )}

          {tab === 'new' && (
            <NewEnquiryPage
              counselorList={counselorList}
              onSubmit={handleCreateEnquiry}
              onCancel={() => setTab('dashboard')}
            />
          )}

          {tab === 'table' && (
            <EnquiriesPage
              enquiries={enquiries}
              loading={loading}
              counselorList={counselorList}
              filterParams={filterParams}
              setFilterParams={setFilterParams}
              onOpenEdit={(id) => setEditLeadId(id)}
              onConfirmAdmission={handleConfirmAdmission}
              onRefresh={() => loadData(false)}
              onGoToNewLead={() => setTab('new')}
              onToast={addToast}
            />
          )}

          {tab === 'payments' && (
            <PaymentsPage
              fees={fees}
              enquiries={enquiries}
              students={students}
              loading={loading}
              onSavePayment={handleSavePayment}
              onDeletePayment={handleDeletePayment}
              onToast={addToast}
            />
          )}

          {tab === 'students' && (
            <StudentsPage
              students={students}
              enrollments={enrollments}
              loading={loading}
              onRefresh={loadData}
            />
          )}

          {tab === 'attendance' && (
            <AttendancePage
              user={user}
              onToast={addToast}
            />
          )}

          {tab === 'tasks' && (
            <TasksPage
              user={user}
              users={usersList}
              onToast={addToast}
            />
          )}

          {tab === 'batches' && (
            <BatchesPage
              user={user}
              users={usersList}
              onToast={addToast}
            />
          )}

          {tab === 'users' && (
            <UserManagementPage currentUser={user} onUpdateUser={setUser} />
          )}
        </div>

        {/* Site Footer */}
        <footer className="site-footer">
          © {new Date().getFullYear()} {ORG.fullName} | {ORG.domain}
        </footer>
      </div>

      {/* Mobile nav backdrop */}
      {mobileNavOpen && (
        <div className="backdrop" onClick={() => setMobileNavOpen(false)} />
      )}

      {/* Floating WhatsApp Action Button */}
      <a
        className="whatsapp-chat"
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=Hello%2C%20I%20would%20like%20to%20know%20more%20about%20your%20courses.`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        title="Chat on WhatsApp"
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16.02 3.2A12.7 12.7 0 0 0 5.13 22.44L3.4 28.8l6.52-1.7A12.7 12.7 0 1 0 16.02 3.2Zm0 23.12c-1.87 0-3.7-.5-5.3-1.46l-.38-.23-3.87 1.01 1.03-3.77-.25-.39A10.4 10.4 0 1 1 16.02 26.32Zm5.72-7.79c-.31-.16-1.83-.9-2.12-1-.29-.1-.49-.15-.69.16-.21.31-.8 1-.98 1.2-.18.21-.36.23-.67.08-.31-.16-1.3-.48-2.48-1.53-.92-.82-1.54-1.83-1.72-2.14-.18-.31-.02-.48.13-.63.14-.14.31-.36.47-.54.16-.18.21-.31.31-.52.11-.2.06-.39-.02-.54-.08-.15-.69-1.66-.95-2.28-.25-.6-.5-.52-.69-.53h-.59c-.2 0-.54.08-.82.39-.28.31-1.08 1.05-1.08 2.56s1.1 2.97 1.25 3.17c.15.21 2.17 3.32 5.26 4.65.73.32 1.3.51 1.75.65.74.23 1.41.2 1.94.12.59-.09 1.83-.75 2.09-1.47.26-.72.26-1.33.18-1.46-.08-.13-.28-.21-.59-.36Z"/>
        </svg>
      </a>

      {/* Daily Follow-up Reminder */}
      <DailyReminder enquiries={enquiries} loading={loading} />

      {/* Edit Lead Modal */}
      {activeLeadToEdit && (
        <EditLeadModal
          lead={activeLeadToEdit}
          isOpen={!!activeLeadToEdit}
          counselorList={counselorList}
          currentUser={user}
          onClose={() => setEditLeadId(null)}
          onSave={handleUpdateEnquiry}
          onDelete={handleDeleteEnquiry}
          onConfirmAdmission={handleConfirmAdmission}
          onToast={addToast}
        />
      )}

      {/* Reusable Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialogState.isOpen}
        title={confirmDialogState.title}
        message={confirmDialogState.message}
        confirmText={confirmDialogState.confirmText}
        danger={confirmDialogState.danger}
        success={confirmDialogState.success}
        onConfirm={confirmDialogState.onConfirm}
        onCancel={() => setConfirmDialogState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
