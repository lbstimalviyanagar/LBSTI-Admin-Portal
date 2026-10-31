import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Icon from './Icons';
import DonutChart from './Charts/DonutChart';
import LineChart from './Charts/LineChart';
import SearchablePaymentSelect from './SearchablePaymentSelect';
import {
  FEE_ITEMS,
  feeBreakdownTotals,
  numberToIndianWords,
  fmtDate,
  isoDay,
  parseDate,
  sod,
  addDays,
  dayDiff,
  fmtShort,
  rangeOf,
  MON,
  ORG
} from '../utils/helpers';
import api from '../services/api';
import { useTableSort } from '../hooks/useTableSort';
import { SortableTh } from './SortableHeader';

// Debounce helper
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Helper to extract isolated individual course entries from student and enrollments
const extractStudentCourses = (student, allEnrollments = []) => {
  if (!student) return [];
  const map = new Map();

  // 1. Direct enrolledCourses array (from search-students backend)
  if (Array.isArray(student.enrolledCourses) && student.enrolledCourses.length > 0) {
    student.enrolledCourses.forEach((enr, idx) => {
      const courseName = (typeof enr === 'string' ? enr : enr.course || '').trim();
      if (courseName && !map.has(courseName)) {
        map.set(courseName, {
          id: enr.id || enr.enrollmentId || `ec-${idx}`,
          enrollmentId: enr.enrollmentId || '',
          course: courseName,
          status: enr.status || 'Active',
          doa: enr.doa || null
        });
      }
    });
  }

  // 2. Cross-reference allEnrollments prop if student has studentId
  if (allEnrollments && allEnrollments.length > 0 && student.studentId) {
    const sId = String(student.studentId).trim();
    allEnrollments
      .filter(enr => String(enr.studentId || '').trim() === sId)
      .forEach((enr, idx) => {
        const courseName = (enr.course || '').trim();
        if (courseName && !map.has(courseName)) {
          map.set(courseName, {
            id: enr.id || enr.enrollmentId || `enr-${idx}`,
            enrollmentId: enr.enrollmentId || '',
            course: courseName,
            status: enr.status || 'Active',
            doa: enr.doa || null
          });
        }
      });
  }

  // 3. If student has courseDetails string e.g. "ADCA (12 Months) (Active), UI/UX Design (8 Months) (Active)"
  if (student.courseDetails && typeof student.courseDetails === 'string') {
    student.courseDetails.split(',').forEach((cd, idx) => {
      const trimmed = cd.trim();
      const clean = trimmed.replace(/\s*\((Active|Completed|Dropped|New|Inactive)\)\s*$/i, '').trim();
      const statusMatch = trimmed.match(/\((Active|Completed|Dropped|New|Inactive)\)/i);
      const status = statusMatch ? statusMatch[1] : 'Active';
      if (clean && !map.has(clean)) {
        map.set(clean, {
          id: `cd-${idx}-${clean}`,
          enrollmentId: `ENR-${student.studentId || student.id}-${idx + 1}`,
          course: clean,
          status,
          doa: null
        });
      }
    });
  }

  // 4. Split student.courses if available (e.g., "ADCA (12 Months), UI/UX Design (8 Months)")
  if (student.courses && typeof student.courses === 'string') {
    student.courses.split(',').forEach((c, idx) => {
      const courseName = c.trim();
      if (courseName && !map.has(courseName)) {
        map.set(courseName, {
          id: `c-${idx}-${courseName}`,
          enrollmentId: `ENR-${student.studentId || student.id}-${idx + 1}`,
          course: courseName,
          status: 'Active',
          doa: null
        });
      }
    });
  }

  // 5. Fallback for single course property
  if (student.course && typeof student.course === 'string') {
    const courseName = student.course.trim();
    if (courseName && !map.has(courseName)) {
      map.set(courseName, {
        id: `c-single-${courseName}`,
        enrollmentId: `ENR-${student.studentId || student.id}-1`,
        course: courseName,
        status: 'Active',
        doa: null
      });
    }
  }

  return Array.from(map.values());
};

// Course targeted fee lookup helper for ledger invoice configuration
export const getCourseTargetFee = (courseName) => {
  if (!courseName) return 10000;
  const c = String(courseName).toLowerCase();
  
  if (c.includes('full stack') || c.includes('ui/ux') || c.includes('mern') || c.includes('data science') || c.includes('ai & machine')) {
    return 14000;
  }
  if (c.includes('adca') || c.includes('dit') || c.includes('dabc') || c.includes('dea') || c.includes('dmm') || c.includes('dwd') || c.includes('dacs')) {
    return 15000;
  }
  if (c.includes('ctt')) return 22000;
  if (c.includes('nptc')) return 28000;
  if (c.includes('english speaking')) return 7500;
  if (c.includes('advance excel') || c.includes('vba')) return 3500;
  if (c.includes('tally prime') || c.includes('tally 9')) return 4000;
  if (c.includes('gst')) return 4500;
  if (c.includes('cco') || c.includes('beautician')) return 4500;
  if (c.includes('word') || c.includes('c language') || c.includes('c++') || c.includes('sql') || c.includes('photoshop')) return 2500;
  
  const m = c.match(/(\d+)\s*(month|months|days)/i);
  if (m) {
    const num = parseInt(m[1], 10);
    const unit = m[2].toLowerCase();
    if (unit.includes('day')) return 3000;
    if (num >= 24) return 28000;
    if (num >= 18) return 22000;
    if (num >= 12) return 15000;
    if (num >= 8) return 12000;
    if (num >= 6) return 9000;
    if (num >= 4) return 7500;
    if (num >= 3) return 5000;
    if (num >= 2) return 3500;
    if (num >= 1) return 2000;
  }
  return 10000;
};

// Helper to accurately calculate active courses count for any student record
export const getActiveCoursesCount = (student, allEnrollments = []) => {
  if (!student) return 0;
  if (Array.isArray(student.enrolledCourses) && student.enrolledCourses.length > 0) {
    const active = student.enrolledCourses.filter(c => !c.status || c.status.toLowerCase() === 'active');
    if (active.length > 0) return active.length;
    return student.enrolledCourses.length;
  }
  if (student.studentId && Array.isArray(allEnrollments) && allEnrollments.length > 0) {
    const sid = String(student.studentId).trim();
    const matches = allEnrollments.filter(e => String(e.studentId || '').trim() === sid);
    if (matches.length > 0) {
      const active = matches.filter(e => !e.status || e.status.toLowerCase() === 'active');
      return active.length || matches.length;
    }
  }
  if (student.enrollmentCount && Number(student.enrollmentCount) > 0) {
    return Number(student.enrollmentCount);
  }
  if (student.courseDetails && typeof student.courseDetails === 'string') {
    const parts = student.courseDetails.split(',').filter(Boolean);
    const active = parts.filter(p => !p.toLowerCase().includes('dropped') && !p.toLowerCase().includes('inactive'));
    return active.length || parts.length;
  }
  if (student.courses && typeof student.courses === 'string') {
    return student.courses.split(',').filter(Boolean).length;
  }
  if (student.course && typeof student.course === 'string') {
    return 1;
  }
  return 1;
};

// Global matcher across: Student Name, Student ID, and Phone Number
export const matchStudentCriteria = (s, term) => {
  if (!s || !term) return false;
  const q = term.toLowerCase().trim();
  if (!q) return false;
  const digits = q.replace(/\D/g, '');

  // 1. Student Name
  const nameMatch = s.name && s.name.toLowerCase().includes(q);

  // 2. Student ID (e.g. S1144, 1144, S1001, etc.)
  const idMatch = (s.studentId && s.studentId.toLowerCase().includes(q)) ||
                  (s.id && String(s.id).includes(q)) ||
                  (`s${s.id}`.toLowerCase().includes(q));

  // 3. Phone Number
  const phoneStr = String(s.phone || '');
  const phoneDigits = phoneStr.replace(/\D/g, '');
  const phoneMatch = phoneStr.toLowerCase().includes(q) ||
                     (digits.length >= 2 && phoneDigits.includes(digits));

  return !!(nameMatch || idMatch || phoneMatch);
};

