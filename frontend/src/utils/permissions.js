/**
 * Evaluates whether a user can access a menu item based on their role and explicit permissions.
 */
export function hasMenuAccess(user, menuId) {
  if (!user) return false;
  
  // Super-admin always has access to all menus
  const role = String(user.role || '').toLowerCase();
  if (role === 'admin') return true;

  // Check explicit permissions array from user profile
  if (Array.isArray(user.menuPermissions) && user.menuPermissions.length > 0) {
    return user.menuPermissions.includes(menuId);
  }

  // Base role defaults if not explicitly configured:
  if (role === 'teacher') {
    return ['attendance', 'batches', 'tasks'].includes(menuId);
  }

  // Default counselor / receptionist access
  return ['enquiries', 'payments', 'students', 'attendance', 'tasks', 'batches'].includes(menuId);
}

export const AVAILABLE_MENUS = [
  { id: 'enquiries', label: 'Enquiries', description: 'Leads, calls, and conversions' },
  { id: 'payments', label: 'Payments', description: 'Fee receipts and payment logs' },
  { id: 'students', label: 'Students', description: 'Enrolled students database' },
  { id: 'attendance', label: 'Attendance', description: 'Daily clock-in and staff tracking' },
  { id: 'tasks', label: 'Tasks', description: 'Staff task assignments' },
  { id: 'batches', label: 'Batches', description: 'Daily batch schedules' }
];
