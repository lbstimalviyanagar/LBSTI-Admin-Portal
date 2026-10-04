
const fs = require("fs");
let file = "php_backend/controllers/FeeController.php";
let content = fs.readFileSync(file, "utf8");

content = content.replace("LEFT JOIN enquiries e ON e.id = f.enquiry_id", "LEFT JOIN students s ON s.id = f.enquiry_id LEFT JOIN enquiries e ON e.id = f.enquiry_id");
content = content.replace("SELECT f.*, e.name as student_name, e.phone, e.course, e.assigned_to", "SELECT f.*, COALESCE(s.name, e.name) as student_name, COALESCE(s.phone, e.phone) as phone, COALESCE(s.course, e.course) as course");
content = content.replace("FROM enquiries WHERE id = ?", "FROM students WHERE id = ? UNION SELECT id FROM enquiries WHERE id = ?");
content = content.replace("execute([$enquiryId])", "execute([$enquiryId, $enquiryId])");
fs.writeFileSync(file, content);

file = "php_backend/controllers/ReceiptController.php";
content = fs.readFileSync(file, "utf8");
content = content.replace("LEFT JOIN enquiries e ON e.id = f.enquiry_id", "LEFT JOIN students s ON s.id = f.enquiry_id LEFT JOIN enquiries e ON e.id = f.enquiry_id");
content = content.replace("SELECT f.*, e.name as student_name, e.course", "SELECT f.*, COALESCE(s.name, e.name) as student_name, COALESCE(s.course, e.course) as course");
fs.writeFileSync(file, content);


