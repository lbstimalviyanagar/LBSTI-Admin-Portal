<?php

date_default_timezone_set('Asia/Kolkata');

function ensureStudentAttendanceTable($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `student_attendance` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `student_id` VARCHAR(50) NOT NULL,
            `student_name` VARCHAR(255) NOT NULL,
            `course` VARCHAR(255) DEFAULT NULL,
            `batch_time` VARCHAR(100) DEFAULT NULL,
            `date` DATE NOT NULL,
            `status` ENUM('Present', 'Absent', 'Leave') NOT NULL DEFAULT 'Present',
            `remarks` TEXT DEFAULT NULL,
            `recorded_by` VARCHAR(190) DEFAULT 'Admin',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_student_date_batch` (`student_id`, `date`, `batch_time`),
            KEY `idx_attendance_date` (`date`),
            KEY `idx_attendance_course` (`course`),
            KEY `idx_attendance_student` (`student_id`, `date`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    } catch (Exception $e) {}
}

function getStudentAttendance($pdo) {
    ensureStudentAttendanceTable($pdo);
    try {
        $date = $_GET['date'] ?? null;
        $course = $_GET['course'] ?? null;
        $batchTime = $_GET['batch_time'] ?? null;
        $studentId = $_GET['student_id'] ?? null;
        $status = $_GET['status'] ?? null;
        $q = $_GET['q'] ?? null;

        $conditions = [];
        $params = [];

        if (!empty($date) && strtolower($date) !== 'all') {
            $conditions[] = "sa.`date` = ?";
            $params[] = $date;
        }

        if (!empty($course) && strtolower($course) !== 'all') {
            $conditions[] = "LOWER(TRIM(sa.course)) = LOWER(TRIM(?))";
            $params[] = $course;
        }

        if (!empty($batchTime) && strtolower($batchTime) !== 'all') {
            $conditions[] = "LOWER(TRIM(sa.batch_time)) = LOWER(TRIM(?))";
            $params[] = $batchTime;
        }

        if (!empty($studentId) && strtolower($studentId) !== 'all') {
            $conditions[] = "sa.student_id = ?";
            $params[] = $studentId;
        }

        if (!empty($status) && strtolower($status) !== 'all') {
            $conditions[] = "sa.status = ?";
            $params[] = ucfirst(strtolower($status));
        }

        if (!empty($q)) {
            $like = "%" . trim($q) . "%";
            $conditions[] = "(sa.student_name LIKE ? OR sa.student_id LIKE ? OR sa.course LIKE ? OR sa.batch_time LIKE ? OR sa.remarks LIKE ?)";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $pdo->prepare("SELECT sa.* FROM student_attendance sa {$whereClause} ORDER BY sa.`date` DESC, sa.student_name ASC");
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function recordStudentAttendance($pdo, $body, $user = null) {
    ensureStudentAttendanceTable($pdo);
    $recordedBy = !empty($user['name']) ? $user['name'] : (!empty($user['username']) ? $user['username'] : 'Admin');

    // Support both single record and batch of records
    $records = [];
    if (isset($body['records']) && is_array($body['records'])) {
        $records = $body['records'];
    } elseif (isset($body['studentId']) || isset($body['student_id'])) {
        $records = [$body];
    }

    if (empty($records)) {
        http_response_code(400);
        echo json_encode(["message" => "No attendance records provided."]);
        return;
    }

    $saved = 0;
    $errors = [];

    $sql = "INSERT INTO student_attendance 
            (student_id, student_name, course, batch_time, date, status, remarks, recorded_by, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE 
                status = VALUES(status), 
                remarks = VALUES(remarks), 
                recorded_by = VALUES(recorded_by), 
                updated_at = NOW()";
    $stmt = $pdo->prepare($sql);

    foreach ($records as $r) {
        $sId = trim($r['student_id'] ?? $r['studentId'] ?? '');
        $name = trim($r['student_name'] ?? $r['studentName'] ?? $r['name'] ?? '');
        $date = trim($r['date'] ?? date('Y-m-d'));
        $course = trim($r['course'] ?? '');
        $batch = trim($r['batch_time'] ?? $r['batchTime'] ?? $r['batch'] ?? '');
        $status = ucfirst(strtolower(trim($r['status'] ?? 'Present')));
        if (!in_array($status, ['Present', 'Absent', 'Leave'])) $status = 'Present';
        $remarks = trim($r['remarks'] ?? '');

        if (!$sId || !$name || !$date) {
            $errors[] = "Missing student ID, name, or date for record.";
            continue;
        }

        try {
            $stmt->execute([$sId, $name, $course ?: null, $batch ?: null, $date, $status, $remarks ?: null, $recordedBy]);
            $saved++;
        } catch (PDOException $e) {
            $errors[] = "Error for {$sId}: " . $e->getMessage();
        }
    }

    echo json_encode([
        "ok" => true,
        "savedCount" => $saved,
        "errors" => $errors,
        "message" => "Successfully saved attendance for {$saved} student(s)."
    ]);
}

function updateStudentAttendance($pdo, $id, $body) {
    ensureStudentAttendanceTable($pdo);
    $id = (int)$id;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid attendance record ID."]);
        return;
    }

    $fields = [];
    $params = [];

    if (isset($body['status'])) {
        $st = ucfirst(strtolower(trim($body['status'])));
        if (in_array($st, ['Present', 'Absent', 'Leave'])) {
            $fields[] = "status = ?";
            $params[] = $st;
        }
    }
    if (isset($body['remarks'])) {
        $fields[] = "remarks = ?";
        $params[] = trim($body['remarks']);
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["message" => "No fields to update."]);
        return;
    }

    $fields[] = "updated_at = NOW()";
    $params[] = $id;

    try {
        $sql = "UPDATE student_attendance SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $fetchStmt = $pdo->prepare("SELECT * FROM student_attendance WHERE id = ?");
        $fetchStmt->execute([$id]);
        echo json_encode($fetchStmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getStudentAttendanceHistory($pdo) {
    ensureStudentAttendanceTable($pdo);
    $studentId = trim($_GET['student_id'] ?? $_GET['studentId'] ?? '');
    if (!$studentId) {
        http_response_code(400);
        echo json_encode(["message" => "Student ID is required."]);
        return;
    }

    try {
        $stmt = $pdo->prepare("SELECT * FROM student_attendance WHERE student_id = ? ORDER BY date DESC, id DESC");
        $stmt->execute([$studentId]);
        $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalSessions = count($history);
        $presentCount = 0;
        $absentCount = 0;
        $leaveCount = 0;

        foreach ($history as $h) {
            if ($h['status'] === 'Present') $presentCount++;
            elseif ($h['status'] === 'Absent') $absentCount++;
            elseif ($h['status'] === 'Leave') $leaveCount++;
        }

        $percentage = $totalSessions > 0 ? round(($presentCount / $totalSessions) * 100, 1) : 0.0;

        echo json_encode([
            "studentId" => $studentId,
            "totalSessions" => $totalSessions,
            "presentCount" => $presentCount,
            "absentCount" => $absentCount,
            "leaveCount" => $leaveCount,
            "percentage" => $percentage,
            "history" => $history
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getStudentAttendanceSummary($pdo) {
    ensureStudentAttendanceTable($pdo);
    try {
        $month = $_GET['month'] ?? date('Y-m');
        $course = $_GET['course'] ?? null;

        $conditions = ["DATE_FORMAT(date, '%Y-%m') = ?"];
        $params = [$month];

        if (!empty($course) && strtolower($course) !== 'all') {
            $conditions[] = "LOWER(TRIM(course)) = LOWER(TRIM(?))";
            $params[] = $course;
        }

        $whereClause = "WHERE " . implode(" AND ", $conditions);

        $stmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_records,
                SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
                SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_count,
                SUM(CASE WHEN status = 'Leave' THEN 1 ELSE 0 END) as leave_count,
                COUNT(DISTINCT date) as distinct_dates,
                COUNT(DISTINCT student_id) as distinct_students
            FROM student_attendance
            {$whereClause}
        ");
        $stmt->execute($params);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        $total = (int)($stats['total_records'] ?? 0);
        $present = (int)($stats['present_count'] ?? 0);
        $absent = (int)($stats['absent_count'] ?? 0);
        $leave = (int)($stats['leave_count'] ?? 0);
        $pct = $total > 0 ? round(($present / $total) * 100, 1) : 0.0;

        echo json_encode([
            "month" => $month,
            "totalSessions" => $total,
            "presentCount" => $present,
            "absentCount" => $absent,
            "leaveCount" => $leave,
            "distinctDates" => (int)($stats['distinct_dates'] ?? 0),
            "distinctStudents" => (int)($stats['distinct_students'] ?? 0),
            "percentage" => $pct
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

