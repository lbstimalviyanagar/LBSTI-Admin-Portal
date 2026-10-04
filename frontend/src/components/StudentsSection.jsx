import React, { useState } from "react";
import Icon from "./Icons";
import api from "../services/api";
import { useToast } from "../hooks/useToast";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'];
const STATUS_COLORS = { "Active": "#0088FE", "Completed": "#00C49F", "Dropped": "#FF8042" };


export default function StudentsSection({ students, enrollments, loading, onRefresh }) {
  const [tab, setTab] = useState("dashboard");
  const { addToast } = useToast();

  // State for new student
  const [newStudent, setNewStudent] = useState({
    studentId: "",
    name: "",
    guardianName: "",
    phone: "",
    email: "",
    remarks: ""
  });

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

  const handleCreateStudent = async (e) => {
    e.preventDefault();
    if (!newStudent.studentId || !newStudent.name) {
      return addToast("Student ID and Name are required.", true);
    }
    try {
      await api.createStudent(newStudent);
      addToast("Student created successfully!");
      setNewStudent({ studentId: "", name: "", guardianName: "", phone: "", email: "", remarks: "" });
      onRefresh();
    } catch (err) {
      addToast(err.message || "Failed to create student.", true);
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
            onToast("No valid rows found in CSV. Make sure you have correct headers.", true);
            if (fileInputRef.current) fileInputRef.current.value = "";
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
  const courseData = React.useMemo(() => {
    const counts = {};
    enrollments.forEach(en => {
      if (!en.course) return;
      counts[en.course] = (counts[en.course] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] })).sort((a,b) => b.value - a.value);
  }, [enrollments]);

  const statusData = React.useMemo(() => {
    const counts = { Active: 0, Completed: 0, Dropped: 0 };
    enrollments.forEach(en => {
      if (!en.status) return;
      const s = en.status.charAt(0).toUpperCase() + en.status.slice(1).toLowerCase();
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  }, [enrollments]);

  const enrollmentsTrend = React.useMemo(() => {
    const counts = {};
    enrollments.forEach(en => {
      if (!en.doa) return;
      const d = new Date(en.doa);
      if(isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.keys(counts).sort().map(k => {
      const [y, m] = k.split('-');
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return { name: `${months[parseInt(m)-1]} ${y.slice(2)}`, "Enrollments": counts[k] };
    }).slice(-12);
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
        <button className="fee-tab" aria-selected={tab === "new_student"} onClick={() => setTab("new_student")}>New Student</button>
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
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            <div className="card section" style={{ padding: "20px" }}>
              <h3 style={{ marginBottom: "15px", fontSize: "16px", color: "#1e293b" }}>Course Distribution</h3>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={courseData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                      {courseData.map((entry, index) => (
                        <Cell key={`cell-\${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card section" style={{ padding: "20px" }}>
              <h3 style={{ marginBottom: "15px", fontSize: "16px", color: "#1e293b" }}>Enrollment Status</h3>
              <div style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={0} outerRadius={100} dataKey="value">
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-\${index}`} fill={STATUS_COLORS[entry.name] || COLORS[index % COLORS.length]} />
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

      {tab === "new_student" && (
        <form className="card form-card" onSubmit={handleCreateStudent}>
          <div className="form-body">
            <h3>Add New Student</h3>
            <div className="fgrid">
              <div className="fld"><label>Student ID</label><input className="input" value={newStudent.studentId} onChange={e => setNewStudent({...newStudent, studentId: e.target.value})} required/></div>
              <div className="fld"><label>Name</label><input className="input" value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} required/></div>
              <div className="fld"><label>Guardian Name</label><input className="input" value={newStudent.guardianName} onChange={e => setNewStudent({...newStudent, guardianName: e.target.value})} /></div>
              <div className="fld"><label>Phone</label><input className="input" value={newStudent.phone} onChange={e => setNewStudent({...newStudent, phone: e.target.value})} /></div>
              <div className="fld"><label>Email</label><input className="input" value={newStudent.email} onChange={e => setNewStudent({...newStudent, email: e.target.value})} /></div>
              <div className="fld"><label>Remarks</label><input className="input" value={newStudent.remarks} onChange={e => setNewStudent({...newStudent, remarks: e.target.value})} /></div>
            </div>
          </div>
          <div className="form-actions"><button type="submit" className="btn primary">Save</button></div>
        </form>
      )}

      {tab === "students" && (
        <div className="card section">
          <div className="card-head">
            <h3>Students Database</h3>
            <div>
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
                  <th>Student ID</th><th>Name</th><th>Guardian Name</th><th>Phone</th><th>Email</th><th>Remarks</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map(st => (
                  <tr key={st.id}>
                    {editingStudent?.id === st.id ? (
                      <td colSpan="7">
                        <form onSubmit={handleUpdateStudent} style={{display:"flex", gap: "10px"}}>
                          <input className="input" value={editingStudent.studentId} onChange={e=>setEditingStudent({...editingStudent, studentId: e.target.value})} />
                          <input className="input" value={editingStudent.name} onChange={e=>setEditingStudent({...editingStudent, name: e.target.value})} />
                          <input className="input" value={editingStudent.guardianName} onChange={e=>setEditingStudent({...editingStudent, guardianName: e.target.value})} />
                          <input className="input" value={editingStudent.phone} onChange={e=>setEditingStudent({...editingStudent, phone: e.target.value})} />
                          <input className="input" value={editingStudent.email} onChange={e=>setEditingStudent({...editingStudent, email: e.target.value})} />
                          <input className="input" value={editingStudent.remarks} onChange={e=>setEditingStudent({...editingStudent, remarks: e.target.value})} />
                          <button type="submit" className="btn primary sm">Save</button>
                          <button type="button" className="btn sm" onClick={()=>setEditingStudent(null)}>Cancel</button>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td>{st.studentId}</td><td>{st.name}</td><td>{st.guardianName}</td><td>{st.phone}</td><td>{st.email}</td><td>{st.remarks}</td>
                        <td>
                          <button className="btn sm" onClick={() => setEditingStudent(st)}>Edit</button>
                          <button className="btn sm danger" onClick={() => handleDeleteStudent(st.id)}>Del</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "enrollments" && (
        <div className="card section">
          <div className="card-head">
            <h3>Enrollments</h3>
            <div>
              <input type="file" id="import-enrollments" style={{display: "none"}} accept=".csv" onChange={e => handleImportCSV(e, "enrollments")} />
              <button className="btn primary" onClick={() => document.getElementById("import-enrollments").click()} disabled={importing}>
                <span className="ic"><Icon name="upload" size={16} /></span> Import CSV
              </button>
            </div>
          </div>
          <form className="form-card" onSubmit={handleCreateEnrollment} style={{padding: "16px", background: "#f8f9fa", borderBottom: "1px solid #e2e8f0"}}>
            <h4>New Enrollment</h4>
            <div style={{display: "flex", gap: "10px"}}>
              <input className="input" placeholder="Enrollment ID" value={newEnrollment.enrollmentId} onChange={e => setNewEnrollment({...newEnrollment, enrollmentId: e.target.value})} required/>
              <input className="input" placeholder="Student ID" value={newEnrollment.studentId} onChange={e => setNewEnrollment({...newEnrollment, studentId: e.target.value})} required/>
              <input className="input" type="date" placeholder="DOA" value={newEnrollment.doa} onChange={e => setNewEnrollment({...newEnrollment, doa: e.target.value})} />
              <input className="input" placeholder="Course" value={newEnrollment.course} onChange={e => setNewEnrollment({...newEnrollment, course: e.target.value})} />
              <select className="input" value={newEnrollment.status} onChange={e => setNewEnrollment({...newEnrollment, status: e.target.value})}>
                <option>Active</option><option>Completed</option><option>Dropped</option>
              </select>
              <button type="submit" className="btn primary">Add</button>
            </div>
          </form>
          <div className="tbl-scroll">
            <table>
              <thead>
                <tr>
                  <th>Enrollment ID</th><th>Student ID</th><th>Student Name</th><th>DOA</th><th>Course</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map(en => (
                  <tr key={en.id}>
                    {editingEnrollment?.id === en.id ? (
                      <td colSpan="7">
                        <form onSubmit={handleUpdateEnrollment} style={{display:"flex", gap: "10px"}}>
                          <input className="input" value={editingEnrollment.enrollmentId} onChange={e=>setEditingEnrollment({...editingEnrollment, enrollmentId: e.target.value})} />
                          <input className="input" value={editingEnrollment.studentId} onChange={e=>setEditingEnrollment({...editingEnrollment, studentId: e.target.value})} />
                          <input className="input" type="date" value={editingEnrollment.doa} onChange={e=>setEditingEnrollment({...editingEnrollment, doa: e.target.value})} />
                          <input className="input" value={editingEnrollment.course} onChange={e=>setEditingEnrollment({...editingEnrollment, course: e.target.value})} />
                          <select className="input" value={editingEnrollment.status} onChange={e=>setEditingEnrollment({...editingEnrollment, status: e.target.value})}>
                            <option>Active</option><option>Completed</option><option>Dropped</option>
                          </select>
                          <button type="submit" className="btn primary sm">Save</button>
                          <button type="button" className="btn sm" onClick={()=>setEditingEnrollment(null)}>Cancel</button>
                        </form>
                      </td>
                    ) : (
                      <>
                        <td>{en.enrollmentId}</td><td>{en.studentId}</td><td>{en.studentName}</td><td>{en.doa}</td><td>{en.course}</td><td>{en.status}</td>
                        <td>
                          <button className="btn sm" onClick={() => setEditingEnrollment(en)}>Edit</button>
                          <button className="btn sm danger" onClick={() => handleDeleteEnrollment(en.id)}>Del</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </section>
  );
}
