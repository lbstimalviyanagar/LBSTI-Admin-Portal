
const text = "Student Id,Name,Guardian Name,Phone number,Email,Remarks\r\nS1,John Doe,Jane Doe,1234567890,john@email.com,Good";
const rows = text.split("\n").map(r => r.split(","));
if (rows.length < 2) throw new Error("File empty or missing headers");
const headers = rows[0].map(h => h.trim().toLowerCase());
console.log(headers);

const data = rows.slice(1).filter(r => r.length > 1 && r[0].trim()).map(r => {
  const obj = {};
  headers.forEach((h, i) => {
    if (h === "student id" || h === "student_id") obj.studentId = r[i]?.trim();
    if (h === "name") obj.name = r[i]?.trim();
    if (h === "guardian name" || h === "guardian_name") obj.guardianName = r[i]?.trim();
    if (h === "phone number" || h === "phone") obj.phone = r[i]?.trim();
    if (h === "email") obj.email = r[i]?.trim();
    if (h === "remarks") obj.remarks = r[i]?.trim();
  });
  return obj;
});

console.log(data);

