
const fs = require("fs");
const sqlite3 = require("sqlite3");

const db = new sqlite3.Database("lbstimn.sqlite");
const text = fs.readFileSync(process.argv[2], "utf8");
const rows = text.split("\n").map(r => r.split(","));
const headers = rows[0].map(h => h.trim().toLowerCase());

db.serialize(() => {
  rows.slice(1).forEach(r => {
    if (r.length < 2 || !r[0].trim()) return;
    
    let studentId, name, guardianName = "", phone = "", email = "", remarks = "";
    headers.forEach((h, i) => {
      let val = r[i] ? r[i].trim() : "";
      if (h === "student id" || h === "student_id") studentId = val;
      if (h === "name") name = val;
      if (h === "guardian name" || h === "guardian_name") guardianName = val;
      if (h === "phone number" || h === "phone") phone = val;
      if (h === "email") email = val;
      if (h === "remarks") remarks = val;
    });
    
    if (studentId && name) {
      db.run(`INSERT INTO students (student_id, name, guardian_name, phone, email, remarks) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(student_id) DO UPDATE SET name=excluded.name, guardian_name=excluded.guardian_name, phone=excluded.phone, email=excluded.email, remarks=excluded.remarks`,
        [studentId, name, guardianName, phone, email, remarks]
      );
    }
  });
});
console.log("Import finished.");

