<?php
function normalizeStudent($row) {
    return [
        "id" => (int)$row["id"],
        "studentId" => $row["student_id"],
        "name" => $row["name"],
        "guardianName" => $row["guardian_name"],
        "phone" => $row["phone"],
        "email" => $row["email"],
        "remarks" => $row["remarks"],
        "createdAt" => $row["created_at"],
        "updatedAt" => $row["updated_at"]
    ];
}

function getStudents($pdo) {
    $stmt = $pdo->query("SELECT * FROM students ORDER BY created_at DESC");
    $data = [];
    while ($row = $stmt->fetch()) {
        $data[] = normalizeStudent($row);
    }
    echo json_encode($data);
}

function createStudent($pdo, $body) {
    $studentId = $body["studentId"] ?? "";
    $name = $body["name"] ?? "";
    if (!$studentId || !$name) {
        http_response_code(400);
        die(json_encode(["message" => "Student ID and Name required."]));
    }
    
    $stmt = $pdo->prepare("SELECT id FROM students WHERE student_id = ?");
    $stmt->execute([$studentId]);
    if ($stmt->fetch()) {
        http_response_code(409);
        die(json_encode(["message" => "Student ID already exists."]));
    }
    
    $now = date("Y-m-d H:i:s");
    $stmt = $pdo->prepare("INSERT INTO students (student_id, name, guardian_name, phone, email, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$studentId, $name, $body["guardianName"] ?? "", $body["phone"] ?? "", $body["email"] ?? "", $body["remarks"] ?? "", $now, $now]);
    
    $id = $pdo->lastInsertId();
    $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$id]);
    http_response_code(201);
    echo json_encode(normalizeStudent($stmt->fetch()));
}

function updateStudent($pdo, $id, $body) {
    $updates = [];
    $params = [];
    $now = date("Y-m-d H:i:s");
    
    $fields = ["studentId" => "student_id", "name" => "name", "guardianName" => "guardian_name", "phone" => "phone", "email" => "email", "remarks" => "remarks"];
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
        $sql = "UPDATE students SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(normalizeStudent($stmt->fetch()));
}

function deleteStudent($pdo, $id) {
    $stmt = $pdo->prepare("DELETE FROM students WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(["message" => "Student deleted."]);
}

function bulkCreateStudents($pdo, $body) {
    $students = $body["students"] ?? [];
    if (!is_array($students) || empty($students)) {
        http_response_code(400);
        die(json_encode(["message" => "No valid data provided."]));
    }
    $success = 0;
    $now = date("Y-m-d H:i:s");
    foreach ($students as $st) {
        if (empty($st["studentId"]) || empty($st["name"])) continue;
        try {
            $stmt = $pdo->prepare("INSERT INTO students (student_id, name, guardian_name, phone, email, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), guardian_name=VALUES(guardian_name), phone=VALUES(phone), email=VALUES(email), remarks=VALUES(remarks), updated_at=VALUES(updated_at)");
            $stmt->execute([$st["studentId"], $st["name"], $st["guardianName"] ?? "", $st["phone"] ?? "", $st["email"] ?? "", $st["remarks"] ?? "", $now, $now]);
            $success++;
        } catch (Exception $e) {}
    }
    echo json_encode(["message" => "Imported $success students."]);
}

