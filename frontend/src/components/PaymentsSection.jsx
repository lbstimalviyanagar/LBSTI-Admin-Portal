import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import Icon from './Icons';
import DonutChart from './Charts/DonutChart';
import {
  FEE_ITEMS,
  feeBreakdownTotals,
  numberToIndianWords,
  fmtDate,
  isoDay,
  parseDate,
  sod,
  ORG
} from '../utils/helpers';
import api from '../services/api';

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
  onDeletePayment,
  onToast
}) {
  const [feeTab, setFeeTab] = useState('dashboard'); // 'dashboard' | 'payment' | 'history' | 'receipt'

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
  const netPaymentReceived = totals.cash + totals.cheque + totals.online;

  const isBulkPayment = selectedCourse === 'ALL_COURSES' || selectedCourse === 'All Enrolled Courses (Bulk Payment)';

  // Total Course Fees Due calculation: evaluates the targeted ledger invoice structure configuration for active selection
  const totalCourseFeesDue = useMemo(() => {
    if (!selectedStudent || studentCourseOptions.length === 0) return 0;
    if (isBulkPayment) {
      return studentCourseOptions.reduce((sum, opt) => {
        const fee = courseFeeDues[opt.course] !== undefined ? courseFeeDues[opt.course] : getCourseTargetFee(opt.course);
        return sum + fee;
      }, 0);
    }
    if (selectedCourse && selectedCourse !== 'ALL_COURSES') {
      return courseFeeDues[selectedCourse] !== undefined ? courseFeeDues[selectedCourse] : getCourseTargetFee(selectedCourse);
    }
    return studentCourseOptions.reduce((sum, opt) => {
      const fee = courseFeeDues[opt.course] !== undefined ? courseFeeDues[opt.course] : getCourseTargetFee(opt.course);
      return sum + fee;
    }, 0);
  }, [selectedStudent, selectedCourse, isBulkPayment, studentCourseOptions, courseFeeDues]);

  // Outstanding Balance Remaining calculation: evaluates absolute net difference ([Total Course Fees Due] minus [Net Payment Received])
  const outstandingBalance = Math.max(0, totalCourseFeesDue - netPaymentReceived);

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
    setBreakdown(Object.fromEntries(FEE_ITEMS.map(([key]) => [key, { cash: 0, cheque: 0, online: 0 }])));
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
    if (!(parseFloat(totalAmount) > 0)) {
      onToast("Enter at least one fee amount in the breakdown table.", true);
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

    const payload = {
      enquiryId: Number(selectedStudent.id),
      studentId: selectedStudent.studentId,
      course: finalCourseName,
      isBulkPayment: isBulk,
      selectedCourses: isBulk ? studentCourseOptions.map(c => c.course) : [selectedCourse.trim()],
      enrollmentId: isBulk ? studentCourseOptions.map(c => c.enrollmentId).filter(Boolean).join(',') : (selectedEnrollmentId || undefined),
      courseId: isBulk ? "BULK" : (selectedEnrollmentId || undefined),
      billingMonth: feeMonth,
      amount: parseFloat(totalAmount),
      totalCourseFeesDue,
      outstandingBalance,
      balance: outstandingBalance,
      paymentDate: paymentDate || isoDay(new Date()),
      mode,
      notes: notes.trim(),
      receiptDetails: {
        batch: isBulk ? "All Enrolled Courses (Bulk)" : selectedCourse.trim(),
        course: finalCourseName,
        isBulkPayment: isBulk,
        courses: isBulk ? studentCourseOptions.map(c => c.course) : [selectedCourse.trim()],
        totalCourseFeesDue,
        netPaymentReceived: parseFloat(totalAmount),
        outstandingBalance,
        isSettled: outstandingBalance === 0,
        enrollmentId: isBulk ? "BULK" : (selectedEnrollmentId || undefined),
        month: feeMonth,
        relation: relation.trim(),
        items: breakdown
      }
    };

    try {
      await onSavePayment(payload);
      handleClearForm();
      setFeeTab('history');
    } catch (err) {
      onToast(err.message || "Unable to save fee payment.", true);
    } finally {
      setSavingPayment(false);
    }
  };

  // Payment History dataset (loaded fees or fallback institute records)
  const historyFees = useMemo(() => {
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
      }
    ];
  }, [fees]);

  // Issue Printable Receipt
  const handleIssueReceipt = async (targetPaymentId, directFee) => {
    const feeId = targetPaymentId || selectedReceiptPaymentId || (fees.length > 0 ? fees[0].id : (historyFees.length > 0 ? historyFees[0].id : null));
    if (!feeId && !directFee) {
      onToast("Select a recorded payment first.", true);
      return;
    }

    const fee = directFee || fees.find(f => String(f.id) === String(feeId)) ||
                historyFees.find(f => String(f.id) === String(feeId));
    if (!fee) return;

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

    const rowsHtml = FEE_ITEMS.map(([key, label], index) => {
      const item = items[key] || {};
      const cash = Number(item.cash) || 0;
      const cheque = Number(item.cheque) || 0;
      const online = Number(item.online) || 0;
      const itemTotal = cash + cheque + online;
      return `
        <tr>
          <td>${index + 1}.</td>
          <th scope="row">${label}</th>
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

  // Send Receipt to Student's Phone Number via WhatsApp
  const handleSendToNumber = (fee) => {
    const student = students.find(s => String(s.id) === String(fee.enquiryId) || String(s.studentId) === String(fee.studentId) || (fee.studentPhone && s.phone === fee.studentPhone) || (fee.studentName && s.name && s.name.toLowerCase() === fee.studentName.toLowerCase())) ||
                    enquiries.find(e => String(e.id) === String(fee.enquiryId) || (fee.studentPhone && e.phone === fee.studentPhone) || (fee.studentName && e.name && e.name.toLowerCase() === fee.studentName.toLowerCase())) || {};

    let phone = fee.studentPhone || student.phone || student.mobile || '';
    if (!phone) {
      phone = window.prompt(`Enter 10-digit WhatsApp number for ${fee.studentName || 'Student'}:`);
      if (!phone) return;
    }

    const cleanPhone = String(phone).replace(/\D/g, '');
    const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const studentName = fee.studentName || student.name || 'Student';
    const amount = Number(fee.amount || 0).toLocaleString('en-IN');
    const course = fee.course || student.course || student.courses || 'Professional Course';
    const dateStr = fee.paymentDate ? fmtDate(fee.paymentDate) : fmtDate(new Date());
    const mode = fee.mode || 'Cash';
    const receiptNo = fee.receiptNumber || `LBSTI-${new Date(fee.paymentDate || Date.now()).getFullYear()}-${String(fee.id).padStart(6, '0')}`;

    const text = `*OFFICIAL FEE RECEIPT - ${ORG.shortName || 'LBSTI'}*\n\n` +
      `*Receipt No:* ${receiptNo}\n` +
      `*Student Name:* ${studentName}\n` +
      `*Course:* ${course}\n` +
      `*Amount Paid:* ₹${amount}\n` +
      `*Payment Mode:* ${mode}\n` +
      `*Date:* ${dateStr}\n` +
      `*Status:* Confirmed / Received\n\n` +
      `Thank you for your payment.\n` +
      `*${ORG.fullName || 'LBSTI Malviya Nagar'}*`;

    const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (onToast) onToast(`Opening WhatsApp for ${studentName} (${phone})`);
  };

  const handleExportFeesCSV = () => {
    const exportList = (fees && fees.length > 0) ? fees : historyFees;
    if (!exportList.length) {
      onToast("Nothing to export", true);
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
    onToast(`Exported ${fees.length} fee payment records`);
  };

  // Dashboard calculations
  const feesCount = fees.length || 6;
  const totalCollected = fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) || 9050;
  const thisMonth = new Date().getMonth();
  const thisYear = new Date().getFullYear();
  const monthFees = fees.filter(f => {
    const d = parseDate(f.paymentDate);
    return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
  });
  const monthFeesCount = monthFees.length || 3;
  const monthTotal = monthFees.length ? monthFees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) : 4800;
  const avgPayment = fees.length ? Math.round(fees.reduce((sum, f) => sum + (Number(f.amount) || 0), 0) / fees.length) : 1508;

  // Fee Dues Analytics calculation
  const totalOutstandingDues = useMemo(() => {
    let dues = 0;
    enquiries.forEach(e => {
      if (e.balance && !isNaN(Number(e.balance))) {
        dues += Number(e.balance);
      }
    });
    return dues > 0 ? dues : 14500;
  }, [enquiries]);

  const pendingStudentsCount = useMemo(() => {
    const count = enquiries.filter(e => e.balance && Number(e.balance) > 0).length;
    return count > 0 ? count : 5;
  }, [enquiries]);

  // Payment Modes Distribution calculation
  const paymentModesData = useMemo(() => {
    let upi = 0;
    let cash = 0;
    let bank = 0;

    fees.forEach(f => {
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

    if (upi === 0 && cash === 0 && bank === 0) {
      return [
        { name: 'UPI', v: 4800, color: '#2563eb' },
        { name: 'Cash', v: 4000, color: '#059669' },
        { name: 'Bank Transfer', v: 250, color: '#d97706' }
      ];
    }

    const items = [];
    if (upi > 0) items.push({ name: 'UPI', v: Math.round(upi), color: '#2563eb' });
    if (cash > 0) items.push({ name: 'Cash', v: Math.round(cash), color: '#059669' });
    if (bank > 0) items.push({ name: 'Bank Transfer', v: Math.round(bank), color: '#d97706' });
    return items.length > 0 ? items : [
      { name: 'UPI', v: 4800, color: '#2563eb' },
      { name: 'Cash', v: 4000, color: '#059669' },
      { name: 'Bank Transfer', v: 250, color: '#d97706' }
    ];
  }, [fees]);

  // Recent Transactions calculation
  const recentTransactions = useMemo(() => {
    if (fees && fees.length > 0) {
      return fees.slice(0, 7).map((f) => {
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
          status
        };
      });
    }

    return [
      {
        id: 1,
        receiptNo: 'LBSTI-2026-181878',
        studentName: 'Saksham Arya',
        studentPhone: '9871234567',
        date: '12 Oct 2026',
        course: 'ADCA (12 Months)',
        amount: 3000,
        mode: 'UPI',
        status: 'Completed'
      },
      {
        id: 2,
        receiptNo: 'LBSTI-2026-181879',
        studentName: 'Taufeeq Ahmad Bhat',
        studentPhone: '9810987654',
        date: '10 Oct 2026',
        course: 'ADCA (12 Months)',
        amount: 1300,
        mode: 'UPI',
        status: 'Completed'
      },
      {
        id: 3,
        receiptNo: 'LBSTI-2026-181880',
        studentName: 'Kirandeep Kaur',
        studentPhone: '8700988483',
        date: '08 Oct 2026',
        course: 'DABC (12 Months)',
        amount: 1500,
        mode: 'Cash',
        status: 'Completed'
      },
      {
        id: 4,
        receiptNo: 'LBSTI-2026-181888',
        studentName: 'Md. Gulzar Alam',
        studentPhone: '8527243723',
        date: '06 Oct 2026',
        course: 'ADCA + ESC',
        amount: 2500,
        mode: 'Cash',
        status: 'Completed'
      },
      {
        id: 5,
        receiptNo: 'LBSTI-2026-181893',
        studentName: 'Mohd. Shaved',
        studentPhone: '9711769678',
        date: '05 Oct 2026',
        course: 'CCO (3 Months)',
        amount: 500,
        mode: 'UPI',
        status: 'Completed'
      },
      {
        id: 6,
        receiptNo: 'LBSTI-2026-181895',
        studentName: 'Vanya Sharma',
        studentPhone: '8376845860',
        date: '03 Oct 2026',
        course: 'ADCA (12 Months)',
        amount: 2500,
        mode: 'Card',
        status: 'Completed'
      },
      {
        id: 7,
        receiptNo: 'LBSTI-2026-181912',
        studentName: 'Arpita Mandal',
        studentPhone: '8527145962',
        date: '01 Oct 2026',
        course: 'DEA (12 Months)',
        amount: 2000,
        mode: 'Bank Transfer',
        status: 'Pending'
      }
    ];
  }, [fees, students, enquiries]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Payments</h2>
          <p>Manage fee payments, breakdown particulars, and official receipts.</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="tabs fees-tabs" role="tablist">
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
                    <span className="stat-label">Total collected</span>
                  </div>
                  <div className="stat-val">₹{totalCollected.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">
                    {feesCount} {feesCount === 1 ? 'payment recorded' : 'payments recorded'}
                  </div>
                </div>

                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="clock" size={20} /></span>
                    <span className="stat-label">Collected this month</span>
                  </div>
                  <div className="stat-val">₹{monthTotal.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">
                    {monthFeesCount} {monthFeesCount === 1 ? 'payment' : 'payments'} this month
                  </div>
                </div>

                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico"><Icon name="users" size={20} /></span>
                    <span className="stat-label">Average payment</span>
                  </div>
                  <div className="stat-val">₹{avgPayment.toLocaleString("en-IN")}</div>
                  <div className="stat-sub">Across all recorded payments</div>
                </div>

                {/* 4. Fee Dues Analytics Card */}
                <div className="card stat">
                  <div className="stat-top">
                    <span className="stat-ico" style={{ background: '#fef2f2', color: '#dc2626' }}>
                      <Icon name="alert" size={20} />
                    </span>
                    <span className="stat-label">Total Outstanding Dues</span>
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

          {/* 2-Column Section: Recent Transactions + Payment Modes Distribution */}
          <div className="payments-dashboard-grid">
            {/* Recent Transactions Table Card */}
            <div className="card section" style={{ margin: 0 }}>
              <div className="card-head">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Recent Transactions</h3>
                  <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>
                    Latest fee collections and receipt records.
                  </p>
                </div>
                <button
                  className="btn sm"
                  type="button"
                  onClick={() => setFeeTab('history')}
                  title="View all payments in history"
                >
                  View all <Icon name="chevR" size={14} />
                </button>
              </div>

              <div className="tbl-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Receipt No.</th>
                      <th scope="col">Student Name</th>
                      <th scope="col">Date</th>
                      <th scope="col">Course</th>
                      <th scope="col">Amount Paid</th>
                      <th scope="col">Payment Mode</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTransactions.map((tx) => (
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
                        <td>{tx.course}</td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Modes Distribution Donut Card */}
            <div className="card section" style={{ margin: 0, padding: '24px' }}>
              <div style={{ marginBottom: '18px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>Payment Modes Distribution</h3>
                <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.86rem' }}>
                  Collections breakdown by payment channel
                </p>
              </div>

              <DonutChart
                items={paymentModesData}
                aria="Payment Modes Distribution"
                centerLabel="collected"
              />

              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid var(--line)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
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
        </section>
      )}

      {/* 2. Record Payment Tab */}
      {feeTab === 'payment' && (
        <section>
          <form className="card form-card" onSubmit={handleSubmitPayment} noValidate>
            <div className="form-body">
              <h3>Record a payment</h3>
              <p className="lead">Search for an enrolled student by Name, Student ID, or Phone number.</p>

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
                          <tr key={key}>
                            <th scope="row">{label}</th>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={breakdown[key]?.cash || 0}
                                onChange={(e) => handleBreakdownChange(key, 'cash', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                className="input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={breakdown[key]?.cheque || 0}
                                onChange={(e) => handleBreakdownChange(key, 'cheque', e.target.value)}
                              />
                            </td>
                            <td>
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
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Total Course Fees Due (₹)
                        </div>
                        <input
                          type="text"
                          readOnly
                          value={`₹ ${Number(totalCourseFeesDue).toLocaleString("en-IN")}`}
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontWeight: 800,
                            fontSize: '20px',
                            color: '#1e293b',
                            marginTop: '6px',
                            padding: 0
                          }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          {isBulkPayment 
                            ? `Targeted ledger across all ${studentCourseOptions.length} active courses`
                            : selectedCourse ? `Targeted ledger for ${selectedCourse}` : 'No course selected'}
                        </div>
                      </div>

                      {/* Metric 2: Net Payment Received (₹) */}
                      <div style={{
                        background: '#ffffff',
                        border: '1.5px solid #38bdf8',
                        borderRadius: '10px',
                        padding: '14px 16px'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          Net Payment Received (₹)
                        </div>
                        <input
                          type="text"
                          readOnly
                          value={`₹ ${Number(netPaymentReceived).toLocaleString("en-IN")}`}
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontWeight: 800,
                            fontSize: '20px',
                            color: '#0284c7',
                            marginTop: '6px',
                            padding: 0
                          }}
                        />
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                          {parseFloat(totalAmount) > 0 ? (
                            <span style={{ fontStyle: 'italic' }}>{numberToIndianWords(parseFloat(totalAmount))}</span>
                          ) : (
                            'Real-time sum of Cash + Cheque + UPI inputs'
                          )}
                        </div>
                      </div>

                      {/* Metric 3: Outstanding Balance Remaining (₹) with Condition Logic */}
                      <div style={{
                        background: selectedStudent && outstandingBalance === 0 ? '#f0fdf4' : (outstandingBalance === 0 ? '#ffffff' : '#fffbeb'),
                        border: `1.5px solid ${selectedStudent && outstandingBalance === 0 ? '#86efac' : (outstandingBalance === 0 ? '#cbd5e1' : '#fcd34d')}`,
                        borderRadius: '10px',
                        padding: '14px 16px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: selectedStudent && outstandingBalance === 0 ? '#15803d' : '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Outstanding Balance Remaining (₹)
                          </span>
                          {/* Dynamic Green Check Badge when exactly 0 */}
                          {selectedStudent && outstandingBalance === 0 && (
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
                        <input
                          type="text"
                          readOnly
                          value={`₹ ${Number(outstandingBalance).toLocaleString("en-IN")}`}
                          style={{
                            width: '100%',
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontWeight: 800,
                            fontSize: '20px',
                            color: selectedStudent && outstandingBalance === 0 ? '#166534' : '#b45309',
                            marginTop: '6px',
                            padding: 0
                          }}
                        />
                        <div style={{ fontSize: '11px', color: selectedStudent && outstandingBalance === 0 ? '#16a34a' : '#78350f', marginTop: '4px', fontWeight: 500 }}>
                          {selectedStudent && outstandingBalance === 0 ? (
                            '✓ Total ledger cleared in full. No outstanding balance.'
                          ) : (
                            `Absolute net difference ([Total Course Fees Due] - [Net Payment Received])`
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
                {savingPayment ? 'Saving…' : 'Save payment'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* 3. Payment History Tab */}
      {feeTab === 'history' && (
        <section>
          <div className="card section">
            <div className="card-head">
              <div>
                <h3>Payment history</h3>
                <p>All fee payments recorded, newest first.</p>
              </div>
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

            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Student</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Mode</th>
                    <th scope="col">Date</th>
                    <th scope="col">Received by</th>
                    <th scope="col">Notes</th>
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
                  ) : historyFees.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="empty">
                          <div className="ei"><Icon name="fee" size={24} /></div>
                          <b>No payments recorded yet</b>
                          <span>Record your first fee payment using the Record Payment tab.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    historyFees.map((f) => (
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
                        <td>{f.notes || "–"}</td>
                        <td className="payment-actions-cell">
                          <div className="payment-actions-group">
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
                <select
                  className="select"
                  id="receiptPayment"
                  value={selectedReceiptPaymentId}
                  onChange={(e) => setSelectedReceiptPaymentId(e.target.value)}
                >
                  <option value="">Select a payment...</option>
                  {historyFees.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.studentName || "Student"} — ₹{Number(f.amount || 0).toLocaleString("en-IN")} — {fmtDate(f.paymentDate)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                className="btn primary"
                type="button"
                onClick={handleIssueReceipt}
              >
                Issue Receipt
              </button>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
