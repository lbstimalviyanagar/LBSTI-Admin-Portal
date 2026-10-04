<?php
function normalizeEnrollment($row) {
    return [
        "id" => (int)$row["id"],
        "enrollmentId" => $row["enrollment_id"],
        "studentId" => $row["student_id"],
        "doa" => $row["doa"],
        "course" => $row["course"],
        "status" => $row["status"],
        "createdAt" => $row["created_at"],
        "updatedAt" => $row["updated_at"],
        "studentName" => $row["student_name"] ?? ""
    ];
}

function getEnrollments($pdo) {
    $stmt = $pdo->query("SELECT e.*, s.name as student_name FROM enrollments e LEFT JOIN students s ON s.student_id = e.student_id ORDER BY e.created_at DESC");
    $data = [];
    while ($row = $stmt->fetch()) {
        $data[] = normalizeEnrollment($row);
    }
    echo json_encode($data);
}

function createEnrollment($pdo, $body) {
    $enrollmentId = $body["enrollmentId"] ?? "";
    $studentId = $body["studentId"] ?? "";
    if (!$enrollmentId || !$studentId) {
        http_response_code(400);
        die(json_encode(["message" => "Enrollment ID and Student ID required."]));
    }
    
    $stmt = $pdo->prepare("SELECT id FROM enrollments WHERE enrollment_id = ?");
    $stmt->execute([$enrollmentId]);
    if ($stmt->fetch()) {
        http_response_code(409);
        die(json_encode(["message" => "Enrollment ID already exists."]));
    }
    
    $now = date("Y-m-d H:i:s");
    $stmt = $pdo->prepare("INSERT INTO enrollments (enrollment_id, student_id, doa, course, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$enrollmentId, $studentId, $body["doa"] ?? "", $body["course"] ?? "", $body["status"] ?? "Active", $now, $now]);
    
    $id = $pdo->lastInsertId();
    $stmt = $pdo->prepare("SELECT e.*, s.name as student_name FROM enrollments e LEFT JOIN students s ON s.student_id = e.student_id WHERE e.id = ?");
    $stmt->execute([$id]);
    http_response_code(201);
    echo json_encode(normalizeEnrollment($stmt->fetch()));
}

function updateEnrollment($pdo, $id, $body) {
    $updates = [];
    $params = [];
    $now = date("Y-m-d H:i:s");
    
    $fields = ["enrollmentId" => "enrollment_id", "studentId" => "student_id", "doa" => "doa", "course" => "course", "status" => "status"];
    foreach ($fields as $jsonKey => $dbKey) {
        if (array_key_exists($jsonKey, $body)) {
            $updates[] = "$dbKey = ?";
            $params[] = $body[$jsonKey];
        }
    }
    
    if (count($updates) > 0) {
        $updates[] = "updated_at = ?";
        $params[] = $now;
        $params[] = $id;
        $sql = "UPDATE enrollments SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    $stmt = $pdo->prepare("SELECT e.*, s.name as student_name FROM enrollments e LEFT JOIN students s ON s.student_id = e.student_id WHERE e.id = ?");
    $stmt->execute([$id]);
    echo json_encode(normalizeEnrollment($stmt->fetch()));
}

function deleteEnrollment($pdo, $id) {
    $stmt = $pdo->prepare("DELETE FROM enrollments WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(["message" => "Enrollment deleted."]);
}

function bulkCreateEnrollments($pdo, $body) {
    $enrollments = $body["enrollments"] ?? [];
    if (!is_array($enrollments) || empty($enrollments)) {
        http_response_code(400);
        die(json_encode(["message" => "No valid data provided."]));
    }
    $success = 0;
    $now = date("Y-m-d H:i:s");
    foreach ($enrollments as $en) {
        if (empty($en["enrollmentId"]) || empty($en["studentId"])) continue;
        try {
            $stmt = $pdo->prepare("INSERT INTO enrollments (enrollment_id, student_id, doa, course, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE student_id=VALUES(student_id), doa=VALUES(doa), course=VALUES(course), status=VALUES(status), updated_at=VALUES(updated_at)");
            $stmt->execute([$en["enrollmentId"], $en["studentId"], $en["doa"] ?? "", $en["course"] ?? "", $en["status"] ?? "Active", $now, $now]);
            $success++;
        } catch (Exception $e) {}
    }
    echo json_encode(["message" => "Imported $success enrollments."]);
}

