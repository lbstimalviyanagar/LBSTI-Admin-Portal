<?php
// Enforce IST (Asia/Kolkata, UTC+5:30) for all date/time operations
// regardless of the hosting server's default timezone setting.
date_default_timezone_set('Asia/Kolkata');

error_reporting(E_ALL);
ini_set("display_errors", 0);
ini_set("log_errors", 1);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Global exception handler — returns real error as JSON instead of blank 500
set_exception_handler(function($e) {
    if (!headers_sent()) {
        http_response_code(500);
        header("Content-Type: application/json");
    }
    echo json_encode([
        "error"   => true,
        "message" => $e->getMessage(),
        "file"    => basename($e->getFile()),
        "line"    => $e->getLine()
    ]);
    exit();
});

require 'config.php';
require 'JwtHandler.php';

$route = isset($_GET['route']) ? $_GET['route'] : '';
$method = $_SERVER['REQUEST_METHOD'];
$body = json_decode(file_get_contents('php://input'), true);

function requireAuth($secret) {
    $user = JwtHandler::getAuthUser($secret);
    if (!$user) {
        http_response_code(401);
        echo json_encode(["message" => "Unauthorized"]);
        exit();
    }
    return $user;
}

if ($route === 'auth/login') {
    require 'controllers/AuthController.php';
    login($pdo, $body, $authSecret);
} elseif ($route === 'auth/me') {
    $user = requireAuth($authSecret);
    $stmt = $pdo->prepare("SELECT id, username, full_name, role, profile_photo FROM portal_users WHERE id = ?");
    $stmt->execute([$user['sub']]);
    $dbUser = $stmt->fetch();
    if ($dbUser) {
        $user['name'] = $dbUser['full_name'];
        $user['role'] = $dbUser['role'];
        $user['profilePhotoUrl'] = $dbUser['profile_photo'] ?? null;
    }
    echo json_encode(["ok" => true, "user" => $user]);
} elseif (strpos($route, 'enquiries') === 0) {
    require 'controllers/EnquiryController.php';
    $user = requireAuth($authSecret);
    
    $parts = explode('/', $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    $resource = isset($_GET['resource']) ? $_GET['resource'] : null;
    
    if ($id === 'bulk' && $method === 'POST') bulkCreateEnquiries($pdo, $body);
    elseif ($method === 'GET') getEnquiries($pdo, $id, $resource);
    elseif ($method === 'POST') createEnquiry($pdo, $body);
    elseif ($method === 'PUT') updateEnquiry($pdo, $id, $body);
    elseif ($method === 'DELETE') deleteEnquiry($pdo, $id);
} elseif (strpos($route, 'users') === 0) {
    require 'controllers/UserController.php';
    $user = requireAuth($authSecret);
    if ($user['role'] !== 'admin') {
        http_response_code(403);
        die(json_encode(["message" => "Forbidden"]));
    }
    
    $parts = explode('/', $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    
    if ($method === 'GET') getUsers($pdo);
    elseif ($method === 'POST') createUser($pdo, $body);
    elseif ($method === 'PUT' || $method === 'PATCH') updateUser($pdo, $id, $body);
    elseif ($method === 'DELETE') deleteUser($pdo, $id);
} elseif (strpos($route, 'fees') === 0) {
    require 'controllers/FeeController.php';
    $user = requireAuth($authSecret);
    
    $parts = explode('/', $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    
    if ($method === 'GET') getFees($pdo, $id);
    elseif ($method === 'POST') createFee($pdo, $body, $user);
    elseif ($method === 'PUT') updateFee($pdo, $id, $body);
    elseif ($method === 'DELETE') deleteFee($pdo, $id);
} elseif (strpos($route, 'receipts') === 0) {
    require 'controllers/ReceiptController.php';
    $user = requireAuth($authSecret);
    
    $parts = explode('/', $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    
    if ($method === 'GET') getReceipt($pdo, $id);

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
} elseif (strpos($route, "attendance") === 0) {
    require "controllers/AttendanceController.php";
    $user = requireAuth($authSecret);
    $parts = explode("/", $route);
    $action = isset($parts[1]) ? $parts[1] : null;
    if ($method === "GET") getAttendance($pdo, $user);
    elseif ($method === "POST" && $action === "clock-in") clockIn($pdo, $user);
    elseif ($method === "PUT" && $action === "clock-out") clockOut($pdo, $user, $body);
} elseif (strpos($route, "tasks") === 0) {
    require "controllers/TaskController.php";
    $user = requireAuth($authSecret);
    $parts = explode("/", $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    if ($method === "GET") getTasks($pdo, $user);
    elseif ($method === "POST") createTask($pdo, $user, $body);
    elseif ($method === "PUT" || $method === "PATCH") updateTask($pdo, $user, $id, $body);
    elseif ($method === "DELETE") deleteTask($pdo, $user, $id);
} elseif (strpos($route, "batches") === 0) {
    require "controllers/BatchController.php";
    $user = requireAuth($authSecret);
    $parts = explode("/", $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    if ($method === "GET") getBatches($pdo);
    elseif ($method === "POST") createBatch($pdo, $user, $body);
    elseif ($method === "PUT" || $method === "PATCH") updateBatch($pdo, $user, $id, $body);
    elseif ($method === "DELETE") deleteBatch($pdo, $user, $id);
} elseif ($route === "search-students") {
    $user = requireAuth($authSecret);
    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    if (strlen($q) < 1) {
        echo json_encode([]);
        exit();
    }
    $like = "%{$q}%";
    $sql = "SELECT s.id, s.student_id, s.name, s.guardian_name, s.phone, s.email,
                   GROUP_CONCAT(DISTINCT e.course ORDER BY e.doa DESC SEPARATOR ', ') AS courses,
                   GROUP_CONCAT(DISTINCT CONCAT(e.course, ' (', e.status, ')') ORDER BY e.doa DESC SEPARATOR ', ') AS course_details,
                   MAX(e.doa) AS last_enrollment_date,
                   COUNT(e.id) AS enrollment_count
            FROM students s
            LEFT JOIN enrollments e ON e.student_id = s.student_id
            WHERE s.name LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ?
            GROUP BY s.id
            ORDER BY s.name ASC
            LIMIT 30";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$like, $like, $like]);
    $results = [];
    while ($row = $stmt->fetch()) {
        $results[] = [
            "id" => (int)$row["id"],
            "studentId" => $row["student_id"],
            "name" => $row["name"],
            "guardianName" => $row["guardian_name"],
            "phone" => $row["phone"],
            "email" => $row["email"],
            "courses" => $row["courses"] ?: "",
            "courseDetails" => $row["course_details"] ?: "",
            "lastEnrollmentDate" => $row["last_enrollment_date"],
            "enrollmentCount" => (int)$row["enrollment_count"]
        ];
    }
    echo json_encode($results);
} else {
    http_response_code(404);
    echo json_encode(["message" => "Endpoint not found"]);
}
