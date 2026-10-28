import React, { useState, useMemo } from "react";
import Icon from "./Icons";
import api from "../services/api";
import { useToast } from "../hooks/useToast";
import { useTableSort } from "../hooks/useTableSort";
import { SortableTh } from "./SortableHeader";
import { SOURCES, COURSES, rangeOf, parseDate } from "../utils/helpers";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'];
const STATUS_COLORS = { "Active": "#0088FE", "Completed": "#00C49F", "Dropped": "#FF8042" };

export default function StudentsSection({ students = [], enrollments = [], loading, onRefresh }) {
  const [tab, setTab] = useState("dashboard");
  const { addToast } = useToast();

  // Search state for Students List tab
  const [studentSearchQuery, setStudentSearchQuery] = useState("");

  // Filter state for Enrollments tab
  const [enrollmentSearchQuery, setEnrollmentSearchQuery] = useState("");
  const [enrollmentCourseFilter, setEnrollmentCourseFilter] = useState("All");
  const [enrollmentSourceFilter, setEnrollmentSourceFilter] = useState("All");
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState("All");
  const [enrollmentDateFilter, setEnrollmentDateFilter] = useState("all");
  const [enrollmentCustomFrom, setEnrollmentCustomFrom] = useState("");
  const [enrollmentCustomTo, setEnrollmentCustomTo] = useState("");

  const clearEnrollmentFilters = () => {
    setEnrollmentSearchQuery("");
    setEnrollmentCourseFilter("All");
    setEnrollmentSourceFilter("All");
    setEnrollmentStatusFilter("All");
    setEnrollmentDateFilter("all");
    setEnrollmentCustomFrom("");
    setEnrollmentCustomTo("");
  };

  // State for new enrollment
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    name: "",
    guardianName: "",
    phone: "",
    email: "",
    course: "",
    remarks: ""
  });
  const [duplicateError, setDuplicateError] = useState("");

  // State for new enrollment
  const [newEnrollment, setNewEnrollment] = useState({
    enrollmentId: "",
    studentId: "",
    doa: "",
    course: "",
    status: "Active"
  });

  const [importing, setImporting] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [editingEnrollment, setEditingEnrollment] = useState(null);

  // Fast student lookup map
  const studentMap = useMemo(() => {
    const map = new Map();
    students.forEach(st => {
      if (st.studentId) map.set(String(st.studentId).toLowerCase(), st);
    });
    return map;
  }, [students]);

  // Filtered students for Students List tab
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery || !studentSearchQuery.trim()) return students;
    const q = studentSearchQuery.toLowerCase().trim();
    return students.filter(st => {
      const idMatch = String(st.studentId || "").toLowerCase().includes(q);
      const nameMatch = String(st.name || "").toLowerCase().includes(q);
      const guardianMatch = String(st.guardianName || "").toLowerCase().includes(q);
      const phoneMatch = String(st.phone || "").toLowerCase().includes(q);
      const emailMatch = String(st.email || "").toLowerCase().includes(q);
      const remarksMatch = String(st.remarks || "").toLowerCase().includes(q);
      return idMatch || nameMatch || guardianMatch || phoneMatch || emailMatch || remarksMatch;
    });
  }, [students, studentSearchQuery]);

  // Unique course options for Enrollments filter
  const enrollmentCourseOptions = useMemo(() => {
    const set = new Set();
    enrollments.forEach(en => {
      if (en.course) set.add(en.course);
    });
    return Array.from(set).sort();
  }, [enrollments]);

  // Filtered enrollments for Enrollments tab
  const filteredEnrollments = useMemo(() => {
    const q = enrollmentSearchQuery.toLowerCase().trim();
    const dateRange = rangeOf(enrollmentDateFilter, enrollmentCustomFrom, enrollmentCustomTo);

    return enrollments.filter(en => {
      // 1. Course filter
      if (enrollmentCourseFilter !== "All" && String(en.course || "").toLowerCase() !== enrollmentCourseFilter.toLowerCase()) {
        return false;
      }

      // 2. Status filter
      if (enrollmentStatusFilter !== "All" && String(en.status || "").toLowerCase() !== enrollmentStatusFilter.toLowerCase()) {
        return false;
      }

      // 3. Source filter (checks enrollment source, or matched student source/remarks)
      const st = studentMap.get(String(en.studentId || "").toLowerCase());
      if (enrollmentSourceFilter !== "All") {
        const sourceVal = String(en.source || st?.source || st?.remarks || "").toLowerCase();
        if (!sourceVal.includes(enrollmentSourceFilter.toLowerCase())) {
          return false;
        }
      }

      // 4. Date range filter
      if (dateRange.start || dateRange.end) {
        const d = parseDate(en.doa) || parseDate(en.createdAt);
        if (!d) return false;
        if (dateRange.start && d < dateRange.start) return false;
        if (dateRange.end && d >= dateRange.end) return false;
      }

      // 5. Search bar query
      if (q) {
        const stName = String(en.studentName || st?.name || "").toLowerCase();
        const stPhone = String(en.phone || st?.phone || "").toLowerCase();
        const enId = String(en.enrollmentId || "").toLowerCase();
        const stId = String(en.studentId || "").toLowerCase();
        const course = String(en.course || "").toLowerCase();
        const combined = `${stName} ${stPhone} ${enId} ${stId} ${course}`;
        if (!combined.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [
    enrollments,
    enrollmentSearchQuery,
    enrollmentCourseFilter,
    enrollmentSourceFilter,
    enrollmentStatusFilter,
    enrollmentDateFilter,
    enrollmentCustomFrom,
    enrollmentCustomTo,
    studentMap
  ]);

  // Sorting state for Students List tab
  const {
    sortKey: studentSortKey,
    sortDirection: studentSortDir,
    handleSort: handleStudentSort,
    sortList: sortStudents
  } = useTableSort({ key: 'studentId', direction: 'asc' });

  const sortedStudents = useMemo(() => {
    return sortStudents(filteredStudents);
  }, [filteredStudents, sortStudents]);

  // Sorting state for Enrollments tab
  const {
    sortKey: enrSortKey,
    sortDirection: enrSortDir,
    handleSort: handleEnrSort,
    sortList: sortEnrollments
  } = useTableSort({ key: 'doa', direction: 'desc' });

  const enrCustomGetters = useMemo(() => ({
    studentName: (en) => en.studentName || studentMap.get(String(en.studentId || '').toLowerCase())?.name || ''
  }), [studentMap]);

  const sortedEnrollments = useMemo(() => {
    return sortEnrollments(filteredEnrollments, enrCustomGetters);
  }, [filteredEnrollments, sortEnrollments, enrCustomGetters]);

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    setDuplicateError("");

    if (!newStudent.name || !newStudent.name.trim()) {
      return addToast("Student Name is required.", true);
    }
    if (!newStudent.course) {
      return addToast("Course Selection is required.", true);
    }

    const cleanName = newStudent.name.trim().toLowerCase();
    const cleanPhone = String(newStudent.phone || "").replace(/\D/g, "");
    const cleanEmail = String(newStudent.email || "").trim().toLowerCase();
    const courseSel = newStudent.course.trim().toLowerCase();

    // Client-side deduplication check
    const existingMatch = students.find(st => {
      const stName = String(st.name || "").trim().toLowerCase();
      const stPhone = String(st.phone || "").replace(/\D/g, "");
      const stEmail = String(st.email || "").trim().toLowerCase();

      const nameMatches = stName === cleanName;
      const phoneMatches = (cleanPhone !== "" && stPhone !== "" && (cleanPhone === stPhone || cleanPhone.endsWith(stPhone) || stPhone.endsWith(cleanPhone)))
                           || (cleanPhone === "" && stPhone === "");
      const emailMatches = (cleanEmail !== "" && stEmail !== "" && cleanEmail === stEmail)
                           || (cleanEmail === "" && stEmail === "");

      return nameMatches && phoneMatches && emailMatches;
    });

    if (existingMatch) {
      // Check if student already enrolled in this exact course
      const isDuplicateEnrollment = enrollments.some(en => 
        String(en.studentId).toLowerCase() === String(existingMatch.studentId).toLowerCase() &&
        String(en.course || "").trim().toLowerCase() === courseSel
      );

      if (isDuplicateEnrollment) {
        const errMsg = `Duplicate entry: Student '${existingMatch.name}' (${existingMatch.studentId}) is already enrolled in ${newStudent.course}.`;
        setDuplicateError(errMsg);
        addToast(errMsg, true);
        return;
      }
    }

    try {
      const res = await api.createStudent({
        ...newStudent,
        studentId: existingMatch ? existingMatch.studentId : (newStudent.studentId || "Autofilled")
      });
      if (res && res.isExistingStudent) {
        addToast(res.message || `Added new course enrollment for student (${res.studentId || existingMatch.studentId})!`);
      } else {
        addToast("Enrollment created successfully!");
      }
      setNewStudent({ studentId: "", name: "", guardianName: "", phone: "", email: "", course: "", remarks: "" });
      setDuplicateError("");
      onRefresh();
    } catch (err) {
      const msg = err.message || "Failed to create enrollment.";
      setDuplicateError(msg);
      addToast(msg, true);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    try {
      await api.updateStudent(editingStudent.id, editingStudent);
      addToast("Student updated successfully!");
      setEditingStudent(null);
      onRefresh();
    } catch (err) {
      addToast(err.message || "Failed to update student.", true);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Delete this student? This will also delete their enrollments.")) return;
    try {
      await api.deleteStudent(id);
      addToast("Student deleted.");
      onRefresh();
    } catch (err) {
      addToast(err.message || "Failed to delete student.", true);
    }
  };

  const handleCreateEnrollment = async (e) => {
    e.preventDefault();
    if (!newEnrollment.enrollmentId || !newEnrollment.studentId) {
      return addToast("Enrollment ID and Student ID are required.", true);
    }
    try {
      await api.createEnrollment(newEnrollment);
      addToast("Enrollment created successfully!");
      setNewEnrollment({ enrollmentId: "", studentId: "", doa: "", course: "", status: "Active" });
      onRefresh();
    } catch (err) {
      addToast(err.message || "Failed to create enrollment.", true);
    }
  };

  const handleUpdateEnrollment = async (e) => {
    e.preventDefault();
    try {
      await api.updateEnrollment(editingEnrollment.id, editingEnrollment);
      addToast("Enrollment updated successfully!");
      setEditingEnrollment(null);
      onRefresh();
    } catch (err) {
      addToast(err.message || "Failed to update enrollment.", true);
    }
  };

  const handleDeleteEnrollment = async (id) => {
    if (!window.confirm("Delete this enrollment?")) return;
    try {
      await api.deleteEnrollment(id);
      addToast("Enrollment deleted.");
      onRefresh();
    } catch (err) {
      addToast(err.message || "Failed to delete enrollment.", true);
    }
  };

  const handleImportCSV = (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target.result;
        const rows = text.split("\n").map(r => r.split(","));
        if (rows.length < 2) throw new Error("File empty or missing headers");
        const headers = rows[0].map(h => h.trim().toLowerCase());
        
        const data = rows.slice(1).filter(r => r.length > 1 && r[0].trim()).map(r => {
          const obj = {};
          headers.forEach((h, i) => {
            if (h === "student id" || h === "student_id") obj.studentId = r[i]?.trim();
            if (h === "name") obj.name = r[i]?.trim();
            if (h === "guardian name" || h === "guardian_name") obj.guardianName = r[i]?.trim();
            if (h === "phone number" || h === "phone") obj.phone = r[i]?.trim();
            if (h === "email") obj.email = r[i]?.trim();
            if (h === "remarks") obj.remarks = r[i]?.trim();

            if (h === "enrollment id" || h === "enrollment_id") obj.enrollmentId = r[i]?.trim();
            if (h === "doa") obj.doa = r[i]?.trim();
            if (h === "course") obj.course = r[i]?.trim();
            if (h === "status") obj.status = r[i]?.trim();
          });
          return obj;
        });

        const validRows = data.filter(d => (type === "students" ? d.studentId && d.name : d.enrollmentId && d.studentId));
        if (validRows.length === 0) {
          addToast("No valid rows found in CSV. Make sure you have correct headers.", true);
          return;
        }
        if (type === "students") {
          await api.bulkImportStudents(validRows);
          addToast(`Imported students successfully.`);
        } else {
          await api.bulkImportEnrollments(validRows);
          addToast(`Imported enrollments successfully.`);
        }
        onRefresh();
      } catch (err) {
        addToast("Error importing CSV: " + err.message, true);
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Data Aggregations for Charts
  const courseData = useMemo(() => {
    const courses = {};
    enrollments.forEach(en => {
      if (!en.course) return;
      const c = en.course.toUpperCase();
      const s = (en.status || 'Active').charAt(0).toUpperCase() + (en.status || 'Active').slice(1).toLowerCase();
      
      if (!courses[c]) {
        courses[c] = { name: c, Active: 0, Completed: 0, Dropped: 0, Total: 0 };
      }
      
      if (courses[c][s] !== undefined) {
        courses[c][s]++;
      } else {
        courses[c][s] = 1;
      }
      courses[c].Total++;
    });
    return Object.values(courses).sort((a, b) => b.Total - a.Total);
  }, [enrollments]);

  const statusData = useMemo(() => {
    const counts = { Active: 0, Completed: 0, Dropped: 0 };
    enrollments.forEach(en => {
      if (!en.status) return;
      const s = en.status.charAt(0).toUpperCase() + en.status.slice(1).toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [enrollments]);

  const enrollmentsTrend = useMemo(() => {
    const counts = {};
    enrollments.forEach(en => {
      if (!en.doa) return;
      const parts = en.doa.split('-');
      if (parts.length >= 2) {
        const y = parts[0];
        const m = parts[1];
        if (y.length === 4) {
          const key = `${y}-${m}`;
          counts[key] = (counts[key] || 0) + 1;
        }
      }
    });
    return Object.keys(counts).sort().map(k => {
      const [y, m] = k.split('-');
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { name: `${months[parseInt(m, 10)-1]} ${y}`, "Enrollments": counts[k] };
    });
  }, [enrollments]);

  return (
    <section>
      <div className="page-head">
        <div>
          <h2>Enrolled Students</h2>
          <p>Manage students, enrollments, and their details.</p>
        </div>
      </div>

      <div className="tabs fees-tabs" role="tablist">
        <button className="fee-tab" aria-selected={tab === "dashboard"} onClick={() => setTab("dashboard")}>Dashboard</button>
        <button className="fee-tab" aria-selected={tab === "students"} onClick={() => setTab("students")}>Students List</button>
        <button className="fee-tab" aria-selected={tab === "new_enrollment" || tab === "new_student"} onClick={() => setTab("new_enrollment")}>New Enrollment</button>
        <button className="fee-tab" aria-selected={tab === "enrollments"} onClick={() => setTab("enrollments")}>Enrollments</button>
      </div>

      {tab === "dashboard" && (
        <div style={{display: "flex", flexDirection: "column", gap: "20px"}}>
          <div className="stats">
            <div className="card stat">
              <div className="stat-top">
                <span className="stat-ico"><Icon name="users" size={20} /></span>
                <span className="stat-label">Total Students</span>
              </div>
              <div className="stat-val">{students.length}</div>
            </div>
            <div className="card stat">
              <div className="stat-top">
                <span className="stat-ico"><Icon name="award" size={20} /></span>
                <span className="stat-label">Total Enrollments</span>
              </div>
              <div className="stat-val">{enrollments.length}</div>
            </div>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
            <div className="card section" style={{ padding: "20px" }}>
              <h3 style={{ marginBottom: "15px", fontSize: "16px", color: "#1e293b" }}>Course Insights (Enrollments & Status)</h3>
              <div style={{ width: "100%", height: 400 }}>
                <ResponsiveContainer>
                  <BarChart data={courseData} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{fontSize: 12, fill: '#64748b'}} interval={0} height={60} />
                    <YAxis tick={{fill: '#64748b'}} />
                    <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                    <Legend verticalAlign="top" height={36} />
                    <Bar dataKey="Active" stackId="a" fill="#0088FE" />
                    <Bar dataKey="Completed" stackId="a" fill="#00C49F" />
                    <Bar dataKey="Dropped" stackId="a" fill="#FF8042" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            <div className="card section" style={{ padding: "20px" }}>
              <h3 style={{ marginBottom: "15px", fontSize: "16px", color: "#1e293b" }}>Enrollment Status</h3>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={0} outerRadius={100} dataKey="value">
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card section" style={{ padding: "20px" }}>
            <h3 style={{ marginBottom: "15px", fontSize: "16px", color: "#1e293b" }}>Enrollments Over Time</h3>
            <div style={{ width: "100%", height: 350 }}>
              <ResponsiveContainer>
                <BarChart data={enrollmentsTrend} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fill: '#64748b'}} tickLine={false} />
                  <YAxis tick={{fill: '#64748b'}} tickLine={false} axisLine={false} />
                  <RechartsTooltip cursor={{fill: '#f1f5f9'}} />
                  <Bar dataKey="Enrollments" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {(tab === "new_student" || tab === "new_enrollment") && (
        <form className="card form-card" onSubmit={handleCreateStudent}>
          <div className="form-body">
            <h3>New Enrollment</h3>
            {duplicateError && (
              <div style={{
                marginBottom: "16px",
                padding: "10px 14px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#b91c1c",
                fontWeight: 600,
                fontSize: "0.88rem",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <Icon name="alert" size={16} />
                <span>{duplicateError}</span>
              </div>
            )}
            <div className="fgrid">
              <div className="fld">
                <label htmlFor="st-student-id">
                  Student ID <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: "normal" }}>(Autofilled)</span>
                </label>
                <input
                  id="st-student-id"
                  className="input"
                  value="Autofilled"
                  readOnly
                  disabled
                  placeholder="Autofilled"
                  style={{
                    background: "#f1f5f9",
                    color: "#64748b",
                    cursor: "not-allowed",
                    border: "1px solid #cbd5e1",
                    fontWeight: 600
                  }}
                />
              </div>
              <div className="fld">
                <label htmlFor="st-name">Name <em>*</em></label>
                <input
                  id="st-name"
                  className="input"
                  placeholder="Student Full Name"
                  value={newStudent.name}
                  onChange={e => {
                    setNewStudent({...newStudent, name: e.target.value});
                    if (duplicateError) setDuplicateError("");
                  }}
                  required
                />
              </div>
              <div className="fld">
                <label htmlFor="st-guardian">Guardian Name</label>
                <input
                  id="st-guardian"
                  className="input"
                  placeholder="Parent / Guardian Name"
                  value={newStudent.guardianName}
                  onChange={e => setNewStudent({...newStudent, guardianName: e.target.value})}
                />
              </div>
              <div className="fld">
                <label htmlFor="st-phone">Phone</label>
                <input
                  id="st-phone"
                  className="input"
                  placeholder="10-digit mobile number"
                  value={newStudent.phone}
                  onChange={e => {
                    setNewStudent({...newStudent, phone: e.target.value});
                    if (duplicateError) setDuplicateError("");
                  }}
                />
              </div>
              <div className="fld">
                <label htmlFor="st-email">Email</label>
                <input
                  id="st-email"
                  className="input"
                  type="email"
                  placeholder="student@example.com"
                  value={newStudent.email}
                  onChange={e => {
                    setNewStudent({...newStudent, email: e.target.value});
                    if (duplicateError) setDuplicateError("");
                  }}
                />
              </div>
              <div className="fld">
                <label htmlFor="st-course">Course Selection <em>*</em></label>
                <select
                  id="st-course"
                  className="select"
                  value={newStudent.course}
                  onChange={e => {
                    setNewStudent({...newStudent, course: e.target.value});
                    if (duplicateError) setDuplicateError("");
                  }}
                  required
                >
                  <option value="">Select a Course...</option>
                  {COURSES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="fld">
                <label htmlFor="st-remarks">Remarks</label>
                <input
                  id="st-remarks"
                  className="input"
                  placeholder="Any additional remarks..."
                  value={newStudent.remarks}
                  onChange={e => setNewStudent({...newStudent, remarks: e.target.value})}
                />
              </div>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn primary">Save Enrollment</button>
          </div>
        </form>
      )}

      {tab === "students" && (
        <div className="card section">
          {/* Card head with comprehensive search bar positioned to the left of the Import CSV button */}
          <div className="card-head" style={{ flexWrap: "wrap", gap: "12px" }}>
            <div>
              <h3>Students Database</h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.84rem", color: "var(--muted)" }}>
                {filteredStudents.length} {filteredStudents.length === 1 ? "student" : "students"} recorded
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Comprehensive search bar */}
              <div className="search" style={{ minWidth: "240px", maxWidth: "380px" }}>
                <span className="si"><Icon name="search" size={18} /></span>
                <input
                  className="input"
                  type="search"
                  placeholder="Search name, phone, ID, etc."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <input type="file" id="import-students" style={{display: "none"}} accept=".csv" onChange={e => handleImportCSV(e, "students")} />
              <button className="btn primary" onClick={() => document.getElementById("import-students").click()} disabled={importing}>
                <span className="ic"><Icon name="upload" size={16} /></span> Import CSV
              </button>
            </div>
          </div>

          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <SortableTh colKey="studentId" label="Student ID" sortKey={studentSortKey} sortDirection={studentSortDir} onSort={handleStudentSort} />
                  <SortableTh colKey="name" label="Name" sortKey={studentSortKey} sortDirection={studentSortDir} onSort={handleStudentSort} />
                  <SortableTh colKey="guardianName" label="Guardian Name" sortKey={studentSortKey} sortDirection={studentSortDir} onSort={handleStudentSort} />
                  <SortableTh colKey="phone" label="Phone" sortKey={studentSortKey} sortDirection={studentSortDir} onSort={handleStudentSort} />
                  <SortableTh colKey="email" label="Email" sortKey={studentSortKey} sortDirection={studentSortDir} onSort={handleStudentSort} />
                  <SortableTh colKey="remarks" label="Remarks" sortKey={studentSortKey} sortDirection={studentSortDir} onSort={handleStudentSort} />
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--muted)" }}>
                      {studentSearchQuery ? (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                          <span>No students found matching "{studentSearchQuery}".</span>
                          <button className="btn sm" type="button" onClick={() => setStudentSearchQuery("")}>
                            Clear search
                          </button>
                        </div>
                      ) : (
                        "No students recorded."
                      )}
                    </td>
                  </tr>
                ) : (
                  sortedStudents.map(st => (
                    <tr key={st.id}>
                      {editingStudent?.id === st.id ? (
                        <td colSpan="7">
                          <form onSubmit={handleUpdateStudent} style={{display:"flex", gap: "10px", flexWrap: "wrap"}}>
                            <input className="input" value={editingStudent.studentId} onChange={e=>setEditingStudent({...editingStudent, studentId: e.target.value})} placeholder="Student ID" />
                            <input className="input" value={editingStudent.name} onChange={e=>setEditingStudent({...editingStudent, name: e.target.value})} placeholder="Name" />
                            <input className="input" value={editingStudent.guardianName} onChange={e=>setEditingStudent({...editingStudent, guardianName: e.target.value})} placeholder="Guardian Name" />
                            <input className="input" value={editingStudent.phone} onChange={e=>setEditingStudent({...editingStudent, phone: e.target.value})} placeholder="Phone" />
                            <input className="input" value={editingStudent.email} onChange={e=>setEditingStudent({...editingStudent, email: e.target.value})} placeholder="Email" />
                            <input className="input" value={editingStudent.remarks} onChange={e=>setEditingStudent({...editingStudent, remarks: e.target.value})} placeholder="Remarks" />
                            <button type="submit" className="btn primary sm">Save</button>
                            <button type="button" className="btn sm" onClick={()=>setEditingStudent(null)}>Cancel</button>
                          </form>
                        </td>
                      ) : (
                        <>
                          <td style={{ fontWeight: "600", color: "#1e293b" }}>{st.studentId}</td>
                          <td><strong>{st.name}</strong></td>
                          <td>{st.guardianName || "–"}</td>
                          <td>{st.phone || "–"}</td>
                          <td>{st.email || "–"}</td>
                          <td>{st.remarks || "–"}</td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button className="btn sm" onClick={() => setEditingStudent(st)}>Edit</button>
                              <button className="btn sm danger" onClick={() => handleDeleteStudent(st.id)}>Del</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "enrollments" && (
        <div className="card section">
          <div className="card-head">
            <div>
              <h3>Enrollments</h3>
              <p style={{ margin: "2px 0 0", fontSize: "0.84rem", color: "var(--muted)" }}>
                {filteredEnrollments.length} {filteredEnrollments.length === 1 ? "enrollment" : "enrollments"} found
              </p>
            </div>
            <div>
              <input type="file" id="import-enrollments" style={{display: "none"}} accept=".csv" onChange={e => handleImportCSV(e, "enrollments")} />
              <button className="btn primary" onClick={() => document.getElementById("import-enrollments").click()} disabled={importing}>
                <span className="ic"><Icon name="upload" size={16} /></span> Import CSV
              </button>
            </div>
          </div>

          {/* Horizontal filtering system matching reference design */}
          <div className="toolbar" style={{ flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            {/* Search bar ("Search name, phone...") */}
            <div className="search" style={{ minWidth: "220px", flex: "1 1 220px" }}>
              <span className="si"><Icon name="search" size={18} /></span>
              <input
                className="input"
                type="search"
                placeholder="Search name, phone..."
                value={enrollmentSearchQuery}
                onChange={(e) => setEnrollmentSearchQuery(e.target.value)}
                autoComplete="off"
              />
            </div>

            {/* Filter Dropdowns and Actions */}
            <div className="filters" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              {/* All courses dropdown */}
              <div className="fl">
                <select
                  className="select"
                  value={enrollmentCourseFilter}
                  onChange={(e) => setEnrollmentCourseFilter(e.target.value)}
                  aria-label="Filter by course"
                >
                  <option value="All">All courses</option>
                  {enrollmentCourseOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* All sources dropdown */}
              <div className="fl">
                <select
                  className="select"
                  value={enrollmentSourceFilter}
                  onChange={(e) => setEnrollmentSourceFilter(e.target.value)}
                  aria-label="Filter by source"
                >
                  <option value="All">All sources</option>
                  {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* All statuses dropdown */}
              <div className="fl">
                <select
                  className="select"
                  value={enrollmentStatusFilter}
                  onChange={(e) => setEnrollmentStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="All">All statuses</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Dropped">Dropped</option>
                </select>
              </div>

              {/* Any date dropdown */}
              <div className="fl">
                <select
                  className="select"
                  value={enrollmentDateFilter}
                  onChange={(e) => setEnrollmentDateFilter(e.target.value)}
                  aria-label="Filter by date range"
                >
                  <option value="all">Any date</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This week</option>
                  <option value="month">This month</option>
                  <option value="lastmonth">Last month</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>

              {enrollmentDateFilter === "custom" && (
                <div className="fl custom" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    className="input"
                    type="date"
                    value={enrollmentCustomFrom}
                    onChange={(e) => setEnrollmentCustomFrom(e.target.value)}
                    aria-label="From date"
                    style={{ width: "auto" }}
                  />
                  <input
                    className="input"
                    type="date"
                    value={enrollmentCustomTo}
                    onChange={(e) => setEnrollmentCustomTo(e.target.value)}
                    aria-label="To date"
                    style={{ width: "auto" }}
                  />
                </div>
              )}

              {/* Clear filters button */}
              <button
                className="btn"
                type="button"
                onClick={clearEnrollmentFilters}
                title="Clear all filters"
              >
                <span className="ic"><Icon name="x" size={15} /></span>
                Clear filters
              </button>
            </div>
          </div>

          <form className="form-card" onSubmit={handleCreateEnrollment} style={{padding: "16px", background: "#f8f9fa", borderBottom: "1px solid #e2e8f0"}}>
            <h4 style={{ margin: "0 0 10px", fontSize: "0.95rem" }}>New Enrollment</h4>
            <div style={{display: "flex", gap: "10px", flexWrap: "wrap"}}>
              <input className="input" style={{flex: "1 1 120px"}} placeholder="Enrollment ID" value={newEnrollment.enrollmentId} onChange={e => setNewEnrollment({...newEnrollment, enrollmentId: e.target.value})} required/>
              <input className="input" style={{flex: "1 1 120px"}} placeholder="Student ID" value={newEnrollment.studentId} onChange={e => setNewEnrollment({...newEnrollment, studentId: e.target.value})} required/>
              <input className="input" style={{flex: "1 1 120px"}} type="date" placeholder="DOA" value={newEnrollment.doa} onChange={e => setNewEnrollment({...newEnrollment, doa: e.target.value})} />
              <input className="input" style={{flex: "1 1 160px"}} placeholder="Course" value={newEnrollment.course} onChange={e => setNewEnrollment({...newEnrollment, course: e.target.value})} />
              <select className="select" style={{flex: "1 1 120px"}} value={newEnrollment.status} onChange={e => setNewEnrollment({...newEnrollment, status: e.target.value})}>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
                <option value="Dropped">Dropped</option>
              </select>
              <button type="submit" className="btn primary">Add</button>
            </div>
          </form>

          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <SortableTh colKey="enrollmentId" label="Enrollment ID" sortKey={enrSortKey} sortDirection={enrSortDir} onSort={handleEnrSort} />
                  <SortableTh colKey="studentId" label="Student ID" sortKey={enrSortKey} sortDirection={enrSortDir} onSort={handleEnrSort} />
                  <SortableTh colKey="studentName" label="Student Name" sortKey={enrSortKey} sortDirection={enrSortDir} onSort={handleEnrSort} />
                  <SortableTh colKey="doa" label="DOA" sortKey={enrSortKey} sortDirection={enrSortDir} onSort={handleEnrSort} />
                  <SortableTh colKey="course" label="Course" sortKey={enrSortKey} sortDirection={enrSortDir} onSort={handleEnrSort} />
                  <SortableTh colKey="status" label="Status" sortKey={enrSortKey} sortDirection={enrSortDir} onSort={handleEnrSort} />
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedEnrollments.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--muted)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                        <b>No enrollments found matching criteria</b>
                        <span>Try adjusting your search terms or clearing active filters.</span>
                        <button className="btn sm" type="button" onClick={clearEnrollmentFilters} style={{ marginTop: "6px" }}>
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sortedEnrollments.map(en => {
                    const st = studentMap.get(String(en.studentId || "").toLowerCase());
                    const displayName = en.studentName || st?.name || "–";
                    return (
                      <tr key={en.id}>
                        {editingEnrollment?.id === en.id ? (
                          <td colSpan="7">
                            <form onSubmit={handleUpdateEnrollment} style={{display:"flex", gap: "10px", flexWrap: "wrap"}}>
                              <input className="input" value={editingEnrollment.enrollmentId} onChange={e=>setEditingEnrollment({...editingEnrollment, enrollmentId: e.target.value})} placeholder="Enrollment ID" />
                              <input className="input" value={editingEnrollment.studentId} onChange={e=>setEditingEnrollment({...editingEnrollment, studentId: e.target.value})} placeholder="Student ID" />
                              <input className="input" type="date" value={editingEnrollment.doa} onChange={e=>setEditingEnrollment({...editingEnrollment, doa: e.target.value})} />
                              <input className="input" value={editingEnrollment.course} onChange={e=>setEditingEnrollment({...editingEnrollment, course: e.target.value})} placeholder="Course" />
                              <select className="select" value={editingEnrollment.status} onChange={e=>setEditingEnrollment({...editingEnrollment, status: e.target.value})}>
                                <option value="Active">Active</option>
                                <option value="Completed">Completed</option>
                                <option value="Dropped">Dropped</option>
                              </select>
                              <button type="submit" className="btn primary sm">Save</button>
                              <button type="button" className="btn sm" onClick={()=>setEditingEnrollment(null)}>Cancel</button>
                            </form>
                          </td>
                        ) : (
                          <>
                            <td style={{ fontWeight: "600", color: "#1e293b" }}>{en.enrollmentId}</td>
                            <td>{en.studentId}</td>
                            <td><strong>{displayName}</strong></td>
                            <td>{en.doa || "–"}</td>
                            <td>{en.course || "–"}</td>
                            <td>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '2px 10px',
                                borderRadius: '12px',
                                fontSize: '0.78rem',
                                fontWeight: '700',
                                background: en.status === 'Completed' ? '#dcfce7' : en.status === 'Dropped' ? '#fee2e2' : '#dbeafe',
                                color: en.status === 'Completed' ? '#15803d' : en.status === 'Dropped' ? '#b91c1c' : '#1d4ed8',
                                border: `1px solid ${en.status === 'Completed' ? '#bbf7d0' : en.status === 'Dropped' ? '#fecaca' : '#bfdbfe'}`
                              }}>
                                <span style={{
                                  width: '6px',
                                  height: '6px',
                                  borderRadius: '50%',
                                  background: en.status === 'Completed' ? '#16a34a' : en.status === 'Dropped' ? '#dc2626' : '#2563eb'
                                }} />
                                {en.status || 'Active'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button className="btn sm" onClick={() => setEditingEnrollment(en)}>Edit</button>
                                <button className="btn sm danger" onClick={() => handleDeleteEnrollment(en.id)}>Del</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </section>
  );
}
