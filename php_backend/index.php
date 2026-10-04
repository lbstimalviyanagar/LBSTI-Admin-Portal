<?php
error_reporting(0);
ini_set("display_errors", 0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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
    $stmt = $pdo->prepare("SELECT profile_photo FROM portal_users WHERE id = ?");
    $stmt->execute([$user['sub']]);
    $dbUser = $stmt->fetch();
    $user['profilePhotoUrl'] = $dbUser ? $dbUser['profile_photo'] : null;
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
    elseif ($method === 'PUT') updateUser($pdo, $id, $body);
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
} else {
    http_response_code(404);
    echo json_encode(["message" => "Endpoint not found"]);
}
