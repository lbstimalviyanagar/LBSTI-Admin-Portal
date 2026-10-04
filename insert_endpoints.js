
const fs = require("fs");
const file = "server.js";
let content = fs.readFileSync(file, "utf8");

const endpoints = `
// Students Endpoints
app.get("/api/students", async (req, res) => {
  try {
    const rows = await getSql("SELECT * FROM students ORDER BY created_at DESC");
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch students.", error: error.message });
  }
});

app.post("/api/students", async (req, res) => {
  try {
    const body = camelCase(req.body || {});
    const now = new Date().toISOString();
    const result = await runSql(
      "INSERT INTO students (student_id, name, guardian_name, phone, email, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [body.studentId || "", body.name || "", body.guardianName || "", body.phone || "", body.email || "", body.remarks || "", now, now]
    );
    const rows = await getSql("SELECT * FROM students WHERE id = ?", [result.id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Unable to create student.", error: error.message });
  }
});

app.post("/api/students/bulk", async (req, res) => {
  try {
    const students = req.body.students;
    if (!Array.isArray(students)) return res.status(400).json({ message: "Invalid data." });
    let successCount = 0;
    const now = new Date().toISOString();
    for (const st of students) {
      if (!st.studentId || !st.name) continue;
      try {
        await runSql(
          "INSERT OR REPLACE INTO students (student_id, name, guardian_name, phone, email, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [st.studentId, st.name, st.guardianName || "", st.phone || "", st.email || "", st.remarks || "", now, now]
        );
        successCount++;
      } catch (e) {}
    }
    res.json({ message: \`Imported \${successCount} students.\` });
  } catch (error) {
    res.status(500).json({ message: "Unable to import students." });
  }
});

app.patch("/api/students/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = camelCase(req.body || {});
    const now = new Date().toISOString();
    const setClauses = [];
    const values = [];
    for (const key of ["studentId", "name", "guardianName", "phone", "email", "remarks"]) {
      if (body[key] !== undefined) {
        setClauses.push(\`\${key === "studentId" ? "student_id" : key === "guardianName" ? "guardian_name" : key} = ?\`);
        values.push(body[key]);
      }
    }
    if (setClauses.length > 0) {
      setClauses.push("updated_at = ?");
      values.push(now);
      values.push(id);
      await runSql(\`UPDATE students SET \${setClauses.join(", ")} WHERE id = ?\`, values);
    }
    const rows = await getSql("SELECT * FROM students WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Unable to update student." });
  }
});

app.delete("/api/students/:id", async (req, res) => {
  try {
    await runSql("DELETE FROM students WHERE id = ?", [Number(req.params.id)]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Unable to delete student." });
  }
});

// Enrollments Endpoints
app.get("/api/enrollments", async (req, res) => {
  try {
    const rows = await getSql(\`
      SELECT e.*, s.name as student_name 
      FROM enrollments e 
      LEFT JOIN students s ON s.student_id = e.student_id 
      ORDER BY e.created_at DESC
    \`);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: "Unable to fetch enrollments.", error: error.message });
  }
});

app.post("/api/enrollments", async (req, res) => {
  try {
    const body = camelCase(req.body || {});
    const now = new Date().toISOString();
    const result = await runSql(
      "INSERT INTO enrollments (enrollment_id, student_id, doa, course, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [body.enrollmentId || "", body.studentId || "", body.doa || "", body.course || "", body.status || "Active", now, now]
    );
    const rows = await getSql("SELECT * FROM enrollments WHERE id = ?", [result.id]);
    res.status(201).json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Unable to create enrollment.", error: error.message });
  }
});

app.post("/api/enrollments/bulk", async (req, res) => {
  try {
    const enrollments = req.body.enrollments;
    if (!Array.isArray(enrollments)) return res.status(400).json({ message: "Invalid data." });
    let successCount = 0;
    const now = new Date().toISOString();
    for (const en of enrollments) {
      if (!en.enrollmentId || !en.studentId) continue;
      try {
        await runSql(
          "INSERT OR REPLACE INTO enrollments (enrollment_id, student_id, doa, course, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [en.enrollmentId, en.studentId, en.doa || "", en.course || "", en.status || "Active", now, now]
        );
        successCount++;
      } catch (e) {}
    }
    res.json({ message: \`Imported \${successCount} enrollments.\` });
  } catch (error) {
    res.status(500).json({ message: "Unable to import enrollments." });
  }
});

app.patch("/api/enrollments/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const body = camelCase(req.body || {});
    const now = new Date().toISOString();
    const setClauses = [];
    const values = [];
    for (const key of ["enrollmentId", "studentId", "doa", "course", "status"]) {
      if (body[key] !== undefined) {
        setClauses.push(\`\${key === "enrollmentId" ? "enrollment_id" : key === "studentId" ? "student_id" : key} = ?\`);
        values.push(body[key]);
      }
    }
    if (setClauses.length > 0) {
      setClauses.push("updated_at = ?");
      values.push(now);
      values.push(id);
      await runSql(\`UPDATE enrollments SET \${setClauses.join(", ")} WHERE id = ?\`, values);
    }
    const rows = await getSql("SELECT * FROM enrollments WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: "Unable to update enrollment." });
  }
});

app.delete("/api/enrollments/:id", async (req, res) => {
  try {
    await runSql("DELETE FROM enrollments WHERE id = ?", [Number(req.params.id)]);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: "Unable to delete enrollment." });
  }
});

`;

content = content.replace("// Users Endpoints", endpoints + "// Users Endpoints");
fs.writeFileSync(file, content);

