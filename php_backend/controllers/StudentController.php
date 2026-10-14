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
        "balance" => isset($row["balance"]) ? (float)$row["balance"] : 0,
        "totalFees" => isset($row["total_fees"]) ? (float)$row["total_fees"] : 0,
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

function ensureStudentsAndEnrollmentsTables($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS students (
          id INT(11) PRIMARY KEY AUTO_INCREMENT,
          student_id VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(255) NOT NULL,
          guardian_name VARCHAR(255),
          phone VARCHAR(50),
          email VARCHAR(255),
          remarks TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;");

        $pdo->exec("CREATE TABLE IF NOT EXISTS enrollments (
          id INT(11) PRIMARY KEY AUTO_INCREMENT,
          enrollment_id VARCHAR(50) UNIQUE NOT NULL,
          student_id VARCHAR(50) NOT NULL,
          doa DATE,
          course VARCHAR(255),
          status VARCHAR(50) DEFAULT 'Active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;");
    } catch (Exception $e) {}

    // Migrations for existing tables
    $studentCols = [
        "balance"    => "DECIMAL(12,2) DEFAULT 0",
        "total_fees" => "DECIMAL(12,2) DEFAULT 0"
    ];
    foreach ($studentCols as $col => $def) {
        try {
            $pdo->exec("ALTER TABLE students ADD COLUMN $col $def");
        } catch (Exception $e) {}
    }

    $enrCols = [
        "balance" => "DECIMAL(12,2) DEFAULT 0",
        "fee_due" => "DECIMAL(12,2) DEFAULT 0"
    ];
    foreach ($enrCols as $col => $def) {
        try {
            $pdo->exec("ALTER TABLE enrollments ADD COLUMN $col $def");
        } catch (Exception $e) {}
    }
}

function generateNextStudentId($pdo) {
    ensureStudentsAndEnrollmentsTables($pdo);
    $stmt = $pdo->query("SELECT student_id FROM students ORDER BY id DESC LIMIT 100");
    $maxNum = 1000;
    while ($row = $stmt->fetch()) {
        if (preg_match('/(?:S|STU-?)([0-9]+)/i', $row['student_id'], $m)) {
            $num = (int)$m[1];
            if ($num > $maxNum) $maxNum = $num;
        }
    }
    do {
        $maxNum++;
        $newId = "S" . $maxNum;
        $chk = $pdo->prepare("SELECT id FROM students WHERE student_id = ?");
        $chk->execute([$newId]);
    } while ($chk->fetch());
    return $newId;
}

function generateNextEnrollmentId($pdo) {
    ensureStudentsAndEnrollmentsTables($pdo);
    $stmt = $pdo->query("SELECT enrollment_id FROM enrollments ORDER BY id DESC LIMIT 100");
    $maxNum = 200000;
    while ($row = $stmt->fetch()) {
        if (preg_match('/([0-9]{4,})$/', $row['enrollment_id'], $m)) {
            $num = (int)$m[1];
            if ($num > $maxNum) $maxNum = $num;
        }
    }
    do {
        $maxNum++;
        $newEnrId = "M" . $maxNum;
        $chk = $pdo->prepare("SELECT id FROM enrollments WHERE enrollment_id = ?");
        $chk->execute([$newEnrId]);
    } while ($chk->fetch());
    return $newEnrId;
}

function createStudent($pdo, $body) {
    ensureStudentsAndEnrollmentsTables($pdo);

    $name = trim($body["name"] ?? "");
    $guardianName = trim($body["guardianName"] ?? "");
    $phone = trim($body["phone"] ?? "");
    $email = trim($body["email"] ?? "");
    $remarks = trim($body["remarks"] ?? "");
    $course = trim($body["course"] ?? ($body["courseSelection"] ?? ""));
    $rawStudentId = trim($body["studentId"] ?? "");

    if (!$name) {
        http_response_code(400);
        die(json_encode(["error" => true, "message" => "Student Name is required."]));
    }

    $cleanName = strtolower($name);
    $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
    $cleanEmail = strtolower($email);

    // 1. Validation check across existing records based on "Name", "Phone", and "Email"
    $stmt = $pdo->prepare("SELECT * FROM students WHERE LOWER(TRIM(name)) = ?");
    $stmt->execute([$cleanName]);
    $candidates = $stmt->fetchAll();

    $matchedStudent = null;
    foreach ($candidates as $cand) {
        $candPhone = preg_replace('/[^0-9]/', '', $cand['phone'] ?? '');
        $candEmail = strtolower(trim($cand['email'] ?? ''));

        // Match Name, Phone, and Email
        $phoneMatches = ($cleanPhone !== '' && $candPhone !== '' && ($cleanPhone === $candPhone || substr($cleanPhone, -10) === substr($candPhone, -10)))
                        || ($cleanPhone === '' && $candPhone === '');
        $emailMatches = ($cleanEmail !== '' && $candEmail !== '' && $cleanEmail === $candEmail)
                        || ($cleanEmail === '' && $candEmail === '');

        if ($phoneMatches && $emailMatches) {
            $matchedStudent = $cand;
            break;
        }
    }

    // 2. If a record exactly matches an existing student's Name, Phone, and Email:
    if ($matchedStudent) {
        $existingStudentId = $matchedStudent['student_id'];

        if (!empty($course)) {
            // Check if student already enrolled in this exact course
            $chkEnr = $pdo->prepare("SELECT * FROM enrollments WHERE student_id = ? AND LOWER(TRIM(course)) = ?");
            $chkEnr->execute([$existingStudentId, strtolower($course)]);
            $existingEnrollment = $chkEnr->fetch();

            if ($existingEnrollment) {
                // If all personal identifiers (Name, Phone, Email) AND the Course Selection match -> BLOCK duplicate entry
                http_response_code(409);
                echo json_encode([
                    "error" => true,
                    "code" => "DUPLICATE_ENROLLMENT",
                    "message" => "Duplicate entry: Student '{$matchedStudent['name']}' ($existingStudentId) is already enrolled in '{$course}'."
                ]);
                exit();
            }

            // If different "Course Selection" -> ALLOW: Add new course registration under the same student identity
            $now = date("Y-m-d H:i:s");
            $newEnrId = generateNextEnrollmentId($pdo);
            $doa = !empty($body["doa"]) ? $body["doa"] : date("Y-m-d");
            $insertEnr = $pdo->prepare("INSERT INTO enrollments (enrollment_id, student_id, doa, course, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'Active', ?, ?)");
            $insertEnr->execute([$newEnrId, $existingStudentId, $doa, $course, $now, $now]);

            if (!empty($remarks) && $remarks !== ($matchedStudent['remarks'] ?? '')) {
                $mergedRemarks = trim(($matchedStudent['remarks'] ? $matchedStudent['remarks'] . " | " : "") . $remarks);
                $upd = $pdo->prepare("UPDATE students SET remarks = ?, updated_at = ? WHERE id = ?");
                $upd->execute([$mergedRemarks, $now, $matchedStudent['id']]);
            }

            http_response_code(200);
            $res = normalizeStudent($matchedStudent);
            $res["isExistingStudent"] = true;
            $res["message"] = "Added new course enrollment ($course) under existing student ID: $existingStudentId.";
            echo json_encode($res);
            exit();
        } else {
            http_response_code(409);
            echo json_encode([
                "error" => true,
                "message" => "Student '{$matchedStudent['name']}' ($existingStudentId) already exists in the system."
            ]);
            exit();
        }
    }

    // 3. If any core personal detail differs -> Treat as brand-new unique student record
    $finalStudentId = (!empty($rawStudentId) && strtolower($rawStudentId) !== 'autofilled') 
        ? $rawStudentId 
        : generateNextStudentId($pdo);

    // Ensure student_id uniqueness
    $chkId = $pdo->prepare("SELECT id FROM students WHERE student_id = ?");
    $chkId->execute([$finalStudentId]);
    if ($chkId->fetch()) {
        $finalStudentId = generateNextStudentId($pdo);
    }

    $now = date("Y-m-d H:i:s");
    $stmt = $pdo->prepare("INSERT INTO students (student_id, name, guardian_name, phone, email, remarks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $stmt->execute([$finalStudentId, $name, $guardianName, $phone, $email, $remarks, $now, $now]);
    $newDbId = $pdo->lastInsertId();

    // Create enrollment for the course if selected
    if (!empty($course)) {
        $newEnrId = generateNextEnrollmentId($pdo);
        $doa = !empty($body["doa"]) ? $body["doa"] : date("Y-m-d");
        $insertEnr = $pdo->prepare("INSERT INTO enrollments (enrollment_id, student_id, doa, course, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'Active', ?, ?)");
        $insertEnr->execute([$newEnrId, $finalStudentId, $doa, $course, $now, $now]);
    }

    $stmt = $pdo->prepare("SELECT * FROM students WHERE id = ?");
    $stmt->execute([$newDbId]);
    http_response_code(201);
    echo json_encode(normalizeStudent($stmt->fetch()));
    exit();
}

function updateStudent($pdo, $id, $body) {
    $updates = [];
    $params = [];
    $now = date("Y-m-d H:i:s");
    
    $fields = [
        "studentId" => "student_id",
        "name" => "name",
        "guardianName" => "guardian_name",
        "phone" => "phone",
        "email" => "email",
        "remarks" => "remarks",
        "balance" => "balance",
        "totalFees" => "total_fees"
    ];
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

