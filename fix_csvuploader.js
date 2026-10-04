
const fs = require("fs");
let content = fs.readFileSync("frontend/src/components/CsvUploader.jsx", "utf8");

content = content.replace(
  `const nameIdx = headers.findIndex(h => h.includes('name'));`,
  `const nameIdx = headers.findIndex(h => h.includes('name') || h === 'student' || h === 'student name');`
);

content = content.replace(
  `throw new Error("CSV must contain at least 'Name' and 'Phone' columns.");`,
  `throw new Error("CSV must contain at least 'Name/Student' and 'Phone' columns.");`
);

fs.writeFileSync("frontend/src/components/CsvUploader.jsx", content);