export default function PaymentsSection({
  fees = [],
  enquiries = [],
  students = [],
  enrollments = [],
  loading = false,
  onSavePayment,
  onUpdatePayment,
  onDeletePayment,
  onRefresh,
  onToast
}) {
  const [feeTab, setFeeTab] = useState('dashboard'); // 'dashboard' | 'payment' | 'history' | 'receipt'
  
  // Date Range Filter state (preset options: all, today, yesterday, week, month, lastmonth, custom)
  const [dateRangeKind, setDateRangeKind] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Outstanding Dues Modal state
  const [showDuesModal, setShowDuesModal] = useState(false);
  const [duesSearch, setDuesSearch] = useState('');

  // Interactive WhatsApp Generator Modal state
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waMessageType, setWaMessageType] = useState('pending_fee'); // 'pending_fee' | 'assignment' | 'receipt' | 'custom'
  const [waRecipientName, setWaRecipientName] = useState('');
  const [waRecipientPhone, setWaRecipientPhone] = useState('');
  const [waCourseName, setWaCourseName] = useState('');
  const [waPendingBalance, setWaPendingBalance] = useState('');
  const [waAssignmentTopic, setWaAssignmentTopic] = useState('Coursework Assignment / Practical Lab Project');
  const [waReceiptNumber, setWaReceiptNumber] = useState('');
  const [waPaidAmount, setWaPaidAmount] = useState('');
  const [waPaymentMode, setWaPaymentMode] = useState('');
  const [waPaymentDate, setWaPaymentDate] = useState('');
  const [waCustomMessage, setWaCustomMessage] = useState('');
  const [waTargetFee, setWaTargetFee] = useState(null);

  // Payment History real-time search state
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  const activeRange = useMemo(() => {
    return rangeOf(dateRangeKind, customFrom, customTo);
  }, [dateRangeKind, customFrom, customTo]);

  const hasDateFilter = dateRangeKind !== 'all';

  const rangeLabel = useMemo(() => {
    if (dateRangeKind === 'week') return 'This Week';
    if (dateRangeKind === 'month') return 'This Month';
    if (dateRangeKind === 'lastmonth') return 'Last Month';
    if (dateRangeKind === 'today') return 'Today';
    if (dateRangeKind === 'yesterday') return 'Yesterday';
    if (dateRangeKind === 'custom') {
      return `${customFrom ? fmtDate(customFrom) : 'Start'} – ${customTo ? fmtDate(customTo) : 'End'}`;
    }
    return 'All Time';
  }, [dateRangeKind, customFrom, customTo]);

  const handleClearDateFilter = () => {
    setDateRangeKind('all');
    setCustomFrom('');
    setCustomTo('');
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
  };

  // Smart search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const dropdownRef = useRef(null);

  // Isolated course selection state for single-select dropdown & bulk mode
  const [studentCourseOptions, setStudentCourseOptions] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [courseFeeDues, setCourseFeeDues] = useState({});

  const [batch, setBatch] = useState('');
  const [feeMonth, setFeeMonth] = useState(isoDay(new Date()).slice(0, 7));
  const [relation, setRelation] = useState('');
  const [paymentDate, setPaymentDate] = useState(isoDay(new Date()));
  const [notes, setNotes] = useState('');
  const [othersDescription, setOthersDescription] = useState('');
  const [editingPayment, setEditingPayment] = useState(null);
  const [selectedReceiptPaymentId, setSelectedReceiptPaymentId] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Particulars breakdown — includes cash, cheque, and online
  const [breakdown, setBreakdown] = useState(
    Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0, online: 0 }]))
  );

  const handleBreakdownChange = (key, mode, val) => {
    const num = Math.max(0, parseFloat(val) || 0);
    setBreakdown(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [mode]: num
      }
    }));
  };

  const totals = feeBreakdownTotals(breakdown);
  const totalAmount = (totals.cash + totals.cheque + totals.online).toFixed(2);
  // Manually editable summary boxes (no auto-calculation or auto-overwriting)
  const [totalCourseFeesDue, setTotalCourseFeesDue] = useState('');
  const [netPaymentReceived, setNetPaymentReceived] = useState('');
  const [outstandingBalance, setOutstandingBalance] = useState('');

  const isBulkPayment = selectedCourse === 'ALL_COURSES' || selectedCourse === 'All Enrolled Courses (Bulk Payment)';

  // ── Smart Student Search: Live Trigger & Global Matching ──
  const searchAbortRef = useRef(null);

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);

    // If a student was previously chosen, reset selection on typing to allow searching for another student
    if (selectedStudent) {
      setSelectedStudent(null);
      setStudentCourseOptions([]);
      setSelectedCourse('');
      setSelectedEnrollmentId('');
      setBatch('');
    }

    const trimmed = value.trim();
    if (trimmed.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      setSearching(false);
      return;
    }

    // 1. Instant local matching across loaded students and enquiries
    const resultMap = new Map();
    const addCandidate = (cand) => {
      const k = cand.studentId || `id-${cand.id}`;
      if (k && !resultMap.has(k)) {
        resultMap.set(k, cand);
      }
    };

    (students || []).forEach(s => {
      if (matchStudentCriteria(s, trimmed)) addCandidate(s);
    });

    (enquiries || []).forEach(e => {
      if (matchStudentCriteria(e, trimmed)) {
        addCandidate({
          ...e,
          studentId: e.studentId || `S${e.id}`,
          courses: e.course || e.courses || '',
          enrollmentCount: 1
        });
      }
    });

    const instantList = Array.from(resultMap.values());
    setSearchResults(instantList);
    setShowDropdown(true);

    // 2. Real-time query to backend database (/search-students)
    if (searchAbortRef.current) {
      searchAbortRef.current.abort();
    }
    const controller = new AbortController();
    searchAbortRef.current = controller;

    setSearching(true);
    api.searchStudents(trimmed)
      .then((dbResults) => {
        if (controller.signal.aborted) return;
        if (Array.isArray(dbResults) && dbResults.length > 0) {
          setSearchResults(prev => {
            const combinedMap = new Map();
            // Database records have latest enrolledCourses & balance
            dbResults.forEach(item => {
              const key = item.studentId || `id-${item.id}`;
              combinedMap.set(key, item);
            });
            prev.forEach(item => {
              const key = item.studentId || `id-${item.id}`;
              if (!combinedMap.has(key)) combinedMap.set(key, item);
            });
            return Array.from(combinedMap.values());
          });
          setShowDropdown(true);
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        // Silent catch for network cancel / offline
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSearching(false);
        }
      });
  }, [students, enquiries, selectedStudent]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelectStudent = useCallback((student) => {
    setSelectedStudent(student);
    setSearchQuery(student.name);
    setShowDropdown(false);
    setSearchResults([]);
    setSearching(false);
    // Auto-fill guardian name
    setRelation(student.guardianName || '');

    // Dynamically populate isolated individual course options
    const isolatedOptions = extractStudentCourses(student, enrollments);
    setStudentCourseOptions(isolatedOptions);

    // Initialize course fee dues for each course
    const dues = {};
    isolatedOptions.forEach(opt => {
      const defaultFee = (opt.feeDue && opt.feeDue > 0) ? opt.feeDue : ((opt.balance && opt.balance > 0) ? opt.balance : getCourseTargetFee(opt.course));
      dues[opt.course] = defaultFee;
    });
    setCourseFeeDues(dues);

    if (isolatedOptions.length === 1) {
      // Exactly one course enrolled: auto-select it
      setSelectedCourse(isolatedOptions[0].course);
      setSelectedEnrollmentId(isolatedOptions[0].enrollmentId || '');
      setBatch(isolatedOptions[0].course);
    } else if (isolatedOptions.length > 1) {
      // Multiple courses enrolled (e.g., Sahil Choudhary with ADCA and UI/UX Design):
      // Default to "All Enrolled Courses (Bulk Payment)" to programmatically enable calculation rows for all active courses
      setSelectedCourse('ALL_COURSES');
      setSelectedEnrollmentId('BULK');
      setBatch('All Enrolled Courses (Bulk Payment)');
    } else {
      setSelectedCourse('');
      setSelectedEnrollmentId('');
      setBatch('');
    }
  }, [enrollments]);

  const handleCourseChange = (e) => {
    const chosen = e.target.value;
    setSelectedCourse(chosen);
    if (chosen === 'ALL_COURSES' || chosen === 'All Enrolled Courses (Bulk Payment)') {
      setBatch('All Enrolled Courses (Bulk Payment)');
      setSelectedEnrollmentId('BULK');
    } else {
      setBatch(chosen);
      const found = studentCourseOptions.find(opt => opt.course === chosen);
      setSelectedEnrollmentId(found?.enrollmentId || '');
    }
  };

  const handleClearForm = () => {
    setSelectedStudent(null);
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setSearching(false);
    setStudentCourseOptions([]);
    setSelectedCourse('');
    setSelectedEnrollmentId('');
    setCourseFeeDues({});
    setBatch('');
    setFeeMonth(isoDay(new Date()).slice(0, 7));
    setRelation('');
    setPaymentDate(isoDay(new Date()));
    setNotes('');
    setOthersDescription('');
    setEditingPayment(null);
    setBreakdown(Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0, online: 0 }])));
    setTotalCourseFeesDue('');
    setNetPaymentReceived('');
    setOutstandingBalance('');
  };

  const handleCollectStudentDue = (dueItem) => {
    setShowDuesModal(false);
    const matched = (students || []).find(s =>
      (dueItem.studentId && s.studentId === dueItem.studentId) ||
      (dueItem.phone && dueItem.phone !== '–' && s.phone === dueItem.phone) ||
      (dueItem.name && s.name && s.name.toLowerCase() === dueItem.name.toLowerCase())
    ) || (enquiries || []).find(e =>
      (dueItem.phone && dueItem.phone !== '–' && e.phone === dueItem.phone) ||
      (dueItem.name && e.name && e.name.toLowerCase() === dueItem.name.toLowerCase())
    );

    if (matched) {
      handleSelectStudent(matched);
    } else {
      handleSelectStudent({
        id: dueItem.id,
        studentId: dueItem.studentId,
        name: dueItem.name,
        phone: dueItem.phone,
        course: dueItem.course,
        balance: dueItem.balance
      });
    }
    setFeeTab('payment');
  };

  const handleStartEditPayment = (fee) => {
    setEditingPayment(fee);
    setFeeTab('payment');

    const matchedStudent = students.find(s =>
      String(s.id) === String(fee.enquiryId) ||
      (fee.studentId && String(s.studentId) === String(fee.studentId)) ||
      (fee.studentName && s.name && s.name.toLowerCase() === fee.studentName.toLowerCase())
    ) || enquiries.find(e =>
      String(e.id) === String(fee.enquiryId) ||
      (fee.studentName && e.name && e.name.toLowerCase() === fee.studentName.toLowerCase())
    );

    if (matchedStudent) {
      setSelectedStudent(matchedStudent);
      setSearchQuery(matchedStudent.name || fee.studentName || '');
      const courses = extractStudentCourses(matchedStudent, enrollments);
      setStudentCourseOptions(courses);
    } else {
      setSelectedStudent({
        id: fee.enquiryId || fee.id,
        name: fee.studentName || 'Student',
        studentId: fee.studentId || ''
      });
      setSearchQuery(fee.studentName || '');
    }

    const details = fee.receiptDetails || {};
    setSelectedCourse(fee.course || details.course || '');
    if (fee.enrollmentId) setSelectedEnrollmentId(fee.enrollmentId);

    setPaymentDate(fee.paymentDate ? isoDay(parseDate(fee.paymentDate)) : isoDay(new Date()));
    setFeeMonth(fee.billingMonth || details.month || isoDay(new Date()).slice(0, 7));
    setRelation(details.relation || '');
    setNotes(fee.notes || '');

    const items = details.items && typeof details.items === 'object' ? details.items : {
      others: {
        cash: String(fee.mode || '').toLowerCase().includes('cash') ? Number(fee.amount || 0) : 0,
        cheque: String(fee.mode || '').toLowerCase().includes('cheque') ? Number(fee.amount || 0) : 0,
        online: (String(fee.mode || '').toLowerCase().includes('upi') || String(fee.mode || '').toLowerCase().includes('online')) ? Number(fee.amount || 0) : 0
      }
    };
    const initialBreakdown = Object.fromEntries(
      FEE_ITEMS.map(([k]) => [
        k,
        {
          cash: Number((items[k] || {}).cash) || 0,
          cheque: Number((items[k] || {}).cheque) || 0,
          online: Number((items[k] || {}).online) || 0
        }
      ])
    );
    setBreakdown(initialBreakdown);

    const desc = fee.othersDescription || details.othersDescription || '';
    setOthersDescription(desc);

    setTotalCourseFeesDue(
      fee.totalDue != null ? String(fee.totalDue) : (details.totalCourseFeesDue != null ? String(details.totalCourseFeesDue) : '')
    );
    setNetPaymentReceived(fee.amount != null ? String(fee.amount) : '');
    setOutstandingBalance(
      fee.balance != null ? String(fee.balance) : (details.outstandingBalance != null ? String(details.outstandingBalance) : '')
    );

    if (onToast) {
      onToast(`Editing payment record #${fee.id} for ${fee.studentName || 'Student'}`);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      onToast("Search and pick a student first.", true);
      return;
    }
    if (!selectedCourse || !selectedCourse.trim()) {
      onToast("Please select a course or Bulk Payment option.", true);
      return;
    }

    const enteredNet = netPaymentReceived !== '' ? parseFloat(netPaymentReceived) : NaN;
    const breakdownTotal = parseFloat(totalAmount) || 0;
    const finalAmount = !isNaN(enteredNet) && enteredNet > 0 ? enteredNet : (breakdownTotal > 0 ? breakdownTotal : 0);

    if (finalAmount <= 0) {
      onToast("Please enter the payment amount in Net Payment Received or in the fee breakdown table.", true);
      return;
    }

    setSavingPayment(true);
    const modes = [];
    if (totals.cash) modes.push("Cash");
    if (totals.cheque) modes.push("Cheque");
    if (totals.online) modes.push("UPI/Online");
    const mode = modes.join(" + ") || "Cash";

    const isBulk = selectedCourse === 'ALL_COURSES' || selectedCourse === 'All Enrolled Courses (Bulk Payment)';
    const finalCourseName = isBulk ? "All Enrolled Courses (Bulk Payment)" : selectedCourse.trim();

    const parsedDue = totalCourseFeesDue !== '' ? (parseFloat(totalCourseFeesDue) || 0) : 0;
    const parsedOutstanding = outstandingBalance !== '' ? (parseFloat(outstandingBalance) || 0) : 0;

    const payload = {
      enquiryId: Number(selectedStudent.id),
      studentId: selectedStudent.studentId,
      course: finalCourseName,
      isBulkPayment: isBulk,
      selectedCourses: isBulk ? studentCourseOptions.map(c => c.course) : [selectedCourse.trim()],
      enrollmentId: isBulk ? studentCourseOptions.map(c => c.enrollmentId).filter(Boolean).join(',') : (selectedEnrollmentId || undefined),
      courseId: isBulk ? "BULK" : (selectedEnrollmentId || undefined),
      billingMonth: feeMonth,
      amount: finalAmount,
      totalCourseFeesDue: parsedDue,
      outstandingBalance: parsedOutstanding,
      balance: parsedOutstanding,
      paymentDate: paymentDate || isoDay(new Date()),
      mode,
      notes: notes.trim(),
      othersDescription: othersDescription.trim(),
      receiptDetails: {
        batch: isBulk ? "All Enrolled Courses (Bulk)" : selectedCourse.trim(),
        course: finalCourseName,
        isBulkPayment: isBulk,
        courses: isBulk ? studentCourseOptions.map(c => c.course) : [selectedCourse.trim()],
        totalCourseFeesDue: parsedDue,
        netPaymentReceived: finalAmount,
        outstandingBalance: parsedOutstanding,
        isSettled: outstandingBalance !== '' && parsedOutstanding === 0,
        enrollmentId: isBulk ? "BULK" : (selectedEnrollmentId || undefined),
        month: feeMonth,
        relation: relation.trim(),
        othersDescription: othersDescription.trim(),
        items: breakdown
      }
    };

    try {
      if (editingPayment && editingPayment.id) {
        if (onUpdatePayment) {
          await onUpdatePayment(editingPayment.id, payload);
        } else {
          await api.updateFee(editingPayment.id, payload);
          onToast("Payment record updated successfully.");
        }
      } else {
        await onSavePayment(payload);
      }
      handleClearForm();
      setFeeTab('history');
    } catch (err) {
      onToast(err.message || "Unable to save fee payment.", true);
    } finally {
      setSavingPayment(false);
    }
  };

  // Base Payment History dataset (loaded fees or fallback institute records)
  const baseFeesList = useMemo(() => {
    if (fees && fees.length > 0) return fees;
    return [
      {
        id: 1,
        studentName: 'Saksham Arya',
        studentPhone: '9871234567',
        amount: 3000,
        mode: 'UPI',
        paymentDate: '2026-10-12',
        receivedBy: 'Harjot Kaur',
        notes: '1st Installment ADCA',
        course: 'ADCA (12 Months)',
        receiptNumber: 'LBSTI-2026-181878'
      },
      {
        id: 2,
        studentName: 'Taufeeq Ahmad Bhat',
        studentPhone: '9810987654',
        amount: 1300,
        mode: 'UPI',
        paymentDate: '2026-10-10',
        receivedBy: 'Admin',
        notes: 'Monthly fee',
        course: 'ADCA (12 Months)',
        receiptNumber: 'LBSTI-2026-181879'
      },
      {
        id: 3,
        studentName: 'Kirandeep Kaur',
        studentPhone: '8700988483',
        amount: 1500,
        mode: 'Cash',
        paymentDate: '2026-10-08',
        receivedBy: 'Admin',
        notes: 'Admission fee',
        course: 'DABC (12 Months)',
        receiptNumber: 'LBSTI-2026-181880'
      },
      {
        id: 4,
        studentName: 'Md. Gulzar Alam',
        studentPhone: '8527243723',
        amount: 2500,
        mode: 'Cash',
        paymentDate: '2026-10-06',
        receivedBy: 'Shail',
        notes: 'Full payment',
        course: 'ADCA + ESC',
        receiptNumber: 'LBSTI-2026-181888'
      },
      {
        id: 5,
        studentName: 'Mohd. Shaved',
        studentPhone: '9711769678',
        amount: 500,
        mode: 'UPI',
        paymentDate: '2026-10-05',
        receivedBy: 'Admin',
        notes: 'Registration',
        course: 'CCO (3 Months)',
        receiptNumber: 'LBSTI-2026-181893'
      },
      {
        id: 6,
        studentName: 'Vanya Sharma',
        studentPhone: '8376845860',
        amount: 2500,
        mode: 'Card',
        paymentDate: '2026-10-03',
        receivedBy: 'Harjot Kaur',
        notes: 'Course fee installment',
        course: 'ADCA (12 Months)',
        receiptNumber: 'LBSTI-2026-181895'
      },
      {
        id: 7,
        studentName: 'Arpita Mandal',
        studentPhone: '8527145962',
        amount: 2000,
        mode: 'Bank Transfer',
        paymentDate: '2026-10-01',
        receivedBy: 'Admin',
        notes: 'Course Fee',
        course: 'DEA (12 Months)',
        receiptNumber: 'LBSTI-2026-181912'
      }
    ];
  }, [fees]);

  // Filtered payments by global Date Range
  const filteredFees = useMemo(() => {
    if (!hasDateFilter || (!activeRange.start && !activeRange.end)) return baseFeesList;

    return baseFeesList.filter((f) => {
      const pDate = parseDate(f.paymentDate);
      if (!pDate) return false;
      if (activeRange.start && pDate < activeRange.start) return false;
      if (activeRange.end && pDate >= activeRange.end) return false;
      return true;
    });
  }, [baseFeesList, hasDateFilter, activeRange]);

  const historyFees = filteredFees;

  // Auto-initialize selectedReceiptPaymentId to first available record if unset
  useEffect(() => {
    if (!selectedReceiptPaymentId && historyFees.length > 0) {
      setSelectedReceiptPaymentId(String(historyFees[0].id));
    }
  }, [historyFees, selectedReceiptPaymentId]);

  // Issue Printable Receipt
  const handleIssueReceipt = async (targetPaymentId, directFee) => {
    // If targetPaymentId is a React SyntheticEvent or not a primitive, fallback to selectedReceiptPaymentId
    const isPrimitive = typeof targetPaymentId === 'string' || typeof targetPaymentId === 'number';
    const feeId = (isPrimitive && targetPaymentId)
      ? String(targetPaymentId)
      : (selectedReceiptPaymentId || (fees.length > 0 ? String(fees[0].id) : (historyFees.length > 0 ? String(historyFees[0].id) : null)));

    if (!feeId && !directFee) {
      onToast("Select a recorded payment first.", true);
      return;
    }

    const fee = (directFee && typeof directFee === 'object' && directFee.id)
      ? directFee
      : fees.find(f => String(f.id) === String(feeId)) ||
        historyFees.find(f => String(f.id) === String(feeId));

    if (!fee) {
      onToast("Selected payment could not be found.", true);
      return;
    }

    const receiptWin = window.open("", "_blank", "width=820,height=750");
    if (!receiptWin) {
      onToast("Allow pop-ups to print the receipt.", true);
      return;
    }

    let receiptNumber = fee.receiptNumber || `LBSTI-${new Date(fee.paymentDate || Date.now()).getFullYear()}-${String(fee.id).padStart(6, '0')}`;
    try {
      if (api.issueReceipt && fee.id) {
        const issued = await api.issueReceipt(fee.id);
        if (issued && issued.receiptNumber) receiptNumber = issued.receiptNumber;
      }
    } catch (err) {
      // Continue with default number
    }

    const enquiry = students.find(e => String(e.id) === String(fee.enquiryId) || (fee.studentName && e.name && e.name.toLowerCase() === fee.studentName.toLowerCase())) ||
                    enquiries.find(e => String(e.id) === String(fee.enquiryId) || (fee.studentName && e.name && e.name.toLowerCase() === fee.studentName.toLowerCase())) || {};
    const details = fee.receiptDetails || {};
    const isOnline = String(fee.mode || '').toLowerCase().includes('upi') || String(fee.mode || '').toLowerCase().includes('online');
    const isCheque = String(fee.mode || '').toLowerCase().includes('cheque') || String(fee.mode || '').toLowerCase().includes('bank') || String(fee.mode || '').toLowerCase().includes('card');
    const items = details.items && typeof details.items === 'object' ? details.items : {
      others: {
        cash: (!isOnline && !isCheque) ? Number(fee.amount || 0) : 0,
        cheque: isCheque ? Number(fee.amount || 0) : 0,
        online: isOnline ? Number(fee.amount || 0) : 0
      }
    };

    const feeTotals = feeBreakdownTotals(Object.assign(
      Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0, online: 0 }])),
      items
    ));
    const total = feeTotals.cash + feeTotals.cheque + feeTotals.online || Number(fee.amount || 0);
    const monthValue = details.month || (fee.paymentDate ? String(fee.paymentDate).slice(0, 7) : "");
    const monthLabel = monthValue ? new Date(`${monthValue}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "–";
    const amountWords = numberToIndianWords(total);
    const othersDesc = fee.othersDescription || details.othersDescription || '';
    const rowsHtml = FEE_ITEMS.map(([key, label], index) => {
      const item = items[key] || {};
      const cash = Number(item.cash) || 0;
      const cheque = Number(item.cheque) || 0;
      const online = Number(item.online) || 0;
      const itemTotal = cash + cheque + online;
      const displayLabel = (key === 'others' && othersDesc)
        ? `${label} (${othersDesc})`
        : label;
      return `
        <tr>
          <td>${index + 1}.</td>
          <th scope="row">${displayLabel}</th>
          <td>${cash ? `₹${cash.toLocaleString("en-IN")}` : ''}</td>
          <td>${cheque ? `₹${cheque.toLocaleString("en-IN")}` : ''}</td>
          <td>${online ? `₹${online.toLocaleString("en-IN")}` : ''}</td>
          <td>${itemTotal ? `₹${itemTotal.toLocaleString("en-IN")}` : ''}</td>
        </tr>
      `;
    }).join("");

    const displayModes = [];
    if (feeTotals.cash) displayModes.push("Cash");
    if (feeTotals.cheque) displayModes.push("Cheque");
    if (feeTotals.online) displayModes.push("UPI/Online");
    const displayMode = displayModes.join(" and ") || "Cash";

    receiptWin.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt - ${receiptNumber}</title>
        <style>
          *{box-sizing:border-box}
          body{font:14px Arial,sans-serif;color:#273044;margin:24px auto;max-width:760px;padding:24px}
          header{text-align:center;border-bottom:2px solid #c95f58;padding-bottom:14px;margin-bottom:16px}
          h1{font-size:22px;color:#a84e49;margin:0 0 5px}
          header p{margin:0;color:#596275}
          .topline,.studentline{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 0;border-bottom:1px solid #cbd0d8}
          .topline div:last-child{text-align:right}
          .studentline{grid-template-columns:1fr 1fr}
          .studentline div{padding:4px 0}
          .receipt-title{text-align:center;font-weight:700;margin:16px 0 8px;font-size:16px;color:#173a80}
          table{width:100%;border-collapse:collapse;margin:12px 0}
          th,td{border:1px solid #aeb6c2;padding:8px 9px;text-align:left}
          thead th{color:#b2544e;background:#fff7f5}
          tbody td:first-child{width:38px}
          tbody td:nth-child(n+3),tfoot td{text-align:right}
          .total-row th,.total-row td{font-weight:700}
          .words{padding:8px 0;border-bottom:1px dotted #8b929e;margin-top:10px}
          .note{font-size:12px;margin-top:22px;color:#6b7280}
          .signatures{display:flex;justify-content:space-between;margin-top:44px}
          .signatures span{min-width:150px;border-top:1px solid #717987;text-align:center;padding-top:6px}
          .receipt-meta{font-size:12px;color:#5f6877;margin-top:12px}
          button{margin-top:24px;padding:10px 18px;border:0;background:#173a80;color:#fff;border-radius:6px;cursor:pointer;font-weight:bold}
          @media print{body{margin:0 auto;padding:12px}button{display:none}}
        </style>
      </head>
      <body>
        <header>
          <h1>${ORG.fullName}</h1>
          <p>${ORG.domain || ""}</p>
        </header>
        <div class="topline">
          <div><b>Form No.:</b> ${receiptNumber}</div>
          <div><b>Date:</b> ${fmtDate(fee.paymentDate)}</div>
        </div>
        <div class="studentline">
          <div><b>Course:</b> ${fee.course || details.course || details.batch || enquiry?.course || "–"}</div>
          <div><b>Batch:</b> ${details.batch || fee.course || enquiry.batch || "–"}</div>
          <div><b>To Month:</b> ${monthLabel}</div>
          <div><b>Received with thanks from:</b> ${fee.studentName || enquiry?.name || "Student"}</div>
          <div style="grid-column:1/-1"><b>Son/Daughter/Wife of:</b> ${details.relation || "–"}</div>
        </div>
        <div class="receipt-title">OFFICIAL FEE RECEIPT</div>
        <table>
          <thead>
            <tr>
              <th>S.No.</th>
              <th>Particulars</th>
              <th>Cash</th>
              <th>Cheque</th>
              <th>UPI/Online</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="2">TOTAL</th>
              <td>₹${feeTotals.cash.toLocaleString("en-IN")}</td>
              <td>₹${feeTotals.cheque.toLocaleString("en-IN")}</td>
              <td>₹${feeTotals.online.toLocaleString("en-IN")}</td>
              <td class="total-row">₹${total.toLocaleString("en-IN")}</td>
            </tr>
          </tfoot>
        </table>
        <div class="words"><b>Amount in words:</b> ${amountWords}</div>
        <div class="receipt-meta">
          <b>Payment mode:</b> ${displayMode} ${fee.notes ? ` &nbsp; <b>Remarks:</b> ${fee.notes}` : ''}
        </div>
        <p class="note"><b>Note:</b> Fee once deposited will not be refundable in any condition.</p>
        <div class="signatures">
          <span>Student / Payer</span>
          <span>Authorized Signature</span>
        </div>
        <button onclick="window.print()">Print / Save as PDF</button>
      </body>
      </html>
    `);
    receiptWin.document.close();
  };

  // Format message text for the interactive WhatsApp modal
  const buildWhatsAppText = useCallback((type, params) => {
    const sName = params.name || 'Student';
    const cName = params.course || 'Professional Course';
    const orgName = ORG.fullName || 'LBSTI (Lal Bahadur Shastri Training Institute)';
    const orgPhone = ORG.phone || '9990352721';

    if (type === 'pending_fee') {
      const balanceNum = parseFloat(params.balance) || 0;
      const formattedBalance = balanceNum.toLocaleString('en-IN');
      return `Dear *${sName}*,\n\n` +
        `Greetings from *${orgName}*.\n\n` +
        `This is a gentle reminder regarding your enrolled course: *${cName}*.\n` +
        `Your current outstanding fee balance is: *₹${formattedBalance}*.\n\n` +
        `Kindly arrange to clear the pending fees at your earliest convenience to maintain continuous batch attendance and certification processing.\n\n` +
        `If you have already made the payment, please share the transaction receipt with us so we can update your ledger.\n\n` +
        `For UPI / Bank details or any queries, feel free to contact us.\n\n` +
        `Warm regards,\n` +
        `*Accounts Office - ${orgName}*\n` +
        `📞 ${orgPhone} | 🌐 lbstimn.com`;
    }

    if (type === 'assignment') {
      const topic = params.assignmentTopic || 'Coursework Assignment / Practical Lab';
      return `Dear *${sName}*,\n\n` +
        `Greetings from *${orgName}*.\n\n` +
        `This is a reminder regarding your course: *${cName}*.\n` +
        `Our academic records show that your assignment submission (*${topic}*) is currently pending.\n\n` +
        `Please complete and submit your work to your instructor at the earliest. Timely assignment completion is required for practical evaluation and your course certification.\n\n` +
        `If you need any guidance or lab practice time, please coordinate with your faculty during your batch hours.\n\n` +
        `Best regards,\n` +
        `*Academic & Faculty Team*\n` +
        `*${orgName}*\n` +
        `📞 ${orgPhone}`;
    }

    if (type === 'receipt') {
      const recNo = params.receiptNumber || 'REC-PAID';
      const amtStr = Number(params.amount || 0).toLocaleString('en-IN');
      const dateStr = params.date || fmtDate(new Date());
      const mode = params.mode || 'Cash';
      return `*OFFICIAL FEE RECEIPT - ${ORG.shortName || 'LBSTI'}*\n\n` +
        `*Receipt No:* ${recNo}\n` +
        `*Student Name:* ${sName}\n` +
        `*Course:* ${cName}\n` +
        `*Amount Paid:* ₹${amtStr}\n` +
        `*Payment Mode:* ${mode}\n` +
        `*Date:* ${dateStr}\n` +
        `*Status:* Confirmed / Received\n\n` +
        `Thank you for your payment.\n` +
        `*${orgName}*\n` +
        `📞 ${orgPhone}`;
    }

    return `Hello *${sName}*,\n\nGreetings from *${orgName}* regarding your course *${cName}*.`;
  }, []);

  // Open Interactive WhatsApp Choice Modal for a Payment row
  const handleOpenWhatsAppModal = (fee) => {
    const student = (students || []).find(s => 
      String(s.id) === String(fee.enquiryId) || 
      String(s.studentId) === String(fee.studentId) || 
      (fee.studentPhone && s.phone === fee.studentPhone) || 
      (fee.studentName && s.name && s.name.toLowerCase() === fee.studentName.toLowerCase())
    ) || (enquiries || []).find(e => 
      String(e.id) === String(fee.enquiryId) || 
      (fee.studentPhone && e.phone === fee.studentPhone) || 
      (fee.studentName && e.name && e.name.toLowerCase() === fee.studentName.toLowerCase())
    ) || {};

    const studentName = fee.studentName || student.name || 'Student';
    const phone = fee.studentPhone || student.phone || student.mobile || '';
    const course = fee.course || student.course || student.courses || 'Professional Course';

    let pendingAmt = 0;
    if (fee.balance != null && Number(fee.balance) >= 0) {
      pendingAmt = Number(fee.balance);
    } else if (fee.outstandingBalance != null && Number(fee.outstandingBalance) >= 0) {
      pendingAmt = Number(fee.outstandingBalance);
    } else if (fee.receiptDetails && fee.receiptDetails.outstandingBalance != null) {
      pendingAmt = Number(fee.receiptDetails.outstandingBalance);
    } else if (student.balance != null && Number(student.balance) >= 0) {
      pendingAmt = Number(student.balance);
    }

    const recNo = generateReceiptNo(fee.id, fee.paymentDate);
    const dateFormatted = fee.paymentDate ? fmtDate(fee.paymentDate) : fmtDate(new Date());

    setWaTargetFee(fee);
    setWaRecipientName(studentName);
    setWaRecipientPhone(phone);
    setWaCourseName(course);
    setWaPendingBalance(pendingAmt > 0 ? String(pendingAmt) : '0');
    setWaAssignmentTopic('Module Practical / Assignment Submission');
    setWaReceiptNumber(recNo);
    setWaPaidAmount(String(fee.amount || '0'));
    setWaPaymentMode(fee.mode || 'Cash');
    setWaPaymentDate(dateFormatted);

    // Default message type: pending_fee if pending balance > 0, otherwise receipt
    const defaultType = pendingAmt > 0 ? 'pending_fee' : 'receipt';
    setWaMessageType(defaultType);

    const initialText = buildWhatsAppText(defaultType, {
      name: studentName,
      course,
      balance: pendingAmt > 0 ? String(pendingAmt) : '0',
      assignmentTopic: 'Module Practical / Assignment Submission',
      receiptNumber: recNo,
      amount: String(fee.amount || '0'),
      date: dateFormatted,
      mode: fee.mode || 'Cash'
    });
    setWaCustomMessage(initialText);
    setShowWhatsAppModal(true);
  };

  // Open Interactive WhatsApp Choice Modal from Outstanding Dues Table
  const handleOpenWhatsAppModalFromDues = (item) => {
    setWaTargetFee(null);
    setWaRecipientName(item.name || 'Student');
    setWaRecipientPhone(item.phone && item.phone !== '–' ? item.phone : '');
    setWaCourseName(item.course || 'Professional Course');
    setWaPendingBalance(String(item.balance || '0'));
    setWaAssignmentTopic('Module Practical / Assignment Submission');
    setWaReceiptNumber('DUE-REMINDER');
    setWaPaidAmount('0');
    setWaPaymentMode('Cash');
    setWaPaymentDate(fmtDate(new Date()));

    setWaMessageType('pending_fee');
    const initialText = buildWhatsAppText('pending_fee', {
      name: item.name,
      course: item.course,
      balance: String(item.balance || '0'),
      assignmentTopic: 'Module Practical / Assignment Submission',
      receiptNumber: 'DUE-REMINDER',
      amount: '0',
      date: fmtDate(new Date()),
      mode: 'Cash'
    });
    setWaCustomMessage(initialText);
    setShowWhatsAppModal(true);
  };

  // Alias for backward compatibility
  const handleSendToNumber = handleOpenWhatsAppModal;

  const handleExportFeesCSV = () => {
    const exportList = historySearchQuery.trim() ? displayedHistoryFees : filteredFees;
    if (!exportList.length) {
      onToast("Nothing to export for this search / date range", true);
      return;
    }
    const itemColumns = FEE_ITEMS.flatMap(([key, label]) => [
      [key, `${label} Cash`],
      [key, `${label} Cheque`],
      [key, `${label} UPI/Online`]
    ]);
    const headers = [
      "Form No.", "Student", "Course", "Batch", "Fee month", "Relation",
      ...itemColumns.map(([, label]) => label),
      "Others Description",
      "Total", "Mode", "Date", "Received by", "Notes"
    ];
    const escapeCsv = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...exportList.map((f) => {
        const enquiry = students.find(e => String(e.id) === String(f.enquiryId)) || {};
        const details = f.receiptDetails || {};
        const items = details.items || {
          others: {
            cash: f.mode === "Cheque" ? 0 : Number(f.amount || 0),
            cheque: f.mode === "Cheque" ? Number(f.amount || 0) : 0,
            online: 0
          }
        };
        const breakdownValues = itemColumns.map(([key, modeLabel]) => {
          const m = modeLabel.toLowerCase().endsWith("cash") ? "cash" : modeLabel.toLowerCase().endsWith("cheque") ? "cheque" : "online";
          return Number((items[key] || {})[m]) || 0;
        });

        const receiptNo = `LBSTI-${new Date(f.paymentDate || Date.now()).getFullYear()}-${String(f.id).padStart(6, '0')}`;

        return [
          receiptNo,
          f.studentName || enquiry.name || "Unknown",
          enquiry.course || f.course || "",
          details.batch || enquiry.batch || "",
          details.month || "",
          details.relation || "",
          ...breakdownValues,
          f.othersDescription || details.othersDescription || "",
          f.amount,
          f.mode,
          f.paymentDate ? isoDay(parseDate(f.paymentDate)) : "",
          f.receivedBy || "Admin",
          f.notes || ""
        ].map(escapeCsv).join(",");
      })
    ].join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fee-payments-${isoDay(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    onToast(`Exported ${filteredFees.length} fee payment records`);
  };

  // Dashboard calculations from filtered fees
  const feesCount = filteredFees.length;
  const totalCollected = filteredFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthFees = filteredFees.filter(f => {
    const d = parseDate(f.paymentDate);
    return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthFeesCount = monthFees.length;
  const monthTotal = monthFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
  const avgPayment = filteredFees.length ? Math.round(totalCollected / filteredFees.length) : 0;

  // Outstanding Dues Breakdown calculation
  const pendingDuesList = useMemo(() => {
    const map = new Map();

    // 1. From students
    (students || []).forEach(s => {
      const bal = Number(s.balance);
      if (bal > 0) {
        const key = s.studentId || `stud-${s.id}`;
        let course = '';
        if (Array.isArray(s.enrolledCourses) && s.enrolledCourses.length > 0) {
          course = typeof s.enrolledCourses[0] === 'string' ? s.enrolledCourses[0] : (s.enrolledCourses[0].course || '');
        } else {
          const enr = (enrollments || []).find(en => String(en.studentId) === String(s.studentId));
          if (enr) course = enr.course;
          else {
            const enq = (enquiries || []).find(e => (s.phone && e.phone === s.phone) || (s.name && e.name && e.name.toLowerCase() === s.name.toLowerCase()));
            if (enq) course = enq.course;
          }
        }
        map.set(key, {
          id: s.id,
          studentId: s.studentId || `STU-${s.id}`,
          name: s.name,
          phone: s.phone || '–',
          course: course || 'General Course',
          balance: bal
        });
      }
    });

    // 2. From enrollments with feeDue or balance
    (enrollments || []).forEach(en => {
      const bal = Number(en.balance || en.feeDue);
      if (bal > 0) {
        const key = en.studentId || `enr-${en.id}`;
        if (!map.has(key)) {
          const student = (students || []).find(s => String(s.studentId) === String(en.studentId));
          const enquiry = (enquiries || []).find(e => (student && student.phone && e.phone === student.phone) || (en.studentName && e.name && e.name.toLowerCase() === en.studentName.toLowerCase()));
          map.set(key, {
            id: en.id,
            studentId: en.studentId || `ENR-${en.id}`,
            name: en.studentName || student?.name || 'Enrolled Student',
            phone: student?.phone || enquiry?.phone || '–',
            course: en.course || 'General Course',
            balance: bal
          });
        }
      }
    });

    // 3. From enquiries with balance
    (enquiries || []).forEach(e => {
      const bal = Number(e.balance);
      if (bal > 0) {
        const key = `enq-${e.id}`;
        const already = Array.from(map.values()).some(item => (e.phone && item.phone === e.phone) || (e.name && item.name.toLowerCase() === e.name.toLowerCase()));
        if (!already) {
          map.set(key, {
            id: e.id,
            studentId: `ENQ-${e.id}`,
            name: e.name,
            phone: e.phone || '–',
            course: e.course || 'General Course',
            balance: bal
          });
        }
      }
    });

    const realList = Array.from(map.values()).sort((a, b) => b.balance - a.balance);
    if (realList.length > 0) {
      return realList;
    }

    // Default sample 5 pending students totaling ₹14,500
    return [
      { id: 'due-1', studentId: 'STU-1042', name: 'Aarav Sharma', phone: '9876543210', course: 'Web Development (MERN)', balance: 4500 },
      { id: 'due-2', studentId: 'STU-1089', name: 'Priya Verma', phone: '9812345678', course: 'Graphic Design', balance: 3000 },
      { id: 'due-3', studentId: 'STU-1104', name: 'Rahul Gupta', phone: '9898765432', course: 'Python Programming', balance: 2500 },
      { id: 'due-4', studentId: 'STU-1120', name: 'Simran Kaur', phone: '9711223344', course: 'Tally Prime & GST', balance: 2500 },
      { id: 'due-5', studentId: 'STU-1135', name: 'Aman Singh', phone: '9823456789', course: 'Digital Marketing', balance: 2000 }
    ];
  }, [students, enrollments, enquiries]);

  const totalOutstandingDues = useMemo(() => {
    return pendingDuesList.reduce((sum, item) => sum + item.balance, 0);
  }, [pendingDuesList]);

  const pendingStudentsCount = pendingDuesList.length;

  const filteredPendingDues = useMemo(() => {
    if (!duesSearch.trim()) return pendingDuesList;
    const q = duesSearch.trim().toLowerCase();
    return pendingDuesList.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.phone.toLowerCase().includes(q) ||
      item.course.toLowerCase().includes(q) ||
      (item.studentId && item.studentId.toLowerCase().includes(q))
    );
  }, [pendingDuesList, duesSearch]);

  // Payment Modes Distribution calculation from filtered fees
  const paymentModesData = useMemo(() => {
    let upi = 0;
    let cash = 0;
    let bank = 0;

    filteredFees.forEach(f => {
      const mode = String(f.mode || '').toLowerCase();
      const amt = Number(f.amount || 0);
      if (mode.includes('upi') || mode.includes('online')) {
        upi += amt;
      } else if (mode.includes('cheque') || mode.includes('bank') || mode.includes('card') || mode.includes('transfer')) {
        bank += amt;
      } else {
        cash += amt;
      }
    });

    const items = [];
    if (upi > 0) items.push({ name: 'UPI', v: Math.round(upi), color: '#2563eb' });
    if (cash > 0) items.push({ name: 'Cash', v: Math.round(cash), color: '#059669' });
    if (bank > 0) items.push({ name: 'Bank Transfer', v: Math.round(bank), color: '#d97706' });

    if (items.length === 0 && !hasDateFilter) {
      return [
        { name: 'UPI', v: 4800, color: '#2563eb' },
        { name: 'Cash', v: 4000, color: '#059669' },
        { name: 'Bank Transfer', v: 250, color: '#d97706' }
      ];
    }

    return items;
  }, [filteredFees, hasDateFilter]);

  // Fee collections trend data (adapts to date filter or defaults to last 6 calendar months)
  const { monthlyTrendData, trendMeta } = useMemo(() => {
    const list = filteredFees;

    if (hasDateFilter && activeRange.start && activeRange.end) {
      const start = sod(activeRange.start);
      const lastIncluded = addDays(sod(activeRange.end), -1);
      const spanDays = Math.max(1, dayDiff(start, lastIncluded) + 1);

      if (spanDays <= 35) {
        // Day-by-day points for date range
        const days = [];
        for (let i = 0; i < spanDays; i++) {
          const curDate = addDays(start, i);
          const iso = isoDay(curDate);
          const label = `${curDate.getDate()} ${MON[curDate.getMonth()]}`;
          const full = `${curDate.getDate()} ${MON[curDate.getMonth()]} ${curDate.getFullYear()}`;
          days.push({ key: iso, label, full, v: 0, count: 0 });
        }

        list.forEach((f) => {
          const pDate = parseDate(f.paymentDate);
          if (!pDate) return;
          const iso = isoDay(pDate);
          const match = days.find((d) => d.key === iso);
          if (match) {
            match.v += Number(f.amount || 0);
            match.count += 1;
          }
        });

        return {
          monthlyTrendData: days,
          trendMeta: {
            title: `Collection Trend (${rangeLabel})`,
            sub: `Daily collections for ${rangeLabel}`,
            total: days.reduce((acc, d) => acc + d.v, 0),
            periodLabel: `${spanDays}-Day Total`
          }
        };
      }
    }

    // Default view: last 6 calendar months
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = d.getMonth();
      const key = `${year}-${String(monthNum + 1).padStart(2, '0')}`;
      const shortName = d.toLocaleDateString('en-IN', { month: 'short' });
      const fullName = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      months.push({ key, year, monthNum, label: shortName, full: fullName, v: 0, count: 0 });
    }

    list.forEach((f) => {
      const fDate = parseDate(f.paymentDate);
      if (!fDate) return;
      const fKey = `${fDate.getFullYear()}-${String(fDate.getMonth() + 1).padStart(2, '0')}`;
      const targetMonth = months.find((m) => m.key === fKey);
      if (targetMonth) {
        targetMonth.v += Number(f.amount || 0);
        targetMonth.count += 1;
      }
    });

    const hasData = months.some((m) => m.v > 0);
    let finalPoints = months;
    if (!hasData && !hasDateFilter) {
      const mockValues = [18500, 24000, 29500, 21000, 34500, 42000];
      const mockCounts = [6, 8, 10, 7, 12, 14];
      finalPoints = months.map((m, idx) => ({
        ...m,
        v: mockValues[idx] || 25000,
        count: mockCounts[idx] || 8
      }));
    }

    return {
      monthlyTrendData: finalPoints,
      trendMeta: {
        title: hasDateFilter ? `Monthly Collection Trend (${rangeLabel})` : 'Monthly Collection Trend',
        sub: hasDateFilter ? `Fee collections recorded for ${rangeLabel}` : 'Fee collections trend over the past 6 months',
        total: finalPoints.reduce((acc, m) => acc + m.v, 0),
        periodLabel: hasDateFilter ? `${rangeLabel} Total` : '6-Month Total'
      }
    };
  }, [filteredFees, hasDateFilter, activeRange, rangeLabel]);

  // Recent Transactions calculation from filtered fees
  const recentTransactions = useMemo(() => {
    return filteredFees.map((f) => {
      const student = students.find(s => String(s.id) === String(f.enquiryId) || String(s.studentId) === String(f.studentId)) ||
                      enquiries.find(e => String(e.id) === String(f.enquiryId)) || {};
      const receiptNo = f.receiptNumber || `LBSTI-${new Date(f.paymentDate || Date.now()).getFullYear()}-${String(f.id).padStart(4, '0')}`;
      const studentName = f.studentName || student.name || "Enrolled Student";
      const course = f.course || f.receiptDetails?.course || f.receiptDetails?.batch || student.course || "–";
      const dateStr = f.paymentDate ? fmtDate(f.paymentDate) : fmtDate(new Date());
      const amount = Number(f.amount || 0);
      const mode = f.mode || "Cash";
      const status = f.status || "Completed";

      return {
        id: f.id,
        receiptNo,
        studentName,
        studentPhone: student.phone || '',
        date: dateStr,
        course,
        amount,
        mode,
        status,
        othersDescription: f.othersDescription || f.receiptDetails?.othersDescription || ''
      };
    });
  }, [filteredFees, students, enquiries]);

  // Sorting state for Recent Transactions
  const {
    sortKey: recentSortKey,
    sortDirection: recentSortDir,
    handleSort: handleRecentSort,
    sortList: sortRecentTx
  } = useTableSort({ key: 'date', direction: 'desc' });

  const sortedRecentTx = useMemo(() => {
    return sortRecentTx(recentTransactions);
  }, [recentTransactions, sortRecentTx]);

  // Sorting state for Payment History
  const {
    sortKey: historySortKey,
    sortDirection: historySortDir,
    handleSort: handleHistorySort,
    sortList: sortHistoryFees
  } = useTableSort({ key: 'paymentDate', direction: 'desc' });

  const sortedHistoryFees = useMemo(() => {
    return sortHistoryFees(historyFees);
  }, [historyFees, sortHistoryFees]);

  // Real-time search filter for Payment History (checks student, course, receivedBy)
  const displayedHistoryFees = useMemo(() => {
    if (!historySearchQuery.trim()) return sortedHistoryFees;
    const q = historySearchQuery.trim().toLowerCase();
    return sortedHistoryFees.filter((f) => {
      const student = String(f.studentName || '').toLowerCase();
      const course = String(f.course || '').toLowerCase();
      const receivedBy = String(f.receivedBy || '').toLowerCase();
      return student.includes(q) || course.includes(q) || receivedBy.includes(q);
    });
  }, [sortedHistoryFees, historySearchQuery]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Payments</h2>
          <p>Manage fee payments, breakdown particulars, and official receipts.</p>
        </div>

        {(feeTab === 'dashboard' || feeTab === 'history') && (
          <div className="controls">
            <label className="sr-only" htmlFor="payments-range">Time range</label>
            <select
              className="select"
              id="payments-range"
              value={dateRangeKind}
              onChange={(e) => setDateRangeKind(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="month">This Month</option>
              <option value="week">This Week</option>
              <option value="lastmonth">Last Month</option>
              <option value="custom">Custom Range</option>
              <option value="all">All Time</option>
            </select>

            {dateRangeKind === 'custom' && (
              <div className="custom-range" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  className="input"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  title="From date"
                />
                <span className="muted">to</span>
                <input
                  className="input"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  title="To date"
                />
              </div>
            )}

            <button
              className="btn"
              type="button"
              onClick={handleRefresh}
              title="Refresh payments data"
            >
              <span className={`ic ${refreshing || loading ? 'spin' : ''}`}><Icon name="refresh" size={18} /></span>
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Sub Tabs Container */}
      <div className="tabs fees-tabs" role="tablist" style={{ marginBottom: '20px' }}>
        <button
          className="fee-tab"
          type="button"
          role="tab"
          aria-selected={feeTab === 'dashboard'}
          onClick={() => setFeeTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className="fee-tab"
          type="button"
          role="tab"
          aria-selected={feeTab === 'payment'}
          onClick={() => setFeeTab('payment')}
        >
          Record Payment
        </button>
        <button
          className="fee-tab"
          type="button"
          role="tab"
          aria-selected={feeTab === 'history'}
          onClick={() => setFeeTab('history')}
        >
          Payment History
        </button>
        <button
          className="fee-tab"
          type="button"
          role="tab"
          aria-selected={feeTab === 'receipt'}
          onClick={() => setFeeTab('receipt')}
        >
          Issue Receipt
        </button>
      </div>

      {/* 1. Dashboard Tab */}
      {feeTab === 'dashboard' && (
        <section>
          {/* Summary Cards with adjacent Fee Dues Analytics */}
          <div className="stats">
            {loading ? (
              Array(4).fill(0).map((_, i) => (
                <div key={i} className="card skel" style={{ height: '118px' }} />
              ))
            ) : (
              <>
                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="award" size={20} /></span>
                    <span className="stat-label">{hasDateFilter ? "Total in Period" : "Total collected"}</span>
                  </div>
                  <div className="stat-val">₹{totalCollected.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">
                    {hasDateFilter
                      ? `${feesCount} payment ${feesCount === 1 ? 'record' : 'records'}`
                      : `${feesCount} ${feesCount === 1 ? 'payment recorded' : 'payments recorded'}`}
                  </div>
                </div>

                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="clock" size={20} /></span>
                    <span className="stat-label">{hasDateFilter ? rangeLabel : "Collected this month"}</span>
                  </div>
                  <div className="stat-val">{hasDateFilter ? `${feesCount} records` : `₹${monthTotal.toLocaleString("en-IN")}`}</div>
                  <div className="stat-sub">
                    {hasDateFilter
                      ? `Filter active: ${rangeLabel}`
                      : `${monthFeesCount} ${monthFeesCount === 1 ? 'payment' : 'payments'} this month`}
                  </div>
                </div>

                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="users" size={20} /></span>
                    <span className="stat-label">Average payment</span>
                  </div>
                  <div className="stat-val">₹{avgPayment.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">
                    {hasDateFilter ? `Average for ${rangeLabel}` : "Across all recorded payments"}
                  </div>
                </div>

                {/* 4. Fee Dues Analytics Card (Interactive with Outstanding Dues Modal) */}
                <div
                  className="card stat"
                  onClick={() => setShowDuesModal(true)}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}
                  title="Click to view students with pending balances"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setShowDuesModal(true); }}
                >
                  <div className="stat-top">
                    <span className="stat-ico" style={{ background: '#fef2f2', color: '#dc2626' }}>
                      <Icon name="alert" size={20} />
                    </span>
                    <span className="stat-label">Total Outstanding Dues</span>
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.72rem',
                        color: '#dc2626',
                        fontWeight: 700,
                        background: '#fee2e2',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      View List →
                    </span>
                  </div>
                  <div className="stat-val" style={{ color: '#b91c1c' }}>
                    ₹{totalOutstandingDues.toLocaleString("en-IN")}
                  </div>
                  <div className="stat-sub">
                    <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                      {pendingStudentsCount} pending student payments
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 1. Full-Width Recent Transactions Table Card at the Very Top */}
          <div className="card section w-full" style={{ width: '100%', marginTop: '22px', marginBottom: '22px' }}>
            <div className="card-head">
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Recent Transactions</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>
                  {hasDateFilter
                    ? `Showing ${sortedRecentTx.length} payments recorded for ${rangeLabel}`
                    : "Latest fee collections and receipt records."}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {hasDateFilter && (
                  <button
                    className="btn sm"
                    type="button"
                    onClick={handleClearDateFilter}
                    style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                    title="Clear date filter"
                  >
                    Clear Filter ✕
                  </button>
                )}
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => setFeeTab('history')}
                  title="View all payments in history"
                >
                  View all <Icon name="chevR" size={14} />
                </button>
              </div>
            </div>

            <div className="tbl-scroll">
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <SortableTh colKey="receiptNo" label="Receipt No." sortKey={recentSortKey} sortDirection={recentSortDir} onSort={handleRecentSort} />
                    <SortableTh colKey="studentName" label="Student Name" sortKey={recentSortKey} sortDirection={recentSortDir} onSort={handleRecentSort} />
                    <SortableTh colKey="date" label="Date" sortKey={recentSortKey} sortDirection={recentSortDir} onSort={handleRecentSort} />
                    <SortableTh colKey="course" label="Course" sortKey={recentSortKey} sortDirection={recentSortDir} onSort={handleRecentSort} />
                    <SortableTh colKey="amount" label="Amount Paid" sortKey={recentSortKey} sortDirection={recentSortDir} onSort={handleRecentSort} />
                    <SortableTh colKey="mode" label="Payment Mode" sortKey={recentSortKey} sortDirection={recentSortDir} onSort={handleRecentSort} />
                    <SortableTh colKey="status" label="Status" sortKey={recentSortKey} sortDirection={recentSortDir} onSort={handleRecentSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedRecentTx.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '36px 20px' }}>
                        <div className="empty" style={{ margin: 0 }}>
                          <div className="ei"><Icon name="fee" size={24} /></div>
                          <b>No transactions found {hasDateFilter ? 'in this date range' : 'yet'}</b>
                          <span>{hasDateFilter ? 'Try adjusting your start and end dates or clear the filter.' : 'New fee payments will appear here.'}</span>
                          {hasDateFilter && (
                            <div style={{ marginTop: '12px' }}>
                              <button
                                type="button"
                                className="btn primary sm"
                                onClick={handleClearDateFilter}
                              >
                                Clear Date Filter
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedRecentTx.map((tx) => (
                    <tr key={tx.id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--navy-700)', fontSize: '0.82rem' }}>
                          {tx.receiptNo}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{tx.studentName}</div>
                        {tx.studentPhone && <small style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{tx.studentPhone}</small>}
                      </td>
                      <td>{tx.date}</td>
                      <td>
                        <div>{tx.course}</div>
                        {tx.othersDescription ? (
                          <small style={{ display: 'block', color: 'var(--muted)', fontSize: '0.78rem' }}>
                            For: {tx.othersDescription}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <strong style={{ color: '#0f172a' }}>₹{Number(tx.amount || 0).toLocaleString('en-IN')}</strong>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 9px',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          background: '#f1f5f9',
                          color: '#334155',
                          border: '1px solid #e2e8f0'
                        }}>
                          {tx.mode}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          background: tx.status === 'Completed' ? '#dcfce7' : '#fef9c3',
                          color: tx.status === 'Completed' ? '#15803d' : '#854d0e',
                          border: `1px solid ${tx.status === 'Completed' ? '#bbf7d0' : '#fef08a'}`
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: tx.status === 'Completed' ? '#16a34a' : '#ca8a04'
                          }} />
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  )))
                }
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Responsive Bottom Container: Line Graph and Donut Chart Side-by-Side (Stacked on Mobile) */}
          <div className="payments-charts-row" style={{ display: 'flex', gap: '20px', width: '100%', marginTop: '0', marginBottom: '0' }}>
            {/* Monthly Collection Trend Line Graph Card */}
            <div className="chart-col-line" style={{ flex: '1.4', minWidth: 0 }}>
              <div className="card section" style={{ margin: 0, padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '18px'
                }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800, color: '#0f172a' }}>
                      {trendMeta.title}
                    </h3>
                    <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>
                      {trendMeta.sub}
                    </p>
                  </div>

                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    padding: '6px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    border: '1px solid #bfdbfe'
                  }}>
                    <Icon name="chart" size={15} />
                    <span>
                      {trendMeta.periodLabel}: ₹{trendMeta.total.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div style={{ flex: 1, minHeight: 0 }}>
                  <LineChart
                    points={monthlyTrendData}
                    aria="Fee collections trend"
                    valuePrefix="₹"
                    unit="collected"
                    emptyTitle="No collection records in this period"
                    emptyMsg="Adjust your start/end dates to view collections."
                    formatTooltip={(p) => (
                      <div>
                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '0.86rem' }}>{p.full}</div>
                        <div style={{ marginTop: '2px', color: '#93c5fd', fontWeight: 600 }}>
                          ₹{Number(p.v || 0).toLocaleString('en-IN')}
                        </div>
                        {p.count > 0 && (
                          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginTop: '1px' }}>
                            {p.count} {p.count === 1 ? 'payment recorded' : 'payments recorded'}
                          </div>
                        )}
                      </div>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Payment Modes Distribution Donut Card */}
            <div className="chart-col-donut" style={{ flex: '1', minWidth: 0 }}>
              <div className="card section" style={{ margin: 0, padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ marginBottom: '18px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Payment Modes Distribution</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>
                    Collections breakdown by payment channel
                  </p>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <DonutChart
                    items={paymentModesData}
                    aria="Payment Modes Distribution"
                    centerLabel="collected"
                  />
                </div>

                <div style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--line)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(min(90px, 100%), 1fr))',
                  gap: '10px',
                  textAlign: 'center'
                }}>
                  {paymentModesData.map((item) => (
                    <div key={item.name} style={{ background: 'var(--card-2)', padding: '10px 8px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontWeight: 600 }}>{item.name}</div>
                      <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', marginTop: '2px' }}>
                        ₹{item.v.toLocaleString('en-IN')}
                      </div>
                      <div style={{ fontSize: '0.74rem', color: item.color, fontWeight: 700, marginTop: '2px' }}>
                        {Math.round((item.v / totalCollected) * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. Record Payment Tab */}
      {feeTab === 'payment' && (
        <section>
          <form className="card form-card" onSubmit={handleSubmitPayment} noValidate>
            <div className="form-body">
              {editingPayment && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  marginBottom: '16px',
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  color: '#b45309'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <Icon name="edit" size={18} />
                    <span>
                      Editing payment record #{editingPayment.id} for {editingPayment.studentName || 'Student'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={handleClearForm}
                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                  >
                    Cancel edit
                  </button>
                </div>
              )}
              <h3>{editingPayment ? `Edit Payment #${editingPayment.id}` : 'Record a payment'}</h3>
              <p className="lead">{editingPayment ? 'Update payment particulars, amounts, and custom descriptions.' : 'Search for an enrolled student by Name, Student ID, or Phone number.'}</p>

              <div className="fgrid">
                {/* Smart Student Search */}
                <div className="fld full" ref={dropdownRef} style={{ position: 'relative' }}>
                  <label htmlFor="fee-student-search">Student <em>*</em></label>
                  <input
                    className="input"
                    id="fee-student-search"
                    placeholder="Type student name, ID (e.g. S1001), or phone number..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onFocus={() => {
                      if (!selectedStudent && searchResults.length > 0) {
                        setShowDropdown(true);
                      } else if (!selectedStudent && searchQuery.trim().length >= 1) {
                        handleSearchChange(searchQuery);
                      }
                    }}
                    autoComplete="off"
                    style={selectedStudent ? { borderColor: '#10b981', background: '#f0fdf4' } : {}}
                  />
                  {searching && (
                    <div style={{ position: 'absolute', right: '12px', top: '38px', color: '#2563eb', fontSize: '13px', fontWeight: 600 }}>
                      Searching...
                    </div>
                  )}

                  {/* Floating Suggestion Overlay */}
                  {showDropdown && searchResults.length > 0 && !selectedStudent && (
                    <div
                      id="student-search-suggestions"
                      style={{
                        position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                        background: '#ffffff', border: '1.5px solid #3b82f6', borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)', maxHeight: '300px', overflowY: 'auto'
                      }}
                    >
                      {searchResults.map((s, idx) => {
                        const activeCount = getActiveCoursesCount(s, enrollments);
                        const sIdDisplay = s.studentId || `S${String(s.id).padStart(4, '0')}`;
                        return (
                          <button
                            key={s.studentId || s.id || idx}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectStudent(s);
                            }}
                            onClick={() => handleSelectStudent(s)}
                            style={{
                              display: 'block', width: '100%', padding: '12px 16px', textAlign: 'left',
                              border: 'none', borderBottom: '1px solid #f1f5f9', background: 'none',
                              cursor: 'pointer', fontSize: '14px', transition: 'background 0.15s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>
                                {s.name}
                                <span style={{
                                  marginLeft: '8px',
                                  fontWeight: 700,
                                  color: '#1d4ed8',
                                  fontSize: '12px',
                                  background: '#dbeafe',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  border: '1px solid #bfdbfe'
                                }}>
                                  {sIdDisplay}
                                </span>
                              </div>
                              <span style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#15803d',
                                background: '#dcfce7',
                                border: '1px solid #bbf7d0',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                whiteSpace: 'nowrap'
                              }}>
                                {activeCount} Active Course{activeCount === 1 ? '' : 's'}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>📞 {s.phone || 'N/A'}</span>
                              {s.courses && <span>&bull; 📚 {s.courses}</span>}
                              {s.guardianName && <span>&bull; 👤 {s.guardianName}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {showDropdown && searchResults.length === 0 && searchQuery.trim().length >= 1 && !searching && !selectedStudent && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 100,
                      background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.12)', padding: '16px', textAlign: 'center',
                      color: '#94a3b8'
                    }}>
                      No students found matching "{searchQuery}" (searched Name, Student ID, Phone)
                    </div>
                  )}
                </div>

                {/* Selected Student Info Badge */}
                {selectedStudent && (
                  <div className="fld full" style={{ padding: 0 }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)', border: '1px solid #86efac',
                      borderRadius: '10px', padding: '14px 18px', gap: '16px'
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>✅ {selectedStudent.name}</span>
                          <span style={{ fontWeight: 700, color: '#1d4ed8', marginLeft: '4px', fontSize: '12.5px', background: '#dbeafe', padding: '2px 8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
                            {selectedStudent.studentId || `S${selectedStudent.id}`}
                          </span>
                          <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', border: '1px solid #86efac' }}>
                            {getActiveCoursesCount(selectedStudent, enrollments)} Active Course{getActiveCoursesCount(selectedStudent, enrollments) === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '4px' }}>
                          📞 {selectedStudent.phone || 'N/A'}
                          {selectedStudent.courseDetails && <> &nbsp;·&nbsp; 📚 {selectedStudent.courseDetails}</>}
                          {selectedStudent.guardianName && <> &nbsp;·&nbsp; 👤 {selectedStudent.guardianName}</>}
                        </div>
                      </div>
                      <button type="button" onClick={handleClearForm}
                        style={{ border: 'none', background: '#dc2626', color: '#fff', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                        Change
                      </button>
                    </div>
                  </div>
                )}

                <div className="fld">
                  <label htmlFor="fee-batch" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Batch / Course <span style={{ color: '#ef4444' }}>*</span></span>
                    {selectedStudent && studentCourseOptions.length > 1 && (
                      <span style={{ fontSize: '11px', color: '#1e40af', background: '#dbeafe', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                        {studentCourseOptions.length} Active Courses (Bulk Enabled)
                      </span>
                    )}
                  </label>
                  <select
                    className="select"
                    id="fee-batch"
                    value={selectedCourse}
                    onChange={handleCourseChange}
                    disabled={!selectedStudent}
                    style={{
                      background: !selectedStudent ? '#f9fafb' : '#ffffff',
                      borderColor: selectedStudent && !selectedCourse ? '#f87171' : '#cbd5e1',
                      fontWeight: selectedCourse ? 600 : 400,
                      color: selectedCourse ? '#0f172a' : '#64748b'
                    }}
                    required
                  >
                    {!selectedStudent ? (
                      <option value="">-- Search &amp; pick a student first --</option>
                    ) : studentCourseOptions.length === 0 ? (
                      <option value="">-- No enrolled courses found for this student --</option>
                    ) : (
                      <>
                        <option value="">-- Choose specific course or Bulk Payment --</option>
                        {/* Dynamic utility option at the top of the dropdown list */}
                        <option value="ALL_COURSES" style={{ fontWeight: 700, color: '#1d4ed8' }}>
                          All Enrolled Courses (Bulk Payment)
                        </option>
                        {studentCourseOptions.map((opt, idx) => (
                          <option key={opt.id || opt.enrollmentId || idx} value={opt.course}>
                            {opt.course}{opt.status && opt.status !== 'Active' ? ` (${opt.status})` : ''}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                  {selectedStudent && !selectedCourse && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                      * Select a specific course or choose "All Enrolled Courses (Bulk Payment)".
                    </div>
                  )}
                  {selectedStudent && isBulkPayment && (
                    <div style={{ fontSize: '11px', color: '#1d4ed8', marginTop: '4px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span>⚡ Bulk Payment Mode Active: All {studentCourseOptions.length} active courses enabled simultaneously.</span>
                    </div>
                  )}
                  {selectedStudent && selectedCourse && !isBulkPayment && (
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px', fontWeight: 500 }}>
                      ✓ Payment mapped exclusively to: <strong>{selectedCourse}</strong>
                    </div>
                  )}
                </div>

                <div className="fld">
                  <label htmlFor="fee-month">Fee for month</label>
                  <input
                    className="input"
                    id="fee-month"
                    type="month"
                    value={feeMonth}
                    onChange={(e) => setFeeMonth(e.target.value)}
                  />
                </div>

                <div className="fld full">
                  <label htmlFor="fee-relation">Son / Daughter / Wife of</label>
                  <input
                    className="input"
                    id="fee-relation"
                    placeholder="Auto-filled from student's Guardian Name"
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    readOnly={!!selectedStudent}
                    style={selectedStudent ? { background: '#f9fafb', color: '#4b5563' } : {}}
                  />
                </div>

                {/* Dual-Course / Multi-Course Balance Calculation Layout */}
                {selectedStudent && studentCourseOptions.length > 0 && (
                  <div className="fld full" style={{ padding: 0, margin: '4px 0 14px' }}>
                    <div style={{
                      background: isBulkPayment ? 'linear-gradient(135deg, #eff6ff, #f8fafc)' : '#f8fafc',
                      border: `1.5px solid ${isBulkPayment ? '#93c5fd' : '#cbd5e1'}`,
                      borderRadius: '12px',
                      padding: '16px 20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>📚 Course Fee Ledger &amp; Allocation</span>
                            {isBulkPayment && (
                              <span style={{ background: '#2563eb', color: '#fff', fontSize: '10px', padding: '1px 7px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
                                Dual-Course Bulk
                              </span>
                            )}
                          </span>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {isBulkPayment 
                              ? `All ${studentCourseOptions.length} active courses programmatically enabled simultaneously for ledger calculation.` 
                              : `Singular course active: Ledger targeted specifically to ${selectedCourse || 'chosen course'}.`}
                          </div>
                        </div>
                        <div>
                          {isBulkPayment ? (
                            <span style={{ background: '#dbeafe', color: '#1e40af', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, border: '1px solid #bfdbfe' }}>
                              ⚡ Dual / Multi-Course Active ({studentCourseOptions.length})
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCourse('ALL_COURSES');
                                setBatch('All Enrolled Courses (Bulk Payment)');
                                setSelectedEnrollmentId('BULK');
                              }}
                              style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', cursor: 'pointer', fontWeight: 700 }}
                            >
                              Switch to Bulk All Courses
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Calculation rows for all active courses assigned to this student */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {studentCourseOptions.map((opt, idx) => {
                          const isRowActive = isBulkPayment || selectedCourse === opt.course;
                          const rowTargetFee = courseFeeDues[opt.course] !== undefined ? courseFeeDues[opt.course] : getCourseTargetFee(opt.course);
                          return (
                            <div
                              key={opt.id || opt.enrollmentId || idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 16px',
                                borderRadius: '10px',
                                background: isRowActive ? '#ffffff' : '#f8fafc',
                                border: isRowActive ? '1.5px solid #3b82f6' : '1px solid #e2e8f0',
                                boxShadow: isRowActive ? '0 2px 6px rgba(59, 130, 246, 0.08)' : 'none',
                                opacity: isRowActive ? 1 : 0.65,
                                transition: 'all 0.2s',
                                flexWrap: 'wrap',
                                gap: '10px'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{
                                  width: '32px', height: '32px', borderRadius: '8px',
                                  background: isRowActive ? '#dbeafe' : '#f1f5f9',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: isRowActive ? '#1e40af' : '#94a3b8', fontSize: '14px', fontWeight: 800
                                }}>
                                  {idx + 1}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, color: isRowActive ? '#0f172a' : '#64748b', fontSize: '13.5px' }}>
                                    {opt.course}
                                    <span style={{ marginLeft: '8px', fontSize: '11px', padding: '2px 7px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                                      {opt.status || 'Active'}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                    Enrollment: <span style={{ fontFamily: 'monospace', color: '#475569' }}>{opt.enrollmentId || `ENR-${selectedStudent.studentId}-${idx+1}`}</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Targeted Ledger Due</div>
                                  <div style={{ fontWeight: 800, fontSize: '15px', color: isRowActive ? '#1d4ed8' : '#64748b' }}>
                                    ₹{rowTargetFee.toLocaleString('en-IN')}
                                  </div>
                                </div>

                                <div>
                                  {isRowActive ? (
                                    <span style={{
                                      background: '#ecfdf5', color: '#047857',
                                      border: '1px solid #a7f3d0', padding: '5px 10px',
                                      borderRadius: '6px', fontSize: '11.5px', fontWeight: 700,
                                      display: 'inline-flex', alignItems: 'center', gap: '4px'
                                    }}>
                                      {isBulkPayment ? '✓ Included in Bulk' : '✓ Active'}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedCourse(opt.course);
                                        setBatch(opt.course);
                                        setSelectedEnrollmentId(opt.enrollmentId || '');
                                      }}
                                      style={{
                                        border: '1px solid #cbd5e1', background: '#ffffff',
                                        color: '#475569', padding: '5px 10px', borderRadius: '6px',
                                        fontSize: '11.5px', cursor: 'pointer', fontWeight: 600
                                      }}
                                    >
                                      Select this course
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Subtotal ledger bar */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '14px',
                        paddingTop: '12px',
                        borderTop: '1px dashed #cbd5e1',
                        fontSize: '13px'
                      }}>
                        <span style={{ color: '#334155', fontWeight: 700 }}>
                          {isBulkPayment 
                            ? `Total Ledger Invoice Configuration (${studentCourseOptions.length} Active Courses Combined):` 
                            : `Singular Active Course Invoice Configuration:`}
                        </span>
                        <span style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a' }}>
                          ₹{Number(totalCourseFeesDue).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Particulars Breakdown Table — with UPI/Online column */}
                <div className="fld full fee-breakdown-field">
                  <span className="field-label">Fee particulars breakdown</span>
                  <div className="fee-breakdown-wrap">
                    <table className="fee-breakdown">
                      <thead>
                        <tr>
                          <th scope="col">Particulars</th>
                          <th scope="col">Cash (₹)</th>
                          <th scope="col">Cheque (₹)</th>
                          <th scope="col">UPI / Online (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {FEE_ITEMS.map(([key, label]) => (
                          <tr key={key} className={key === 'others' ? 'particulars-row-others' : ''}>
                            <th scope="row" style={{ verticalAlign: key === 'others' ? 'top' : 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontWeight: 600 }}>{label}</span>
                                {key === 'others' && (
                                  <input
                                    id="others-payment-description"
                                    className="input"
                                    type="text"
                                    placeholder="Enter payment description (e.g., Transport Fee, Exam Fee, ID Card Fee)"
                                    value={othersDescription}
                                    onChange={(e) => setOthersDescription(e.target.value)}
                                    style={{
                                      fontSize: '0.8125rem',
                                      fontWeight: 'normal',
                                      padding: '7px 10px',
                                      width: '100%',
                                      minWidth: '240px',
                                      color: 'var(--txt)',
                                      backgroundColor: 'var(--bg-elevated, var(--card-bg, #fff))',
                                      border: '1px solid var(--border)',
                                      borderRadius: '6px'
                                    }}
                                  />
                                )}
                              </div>
                            </th>
                            <td style={{ verticalAlign: key === 'others' ? 'top' : 'middle' }}>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={breakdown[key]?.cash || 0}
                                onChange={(e) => handleBreakdownChange(key, 'cash', e.target.value)}
                              />
                            </td>
                            <td style={{ verticalAlign: key === 'others' ? 'top' : 'middle' }}>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={breakdown[key]?.cheque || 0}
                                onChange={(e) => handleBreakdownChange(key, 'cheque', e.target.value)}
                              />
                            </td>
                            <td style={{ verticalAlign: key === 'others' ? 'top' : 'middle' }}>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={breakdown[key]?.online || 0}
                                onChange={(e) => handleBreakdownChange(key, 'online', e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <th scope="row">Total</th>
                          <td>₹{totals.cash.toLocaleString("en-IN")}</td>
                          <td>₹{totals.cheque.toLocaleString("en-IN")}</td>
                          <td>₹{totals.online.toLocaleString("en-IN")}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Financial Calculation Summary Fields Segment directly below particulars breakdown and above Notes */}
                <div className="fld full" style={{ padding: 0, margin: '14px 0 10px' }}>
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                      {/* Metric 1: Total Course Fees Due (₹) */}
                      <div style={{
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '14px 16px'
                      }}>
                        <label
                          htmlFor="summary-total-course-fees-due"
                          style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                        >
                          Total Course Fees Due (₹)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#1e293b', marginRight: '6px' }}>₹</span>
                          <input
                            id="summary-total-course-fees-due"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={totalCourseFeesDue}
                            onChange={(e) => setTotalCourseFeesDue(e.target.value)}
                            style={{
                              width: '100%',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              outline: 'none',
                              background: '#ffffff',
                              fontWeight: 800,
                              fontSize: '20px',
                              color: '#1e293b',
                              padding: '6px 10px'
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                          Enter total course fee due amount
                        </div>
                      </div>

                      {/* Metric 2: Net Payment Received (₹) */}
                      <div style={{
                        background: '#ffffff',
                        border: '1.5px solid #38bdf8',
                        borderRadius: '10px',
                        padding: '14px 16px'
                      }}>
                        <label
                          htmlFor="summary-net-payment-received"
                          style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                        >
                          Net Payment Received (₹)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#0284c7', marginRight: '6px' }}>₹</span>
                          <input
                            id="summary-net-payment-received"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={netPaymentReceived}
                            onChange={(e) => setNetPaymentReceived(e.target.value)}
                            style={{
                              width: '100%',
                              border: '1px solid #7dd3fc',
                              borderRadius: '6px',
                              outline: 'none',
                              background: '#ffffff',
                              fontWeight: 800,
                              fontSize: '20px',
                              color: '#0284c7',
                              padding: '6px 10px'
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                          {parseFloat(netPaymentReceived) > 0 ? (
                            <span style={{ fontStyle: 'italic' }}>{numberToIndianWords(parseFloat(netPaymentReceived))}</span>
                          ) : (
                            'Enter net payment received amount'
                          )}
                        </div>
                      </div>

                      {/* Metric 3: Outstanding Balance Remaining (₹) with Condition Logic */}
                      <div style={{
                        background: outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 ? '#f0fdf4' : '#ffffff',
                        border: `1.5px solid ${outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 ? '#86efac' : '#cbd5e1'}`,
                        borderRadius: '10px',
                        padding: '14px 16px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <label
                            htmlFor="summary-outstanding-balance"
                            style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 ? '#15803d' : '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                          >
                            Outstanding Balance Remaining (₹)
                          </label>
                          {outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 && (
                            <span style={{
                              background: '#dcfce7',
                              color: '#15803d',
                              border: '1px solid #86efac',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              ✓ Balance Settled / Nil
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', marginTop: '6px' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 ? '#166534' : '#b45309', marginRight: '6px' }}>₹</span>
                          <input
                            id="summary-outstanding-balance"
                            type="number"
                            min="0"
                            step="any"
                            placeholder="0"
                            value={outstandingBalance}
                            onChange={(e) => setOutstandingBalance(e.target.value)}
                            style={{
                              width: '100%',
                              border: `1px solid ${outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 ? '#86efac' : '#cbd5e1'}`,
                              borderRadius: '6px',
                              outline: 'none',
                              background: '#ffffff',
                              fontWeight: 800,
                              fontSize: '20px',
                              color: outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 ? '#166534' : '#b45309',
                              padding: '6px 10px'
                            }}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 ? '#16a34a' : '#78350f', marginTop: '6px', fontWeight: 500 }}>
                          {outstandingBalance !== '' && parseFloat(outstandingBalance) === 0 ? (
                            '✓ Total ledger cleared in full. No outstanding balance.'
                          ) : (
                            'Enter outstanding balance remaining amount'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="fld full" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', padding: 0 }}>
                  <div className="fld" style={{ margin: 0 }}>
                    <label htmlFor="fee-date">Payment date</label>
                    <input
                      className="input"
                      id="fee-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </div>

                  <div className="fld" style={{ margin: 0 }}>
                    <label htmlFor="fee-notes">Notes</label>
                    <input
                      className="input"
                      id="fee-notes"
                      placeholder="e.g. First installment, admission fee"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn" type="button" onClick={handleClearForm}>
                Clear
              </button>
              <button
                className="btn primary"
                type="submit"
                disabled={savingPayment}
              >
                {savingPayment ? (editingPayment ? 'Updating…' : 'Saving…') : (editingPayment ? 'Update payment' : 'Save payment')}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 3. Payment History Tab */}
      {feeTab === 'history' && (
        <section>
          {hasDateFilter && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '10px 18px',
                borderRadius: '8px',
                marginBottom: '16px',
                fontSize: '0.88rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: '#1e40af' }}>Active Date Filter:</span>
                <span style={{ color: '#1e293b' }}>
                  Showing collections for <b>{rangeLabel}</b>
                </span>
                <span style={{ color: '#64748b', fontSize: '0.82rem' }}>
                  ({displayedHistoryFees.length} {displayedHistoryFees.length === 1 ? 'record' : 'records'} · Total: ₹{displayedHistoryFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0).toLocaleString('en-IN')})
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearDateFilter}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#2563eb',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontSize: '0.84rem'
                }}
              >
                Reset to all dates ✕
              </button>
            </div>
          )}

          <div className="card section">
            <div className="card-head">
              <div>
                <h3>Payment history</h3>
                <p>
                  {hasDateFilter
                    ? `Fee payments recorded for ${rangeLabel}`
                    : "All fee payments recorded, newest first."}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {/* Real-time search input for Payment History */}
                <div className="search" style={{ margin: 0, minWidth: '220px', maxWidth: '320px' }}>
                  <span className="si"><Icon name="search" size={16} /></span>
                  <input
                    className="input"
                    type="search"
                    placeholder="Search student, course, or receiver..."
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    style={{ height: '36px', fontSize: '0.84rem' }}
                    autoComplete="off"
                  />
                </div>

                {hasDateFilter && (
                  <button
                    className="btn sm"
                    type="button"
                    onClick={handleClearDateFilter}
                    style={{ color: '#b91c1c', borderColor: '#fca5a5' }}
                  >
                    Clear Filter ✕
                  </button>
                )}
                <button
                  className="btn"
                  type="button"
                  aria-label="Export CSV"
                  title="Export CSV"
                  onClick={handleExportFeesCSV}
                >
                  <span className="ic"><Icon name="download" size={18} /></span>
                </button>
              </div>
            </div>

            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr>
                    <SortableTh colKey="studentName" label="Student" sortKey={historySortKey} sortDirection={historySortDir} onSort={handleHistorySort} />
                    <SortableTh colKey="amount" label="Amount" sortKey={historySortKey} sortDirection={historySortDir} onSort={handleHistorySort} />
                    <SortableTh colKey="mode" label="Mode" sortKey={historySortKey} sortDirection={historySortDir} onSort={handleHistorySort} />
                    <SortableTh colKey="paymentDate" label="Date" sortKey={historySortKey} sortDirection={historySortDir} onSort={handleHistorySort} />
                    <SortableTh colKey="receivedBy" label="Received by" sortKey={historySortKey} sortDirection={historySortDir} onSort={handleHistorySort} />
                    <SortableTh colKey="notes" label="Notes" sortKey={historySortKey} sortDirection={historySortDir} onSort={handleHistorySort} />
                    <th scope="col" style={{ minWidth: '320px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="7">
                        <div className="skel" style={{ height: '160px' }} />
                      </td>
                    </tr>
                  ) : displayedHistoryFees.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="empty">
                          <div className="ei"><Icon name="fee" size={24} /></div>
                          <b>
                            {historySearchQuery.trim()
                              ? `No payments found matching "${historySearchQuery}"`
                              : `No payments recorded ${hasDateFilter ? 'in this date range' : 'yet'}`}
                          </b>
                          <span>
                            {historySearchQuery.trim()
                              ? 'Try searching by a different student name, course, or receiver.'
                              : (hasDateFilter
                                ? 'Try picking another date range or clear the filter.'
                                : 'Record your first fee payment using the Record Payment tab.')}
                          </span>
                          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            {historySearchQuery.trim() && (
                              <button
                                type="button"
                                className="btn sm"
                                onClick={() => setHistorySearchQuery('')}
                              >
                                Clear Search
                              </button>
                            )}
                            {hasDateFilter && (
                              <button
                                type="button"
                                className="btn primary sm"
                                onClick={handleClearDateFilter}
                              >
                                Clear Date Filter
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    displayedHistoryFees.map((f) => (
                      <tr key={f.id}>
                        <td>
                          <b>{f.studentName || "Student"}</b>
                          {f.course ? <small style={{ display: 'block', color: 'var(--muted)', fontSize: '0.8rem' }}>{f.course}</small> : null}
                        </td>
                        <td><strong>₹{Number(f.amount || 0).toLocaleString("en-IN")}</strong></td>
                        <td>
                          <span className={`pill ${String(f.mode || '').toLowerCase().includes('upi') ? 's-new' : String(f.mode || '').toLowerCase().includes('cash') ? 's-teacher' : 's-counselor'}`} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                            {f.mode}
                          </span>
                        </td>
                        <td>{fmtDate(f.paymentDate)}</td>
                        <td>{f.receivedBy || "–"}</td>
                        <td>
                          {f.othersDescription || f.receiptDetails?.othersDescription ? (
                            <div style={{ marginBottom: f.notes ? '4px' : 0 }}>
                              <span className="pill s-confirmed" style={{ fontSize: '0.75rem', padding: '1px 7px', display: 'inline-block' }}>
                                For: {f.othersDescription || f.receiptDetails?.othersDescription}
                              </span>
                            </div>
                          ) : null}
                          <span>{f.notes || (!f.othersDescription && !f.receiptDetails?.othersDescription ? "–" : "")}</span>
                        </td>
                        <td className="payment-actions-cell">
                          <div className="payment-actions-group">
                            <button
                              className="btn sm"
                              type="button"
                              title="Edit payment"
                              onClick={() => handleStartEditPayment(f)}
                            >
                              <span className="ic"><Icon name="edit" size={14} /></span>
                              <span>Edit</span>
                            </button>
                            <button
                              className="btn sm danger"
                              type="button"
                              title="Delete payment record"
                              onClick={() => onDeletePayment(f.id)}
                            >
                              <span className="ic"><Icon name="trash" size={14} /></span>
                              <span>Delete</span>
                            </button>
                            <button
                              className="btn sm btn-issue"
                              type="button"
                              title="Issue printable receipt"
                              aria-label="Issue printable receipt"
                              onClick={() => handleIssueReceipt(f.id, f)}
                            >
                              <span className="ic"><Icon name="receipt" size={15} /></span>
                            </button>
                            <button
                              className="btn sm btn-whatsapp-send"
                              type="button"
                              title={f.studentPhone ? `Send receipt to WhatsApp (${f.studentPhone})` : "Send receipt to phone number via WhatsApp"}
                              aria-label="Send receipt to WhatsApp"
                              onClick={() => handleSendToNumber(f)}
                            >
                              <span className="ic-pair">
                                <Icon name="send" size={14} />
                                <Icon name="whatsapp" size={15} />
                              </span>
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
        </section>
      )}

      {/* 4. Issue Receipt Tab */}
      {feeTab === 'receipt' && (
        <section>
          <div className="card section fee-receipt-tool">
            <div className="card-head">
              <div>
                <h3>Issue a fee receipt</h3>
                <p>Select a payment to print or download its official formatted receipt.</p>
              </div>
            </div>

            <div className="fee-receipt-actions">
              <div className="fld">
                <label htmlFor="receiptPayment">Payment record</label>
                <SearchablePaymentSelect
                  id="receiptPayment"
                  name="receiptPayment"
                  payments={historyFees}
                  students={students}
                  enquiries={enquiries}
                  selectedId={selectedReceiptPaymentId}
                  value={selectedReceiptPaymentId}
                  onSelect={(id) => setSelectedReceiptPaymentId(id)}
                  onChange={(id) => setSelectedReceiptPaymentId(id)}
                  placeholder="Type student name, contact number, or receipt ID..."
                />
              </div>

              <button
                className="btn primary"
                type="button"
                id="issueReceiptBtn"
                onClick={() => handleIssueReceipt(selectedReceiptPaymentId)}
              >
                Issue Receipt
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Outstanding Dues Breakdown Modal */}
      {showDuesModal && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target.classList.contains('overlay')) setShowDuesModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dues-modal-title"
        >
          <div
            className="modal"
            style={{
              maxWidth: '840px',
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
              overflow: 'hidden'
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                borderBottom: '1px solid var(--line)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    background: '#fef2f2',
                    color: '#dc2626',
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0
                  }}
                >
                  <Icon name="alert" size={20} />
                </span>
                <div>
                  <h3 id="dues-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                    Outstanding Dues Breakdown
                  </h3>
                  <small style={{ color: 'var(--muted)', fontSize: '0.84rem' }}>
                    {pendingDuesList.length} students with pending balances · Total: ₹{totalOutstandingDues.toLocaleString('en-IN')}
                  </small>
                </div>
              </div>
              <button
                className="icon-btn"
                type="button"
                onClick={() => setShowDuesModal(false)}
                title="Close modal"
                aria-label="Close"
              >
                <Icon name="x" size={18} />
              </button>
            </header>

            {/* Quick search input */}
            <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--line)', background: 'var(--surface, #f8fafc)' }}>
              <div className="search" style={{ margin: 0, width: '100%' }}>
                <span className="si"><Icon name="search" size={16} /></span>
                <input
                  className="input"
                  type="search"
                  placeholder="Search by student name, phone number, or course..."
                  value={duesSearch}
                  onChange={(e) => setDuesSearch(e.target.value)}
                  style={{ width: '100%', height: '36px', fontSize: '0.86rem' }}
                />
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowY: 'auto', flex: 1, minHeight: '180px' }}>
              <div className="tbl-scroll">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--line)' }}>
                      <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Student Name
                      </th>
                      <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Phone Number
                      </th>
                      <th style={{ padding: '12px 18px', textAlign: 'left', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Course
                      </th>
                      <th style={{ padding: '12px 18px', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Pending Amount
                      </th>
                      <th style={{ padding: '12px 18px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPendingDues.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--muted)' }}>
                          No students found matching "{duesSearch}"
                        </td>
                      </tr>
                    ) : (
                      filteredPendingDues.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--line)' }}>
                          <td style={{ padding: '12px 18px' }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.92rem' }}>
                              {item.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                              ID: {item.studentId}
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.88rem', color: '#334155', fontWeight: 600 }}>{item.phone}</span>
                              {item.phone && item.phone !== '–' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenWhatsAppModalFromDues(item)}
                                  title="Send WhatsApp Reminder"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '26px',
                                    height: '26px',
                                    borderRadius: '50%',
                                    background: '#25D366',
                                    color: '#fff',
                                    fontSize: '12px',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Icon name="whatsapp" size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: '12px 18px' }}>
                            <span
                              style={{
                                background: '#f1f5f9',
                                color: '#334155',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '0.82rem',
                                fontWeight: 600,
                                display: 'inline-block'
                              }}
                            >
                              {item.course}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                background: '#fef2f2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                padding: '4px 10px',
                                borderRadius: '8px',
                                fontWeight: 800,
                                fontSize: '0.92rem'
                              }}
                            >
                              ₹{Number(item.balance || 0).toLocaleString('en-IN')}
                            </span>
                          </td>
                          <td style={{ padding: '12px 18px', textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn sm primary"
                              onClick={() => handleCollectStudentDue(item)}
                              title="Record payment for this student"
                              style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', padding: '6px 12px' }}
                            >
                              Collect Fee
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <footer
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 24px',
                borderTop: '1px solid var(--line)',
                background: '#fff'
              }}
            >
              <div style={{ fontSize: '0.86rem', color: '#475569' }}>
                Total Pending Dues: <b style={{ color: '#b91c1c', fontSize: '1rem', marginLeft: '4px' }}>₹{totalOutstandingDues.toLocaleString('en-IN')}</b>
                <span style={{ color: '#94a3b8', marginLeft: '8px' }}>({pendingDuesList.length} students)</span>
              </div>
              <button
                className="btn"
                type="button"
                onClick={() => setShowDuesModal(false)}
              >
                Close
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
