
const fs = require("fs");
let content = fs.readFileSync("server.js", "utf8");

content = content.replace("LEFT JOIN enquiries e ON e.id = f.enquiry_id", "LEFT JOIN students s ON s.id = f.enquiry_id LEFT JOIN enquiries e ON e.id = f.enquiry_id");
content = content.replace("SELECT f.*, e.name as student_name, e.phone, e.course, e.assigned_to", "SELECT f.*, COALESCE(s.name, e.name) as student_name, COALESCE(s.phone, e.phone) as phone, COALESCE(s.course, e.course) as course");

content = content.replace("const enquiry = await getSql('SELECT * FROM enquiries WHERE id = ?', [enquiryId]);", "const enquiry = await getSql('SELECT id FROM students WHERE id = ? UNION SELECT id FROM enquiries WHERE id = ?', [enquiryId, enquiryId]);");

// receipts
content = content.replace("LEFT JOIN enquiries e ON e.id = f.enquiry_id", "LEFT JOIN students s ON s.id = f.enquiry_id LEFT JOIN enquiries e ON e.id = f.enquiry_id");
content = content.replace("SELECT f.*, e.name as student_name, e.course", "SELECT f.*, COALESCE(s.name, e.name) as student_name, COALESCE(s.course, e.course) as course");

fs.writeFileSync("server.js", content);

