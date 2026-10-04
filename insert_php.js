
const fs = require("fs");
const file = "php_backend/index.php";
let content = fs.readFileSync(file, "utf8");

const routes = `
} elseif (strpos($route, "students") === 0) {
    require "controllers/StudentController.php";
    $user = requireAuth($authSecret);
    $parts = explode("/", $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    if ($id === "bulk" && $method === "POST") bulkCreateStudents($pdo, $body);
    elseif ($method === "GET") getStudents($pdo);
    elseif ($method === "POST") createStudent($pdo, $body);
    elseif ($method === "PUT" || $method === "PATCH") updateStudent($pdo, $id, $body);
    elseif ($method === "DELETE") deleteStudent($pdo, $id);
} elseif (strpos($route, "enrollments") === 0) {
    require "controllers/EnrollmentController.php";
    $user = requireAuth($authSecret);
    $parts = explode("/", $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    if ($id === "bulk" && $method === "POST") bulkCreateEnrollments($pdo, $body);
    elseif ($method === "GET") getEnrollments($pdo);
    elseif ($method === "POST") createEnrollment($pdo, $body);
    elseif ($method === "PUT" || $method === "PATCH") updateEnrollment($pdo, $id, $body);
    elseif ($method === "DELETE") deleteEnrollment($pdo, $id);
`;

content = content.replace("} else {", routes + "} else {");
fs.writeFileSync(file, content);

