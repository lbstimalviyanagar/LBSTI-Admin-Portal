
const fs = require("fs");
let content = fs.readFileSync("frontend/src/components/StudentsSection.jsx", "utf8");

const oldDataGen = `const data = rows.slice(1).filter(r => r.length > 1 && r[0].trim()).map(r => {`;
const newDataGen = `const data = rows.slice(1).filter(r => r.length > 1 && r[0].trim()).map(r => {`;

content = content.replace(
  `if (type === "students") {`,
  `const validRows = data.filter(d => (type === "students" ? d.studentId && d.name : d.enrollmentId && d.studentId));
          if (validRows.length === 0) {
            onToast("No valid rows found in CSV. Make sure you have correct headers.", true);
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
          }
          if (type === "students") {`
);

content = content.replace(`await api.bulkImportStudents(data);`, `await api.bulkImportStudents(validRows);`);
content = content.replace(`await api.bulkImportEnrollments(data);`, `await api.bulkImportEnrollments(validRows);`);

fs.writeFileSync("frontend/src/components/StudentsSection.jsx", content);

