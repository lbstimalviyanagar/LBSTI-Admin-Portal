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

// Self-healing schema migration: ensure menu_permissions column exists
try {
    $colCheck = $pdo->query("SHOW COLUMNS FROM `portal_users` LIKE 'menu_permissions'");
    if (!$colCheck || $colCheck->rowCount() === 0) {
        $pdo->exec("ALTER TABLE `portal_users` ADD COLUMN `menu_permissions` TEXT DEFAULT NULL AFTER `role`");
    }
} catch (Exception $e) {
    try {
        $pdo->exec("ALTER TABLE `portal_users` ADD COLUMN `menu_permissions` TEXT DEFAULT NULL AFTER `role`");
    } catch (Exception $e2) {}
}

try {
    $pdo->exec("ALTER TABLE `portal_users` MODIFY COLUMN `role` VARCHAR(50) NOT NULL DEFAULT 'counselor'");
} catch (Exception $e3) {}

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

function requireMenuPermission($user, $requiredMenu, $pdo) {
    if (isset($user['role']) && strtolower($user['role']) === 'admin') {
        return;
    }

    $stmt = $pdo->prepare("SELECT * FROM portal_users WHERE id = ?");
    $stmt->execute([$user['sub']]);
    $dbUser = $stmt->fetch();

    if (!$dbUser) {
        http_response_code(403);
        echo json_encode(["message" => "Access denied. User account not found."]);
        exit();
    }

    if (strtolower($dbUser['role']) === 'admin') {
        return;
    }

    $permissions = [];
    if (!empty($dbUser['menu_permissions'])) {
        $decoded = json_decode($dbUser['menu_permissions'], true);
        if (is_array($decoded)) {
            $permissions = $decoded;
        }
    }

    if (empty($permissions)) {
        if ($dbUser['role'] === 'teacher') {
            $permissions = ['attendance', 'batches', 'tasks'];
        } else {
            $permissions = ['enquiries', 'payments', 'students', 'attendance', 'tasks', 'batches'];
        }
    }

    if (!in_array($requiredMenu, $permissions, true)) {
        http_response_code(403);
        echo json_encode([
            "message" => "Forbidden: You do not have permission to access the '{$requiredMenu}' resource."
        ]);
        exit();
    }
}

