
const fs = require("fs");
const file = "frontend/src/services/api.js";
let content = fs.readFileSync(file, "utf8");

const studentApi = `
  // Students
  async getStudents() {
    return request("/students", { method: "GET" });
  },
  async createStudent(data) {
    return request("/students", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async updateStudent(id, data) {
    return request(\`/students/\${id}\`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  },
  async deleteStudent(id) {
    return request(\`/students/\${id}\`, { method: "DELETE" });
  },
  async bulkImportStudents(students) {
    return request("/students/bulk", {
      method: "POST",
      body: JSON.stringify({ students })
    });
  },

  // Enrollments
  async getEnrollments() {
    return request("/enrollments", { method: "GET" });
  },
  async createEnrollment(data) {
    return request("/enrollments", {
      method: "POST",
      body: JSON.stringify(data)
    });
  },
  async updateEnrollment(id, data) {
    return request(\`/enrollments/\${id}\`, {
      method: "PATCH",
      body: JSON.stringify(data)
    });
  },
  async deleteEnrollment(id) {
    return request(\`/enrollments/\${id}\`, { method: "DELETE" });
  },
  async bulkImportEnrollments(enrollments) {
    return request("/enrollments/bulk", {
      method: "POST",
      body: JSON.stringify({ enrollments })
    });
  },
`;

content = content.replace("// Users", studentApi + "\n  // Users");
fs.writeFileSync(file, content);

