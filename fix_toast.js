
const fs = require("fs");
let content = fs.readFileSync("frontend/src/components/StudentsSection.jsx", "utf8");

content = content.replace(
  `await api.bulkImportStudents(validRows);
            addToast(\`Imported students successfully.\`);`,
  `const res = await api.bulkImportStudents(validRows);
            addToast(res.message || \`Imported students successfully.\`);`
);

content = content.replace(
  `await api.bulkImportEnrollments(validRows);
            addToast(\`Imported enrollments successfully.\`);`,
  `const res = await api.bulkImportEnrollments(validRows);
            addToast(res.message || \`Imported enrollments successfully.\`);`
);

fs.writeFileSync("frontend/src/components/StudentsSection.jsx", content);

