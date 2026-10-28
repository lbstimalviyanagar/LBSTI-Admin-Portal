<?php

function getBatches($pdo) {
    try {
        $date = $_GET['date'] ?? null;
        $course = $_GET['course'] ?? null;
        $instructorId = $_GET['instructor_id'] ?? null;
        $status = $_GET['status'] ?? null;
        $q = $_GET['q'] ?? null;

        $conditions = [];
        $params = [];

        if (!empty($date)) {
            $conditions[] = "b.`date` = ?";
            $params[] = $date;
        }

        if (!empty($course) && strtolower($course) !== 'all') {
            $conditions[] = "LOWER(TRIM(b.course_name)) = LOWER(TRIM(?))";
            $params[] = $course;
        }

        if ($instructorId !== null && $instructorId !== '' && strtolower($instructorId) !== 'all') {
            if (strtolower($instructorId) === 'unassigned' || $instructorId === '0') {
                $conditions[] = "(b.instructor_id IS NULL OR b.instructor_id = 0)";
            } else {
                $conditions[] = "b.instructor_id = ?";
                $params[] = $instructorId;
            }
        }

        if (!empty($status) && strtolower($status) !== 'all') {
            $conditions[] = "LOWER(TRIM(b.status)) = LOWER(TRIM(?))";
            $params[] = $status;
        }

        if (!empty($q)) {
            $like = "%" . trim($q) . "%";
            $conditions[] = "(b.course_name LIKE ? OR b.topic LIKE ? OR u.full_name LIKE ? OR b.batch_time LIKE ? OR b.status LIKE ?)";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $pdo->prepare("
            SELECT b.*, u.full_name as instructor_name 
            FROM institute_batches b 
            LEFT JOIN portal_users u ON u.id = b.instructor_id 
            {$whereClause}
            ORDER BY b.batch_time ASC, b.id ASC
        ");
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getBatchFilterOptions($pdo) {
    try {
        $courses = [];
        try {
            $stmt = $pdo->query("SELECT DISTINCT course_name FROM institute_batches WHERE course_name IS NOT NULL AND TRIM(course_name) != '' ORDER BY course_name ASC");
            while ($row = $stmt->fetchColumn()) {
                if ($row) $courses[] = trim($row);
            }
        } catch (Exception $e) {}

        try {
            $stmt = $pdo->query("SELECT DISTINCT course FROM enrollments WHERE course IS NOT NULL AND TRIM(course) != '' ORDER BY course ASC");
            while ($row = $stmt->fetchColumn()) {
                if ($row) $courses[] = trim($row);
            }
        } catch (Exception $e) {}

        try {
            $stmt = $pdo->query("SELECT DISTINCT course FROM enquiries WHERE course IS NOT NULL AND TRIM(course) != '' ORDER BY course ASC");
            while ($row = $stmt->fetchColumn()) {
                if ($row) $courses[] = trim($row);
            }
        } catch (Exception $e) {}

        $courses = array_values(array_unique(array_filter($courses)));
        sort($courses, SORT_NATURAL | SORT_FLAG_CASE);

        $faculty = [];
        try {
            $stmt = $pdo->query("SELECT id, full_name, username, role FROM portal_users WHERE (full_name IS NOT NULL AND TRIM(full_name) != '') OR (username IS NOT NULL AND TRIM(username) != '') ORDER BY full_name ASC");
            while ($row = $stmt->fetch()) {
                $name = trim($row['full_name'] ?: $row['username']);
                if ($name && strtolower($name) !== 'unassigned') {
                    $faculty[] = [
                        'id' => (int)$row['id'],
                        'name' => $name,
                        'role' => $row['role'] ?? 'teacher'
                    ];
                }
            }
        } catch (Exception $e) {}

        echo json_encode([
            "courses" => $courses,
            "faculty" => $faculty
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createBatch($pdo, $user, $body) {
    try {
        $batchTime = $body['batchTime'] ?? null;
        $instructorId = $user['role'] === 'admin' ? ($body['instructorId'] ?? null) : $user['sub'];
        $courseName = $body['courseName'] ?? null;
        $topic = $body['topic'] ?? null;
        $studentCount = $body['studentCount'] ?? 0;
        $status = $body['status'] ?? 'Upcoming';
        $date = $body['date'] ?? date('Y-m-d');

        if (!$batchTime || !$courseName || !$date) {
            http_response_code(400);
            echo json_encode(["message" => "Batch time, course name, and date are required."]);
            return;
        }

        $stmt = $pdo->prepare("INSERT INTO institute_batches (batch_time, instructor_id, course_name, topic, student_count, status, `date`) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$batchTime, $instructorId, $courseName, $topic, $studentCount, $status, $date]);
        
        $id = $pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM institute_batches WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode($stmt->fetch());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function updateBatch($pdo, $user, $id, $body) {
    try {
        $stmt = $pdo->prepare("SELECT * FROM institute_batches WHERE id = ?");
        $stmt->execute([$id]);
        $batch = $stmt->fetch();

        if (!$batch) {
            http_response_code(404);
            echo json_encode(["message" => "Batch not found."]);
            return;
        }

        if ($user['role'] !== 'admin' && (int)$batch['instructor_id'] !== (int)$user['sub']) {
            http_response_code(403);
            echo json_encode(["message" => "Access denied. You can only edit your own batches."]);
            return;
        }

        $batchTime = $body['batchTime'] ?? $batch['batch_time'];
        $instructorId = $body['instructorId'] ?? $batch['instructor_id'];
        $courseName = $body['courseName'] ?? $batch['course_name'];
        $topic = $body['topic'] ?? $batch['topic'];
        $studentCount = $body['studentCount'] ?? $batch['student_count'];
        $status = $body['status'] ?? $batch['status'];
        $date = $body['date'] ?? $batch['date'];

        $stmt = $pdo->prepare("UPDATE institute_batches SET batch_time = ?, instructor_id = ?, course_name = ?, topic = ?, student_count = ?, status = ?, `date` = ? WHERE id = ?");
        $stmt->execute([$batchTime, $instructorId, $courseName, $topic, $studentCount, $status, $date, $id]);

        $stmt = $pdo->prepare("
            SELECT b.*, u.full_name as instructor_name 
            FROM institute_batches b 
            LEFT JOIN portal_users u ON u.id = b.instructor_id 
            WHERE b.id = ?
        ");
        $stmt->execute([$id]);
        echo json_encode($stmt->fetch());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function deleteBatch($pdo, $user, $id) {
    try {
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["message" => "Only admins can manage batches."]);
            return;
        }

        $stmt = $pdo->prepare("DELETE FROM institute_batches WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["message" => "Batch deleted"]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}