if ($route === 'auth/login') {
    require 'controllers/AuthController.php';
    login($pdo, $body, $authSecret);
} elseif ($route === 'auth/me') {
    $user = requireAuth($authSecret);
    $stmt = $pdo->prepare("SELECT * FROM portal_users WHERE id = ?");
    $stmt->execute([$user['sub']]);
    $dbUser = $stmt->fetch();
    if ($dbUser) {
        $user['name'] = $dbUser['full_name'];
        $user['role'] = $dbUser['role'];
        $user['profilePhotoUrl'] = $dbUser['profile_photo'] ?? null;
        
        $permissions = [];
        if (!empty($dbUser['menu_permissions'])) {
            $decoded = json_decode($dbUser['menu_permissions'], true);
            if (is_array($decoded)) {
                $permissions = $decoded;
            }
        }
        $user['menuPermissions'] = $permissions;
    }
    echo json_encode(["ok" => true, "user" => $user]);
} elseif (strpos($route, 'enquiries') === 0) {
    require 'controllers/EnquiryController.php';
    $user = requireAuth($authSecret);
    requireMenuPermission($user, 'enquiries', $pdo);
    
    $parts = explode('/', trim($route, '/'));
    $id = isset($parts[1]) && $parts[1] !== '' ? $parts[1] : (isset($_GET['id']) ? $_GET['id'] : null);
    $subAction = isset($parts[2]) && $parts[2] !== '' ? $parts[2] : (isset($_GET['resource']) ? $_GET['resource'] : null);
    
    if ($id === 'bulk' && $method === 'POST') {
        bulkCreateEnquiries($pdo, $body);
    } elseif ($id && $subAction === 'confirm' && $method === 'POST') {
        confirmEnquiry($pdo, $id, $user);
    } elseif ($id && $subAction === 'remarks') {
        if ($method === 'GET') {
            getRemarks($pdo, $id);
        } elseif ($method === 'POST') {
            addRemark($pdo, $id, $body, $user);
        } else {
            http_response_code(405);
            echo json_encode(["message" => "Method not allowed"]);
        }
    } elseif ($id && ($method === 'PUT' || $method === 'PATCH')) {
        updateEnquiry($pdo, $id, $body);
    } elseif ($id && $method === 'DELETE') {
        deleteEnquiry($pdo, $id);
    } elseif ($id && $method === 'GET') {
        getEnquiries($pdo, $id, $subAction);
    } elseif (!$id && $method === 'POST') {
        createEnquiry($pdo, $body);
    } elseif (!$id && $method === 'GET') {
        getEnquiries($pdo);
    } else {
        http_response_code(405);
        echo json_encode(["message" => "Method not allowed"]);
    }
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
    requireMenuPermission($user, 'payments', $pdo);
    
    $parts = explode('/', $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    
    if ($method === 'GET') getFees($pdo, $id);
    elseif ($method === 'POST') createFee($pdo, $body, $user);
    elseif ($method === 'PUT' || $method === 'PATCH') updateFee($pdo, $id, $body);
    elseif ($method === 'DELETE') deleteFee($pdo, $id);
} elseif (strpos($route, 'receipts') === 0) {
    require 'controllers/ReceiptController.php';
    $user = requireAuth($authSecret);
    requireMenuPermission($user, 'payments', $pdo);
    
    $parts = explode('/', $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    
    if ($method === 'GET') getReceipt($pdo, $id);

} elseif (strpos($route, "students") === 0) {
    require "controllers/StudentController.php";
    $user = requireAuth($authSecret);
    requireMenuPermission($user, 'students', $pdo);
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
    requireMenuPermission($user, 'students', $pdo);
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
    requireMenuPermission($user, 'attendance', $pdo);
    $parts = explode("/", $route);
    $action = isset($parts[1]) ? $parts[1] : null;
    if ($method === "GET" && ($action === "options" || $action === "filters")) getAttendanceFilterOptions($pdo, $user);
    elseif ($method === "GET") getAttendance($pdo, $user);
    elseif ($method === "POST" && $action === "clock-in") clockIn($pdo, $user);
    elseif ($method === "PUT" && $action === "clock-out") clockOut($pdo, $user, $body);
} elseif (strpos($route, "tasks") === 0) {
    require "controllers/TaskController.php";
    $user = requireAuth($authSecret);
    requireMenuPermission($user, 'tasks', $pdo);
    $parts = explode("/", $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    if ($method === "GET" && ($id === "options" || $id === "filters")) getTaskFilterOptions($pdo);
    elseif ($method === "GET") getTasks($pdo, $user);
    elseif ($method === "POST") createTask($pdo, $user, $body);
    elseif ($method === "PUT" || $method === "PATCH") updateTask($pdo, $user, $id, $body);
    elseif ($method === "DELETE") deleteTask($pdo, $user, $id);
} elseif (strpos($route, "batches") === 0) {
    require "controllers/BatchController.php";
    $user = requireAuth($authSecret);
    requireMenuPermission($user, 'batches', $pdo);
    $parts = explode("/", $route);
    $id = isset($parts[1]) ? $parts[1] : null;
    if ($method === "GET" && ($id === "options" || $id === "filters")) getBatchFilterOptions($pdo);
    elseif ($method === "GET") getBatches($pdo);
    elseif ($method === "POST") createBatch($pdo, $user, $body);
    elseif ($method === "PUT" || $method === "PATCH") updateBatch($pdo, $user, $id, $body);
    elseif ($method === "DELETE") deleteBatch($pdo, $user, $id);
} elseif ($route === "search-students") {
    require_once 'controllers/StudentController.php';
    ensureStudentsAndEnrollmentsTables($pdo);

    $user = requireAuth($authSecret);

    // Allow staff with 'students' OR 'payments' permission, or admin
    if (isset($user['role']) && strtolower($user['role']) !== 'admin') {
        $stmtPerm = $pdo->prepare("SELECT menu_permissions, role FROM portal_users WHERE id = ?");
        $stmtPerm->execute([$user['sub']]);
        $dbU = $stmtPerm->fetch();
        if ($dbU && strtolower($dbU['role']) !== 'admin') {
            $perms = !empty($dbU['menu_permissions']) ? json_decode($dbU['menu_permissions'], true) : [];
            if (!empty($perms) && !in_array('students', $perms, true) && !in_array('payments', $perms, true)) {
                http_response_code(403);
                echo json_encode(["message" => "Access denied. Requires students or payments permission."]);
                exit();
            }
        }
    }

    $q = isset($_GET['q']) ? trim($_GET['q']) : '';
    if (strlen($q) < 1) {
        echo json_encode([]);
        exit();
    }
    $like = "%{$q}%";
    $sql = "SELECT s.id, s.student_id, s.name, s.guardian_name, s.phone, s.email,
                   COALESCE(s.balance, 0) AS balance,
                   COALESCE(s.total_fees, 0) AS total_fees,
                   GROUP_CONCAT(DISTINCT e.course ORDER BY e.doa DESC SEPARATOR ', ') AS courses,
                   GROUP_CONCAT(DISTINCT CONCAT(e.course, ' (', e.status, ')') ORDER BY e.doa DESC SEPARATOR ', ') AS course_details,
                   MAX(e.doa) AS last_enrollment_date,
                   COUNT(e.id) AS enrollment_count
            FROM students s
            LEFT JOIN enrollments e ON e.student_id = s.student_id
            WHERE s.name LIKE ? OR s.student_id LIKE ? OR s.phone LIKE ?
            GROUP BY s.id, s.student_id, s.name, s.guardian_name, s.phone, s.email, s.balance, s.total_fees
            ORDER BY s.name ASC
            LIMIT 30";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$like, $like, $like]);
    $results = [];

    $enrStmt = $pdo->prepare("SELECT id, enrollment_id, course, status, doa, balance, fee_due FROM enrollments WHERE student_id = ? ORDER BY doa DESC, id DESC");

    while ($row = $stmt->fetch()) {
        $studentId = $row["student_id"];
        $enrolledCourses = [];

        if (!empty($studentId)) {
            $enrStmt->execute([$studentId]);
            while ($er = $enrStmt->fetch()) {
                $c = trim($er["course"] ?? "");
                if ($c !== "") {
                    $enrolledCourses[] = [
                        "id" => (int)$er["id"],
                        "enrollmentId" => $er["enrollment_id"],
                        "course" => $c,
                        "status" => $er["status"] ?? "Active",
                        "doa" => $er["doa"],
                        "balance" => (float)($er["balance"] ?? 0),
                        "feeDue" => (float)($er["fee_due"] ?? 0)
                    ];
                }
            }
        }

        // Fallback: If no rows found in enrollments table yet, split comma string into individual isolated courses
        if (empty($enrolledCourses) && !empty($row["courses"])) {
            $splits = array_filter(array_map('trim', explode(',', $row["courses"])));
            $idx = 1;
            foreach ($splits as $sc) {
                $enrolledCourses[] = [
                    "id" => $idx,
                    "enrollmentId" => "ENR-" . ($studentId ?: $row["id"]) . "-" . $idx,
                    "course" => $sc,
                    "status" => "Active",
                    "doa" => null,
                    "balance" => 0,
                    "feeDue" => 0
                ];
                $idx++;
            }
        }

        $results[] = [
            "id" => (int)$row["id"],
            "studentId" => $row["student_id"],
            "name" => $row["name"],
            "guardianName" => $row["guardian_name"],
            "phone" => $row["phone"],
            "email" => $row["email"],
            "balance" => (float)($row["balance"] ?? 0),
            "totalFees" => (float)($row["total_fees"] ?? 0),
            "courses" => $row["courses"] ?: "",
            "courseDetails" => $row["course_details"] ?: "",
            "lastEnrollmentDate" => $row["last_enrollment_date"],
            "enrollmentCount" => (int)$row["enrollment_count"],
            "enrolledCourses" => $enrolledCourses
        ];
    }

    // Also check enquiries for students or confirmed leads matching the criteria
    try {
        $enqSql = "SELECT id, name, phone, email, course, batch, notes FROM enquiries WHERE name LIKE ? OR phone LIKE ? LIMIT 15";
        $enqStmt = $pdo->prepare($enqSql);
        $enqStmt->execute([$like, $like]);
        $existingKeys = [];
        foreach ($results as $r) {
            $existingKeys[strtolower(trim($r["name"]))] = true;
            if (!empty($r["phone"])) $existingKeys[trim($r["phone"])] = true;
            if (!empty($r["studentId"])) $existingKeys[strtolower(trim($r["studentId"]))] = true;
        }

        while ($er = $enqStmt->fetch()) {
            $cleanN = strtolower(trim($er["name"]));
            $cleanP = trim($er["phone"] ?? "");
            if (!isset($existingKeys[$cleanN]) && (!empty($cleanP) && !isset($existingKeys[$cleanP]))) {
                $enqId = (int)$er["id"];
                $sId = "S" . (1000 + $enqId);
                $courseName = trim($er["course"] ?: ($er["batch"] ?: ""));
                $results[] = [
                    "id" => $enqId,
                    "studentId" => $sId,
                    "name" => $er["name"],
                    "guardianName" => "",
                    "phone" => $er["phone"],
                    "email" => $er["email"],
                    "balance" => 0,
                    "totalFees" => 0,
                    "courses" => $courseName,
                    "courseDetails" => $courseName ? "{$courseName} (Active)" : "",
                    "lastEnrollmentDate" => null,
                    "enrollmentCount" => $courseName ? 1 : 0,
                    "enrolledCourses" => $courseName ? [[
                        "id" => $enqId,
                        "enrollmentId" => "ENR-{$sId}-1",
                        "course" => $courseName,
                        "status" => "Active",
                        "doa" => null,
                        "balance" => 0,
                        "feeDue" => 0
                    ]] : []
                ];
            }
        }
    } catch (Exception $e) {}

    echo json_encode($results);
} else {
    http_response_code(404);
    echo json_encode(["message" => "Endpoint not found"]);
}
