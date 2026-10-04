
const fs = require("fs");
let content = fs.readFileSync("frontend/src/services/api.js", "utf8");

content = content.replace("body: JSON.stringify({ students })", "body: { students }");
content = content.replace("body: JSON.stringify({ enrollments })", "body: { enrollments }");

fs.writeFileSync("frontend/src/services/api.js", content);

