<?php

function ensureBatchesTable($pdo) {
    static $initialized = false;
    if ($initialized) return;
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `institute_batches` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `batch_name` VARCHAR(255) DEFAULT NULL,
            `batch_time` VARCHAR(100) NOT NULL,
            `instructor_id` BIGINT UNSIGNED DEFAULT NULL,
            `course_name` VARCHAR(255) NOT NULL,
            `topic` VARCHAR(255) DEFAULT NULL,
            `student_count` INT DEFAULT 0,
            `students` TEXT DEFAULT NULL,
            `status` VARCHAR(50) DEFAULT 'Upcoming',
            `date` DATE NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_batch_time` (`batch_time`),
            KEY `idx_instructor` (`instructor_id`),
            KEY `idx_course` (`course_name`(100))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        try {
            $pdo->exec("ALTER TABLE `institute_batches` ADD COLUMN `batch_name` VARCHAR(255) DEFAULT NULL AFTER `id`;");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE `institute_batches` ADD COLUMN `students` TEXT DEFAULT NULL AFTER `student_count`;");
        } catch (Exception $e) {}

        $initialized = true;
    } catch (Exception $e) {
        error_log("Batch table setup warning: " . $e->getMessage());
    }
}

function getBatches($pdo) {
    ensureBatchesTable($pdo);
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
            $conditions[] = "(b.course_name LIKE ? OR b.topic LIKE ? OR b.batch_name LIKE ? OR u.full_name LIKE ? OR b.batch_time LIKE ? OR b.status LIKE ? OR b.students LIKE ?)";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $pdo->prepare("
            SELECT b.*, 
                   COALESCE(b.batch_name, b.topic, b.course_name) as display_name,
                   u.full_name as instructor_name 
            FROM institute_batches b 
            LEFT JOIN portal_users u ON u.id = b.instructor_id 
            {$whereClause}
            ORDER BY 
                COALESCE(STR_TO_DATE(TRIM(SUBSTRING_INDEX(b.batch_time, '-', 1)), '%h:%i %p'), '23:59:59') ASC,
                b.batch_time ASC,
                b.id ASC
        ");
        $stmt->execute($params);
        $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $parseTime = function($timeStr) {
            if (empty($timeStr)) return 9999;
            $parts = preg_split('/[-–—]|to/i', $timeStr);
            $start = trim($parts[0] ?? '');
            if (preg_match('/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i', $start, $m)) {
                $h = (int)$m[1];
                $min = isset($m[2]) && $m[2] !== '' ? (int)$m[2] : 0;
                $ampm = strtoupper($m[3] ?? '');
                if ($ampm === 'PM' && $h < 12) $h += 12;
                else if ($ampm === 'AM' && $h === 12) $h = 0;
                return ($h * 60) + $min;
            }
            return 9999;
        };

        usort($batches, function($a, $b) use ($parseTime) {
            $tA = $parseTime($a['batch_time'] ?? '');
            $tB = $parseTime($b['batch_time'] ?? '');
            if ($tA !== $tB) {
                return $tA - $tB;
            }
            $cComp = strcasecmp($a['course_name'] ?? '', $b['course_name'] ?? '');
            if ($cComp !== 0) {
                return $cComp;
            }
            return ($a['id'] ?? 0) <=> ($b['id'] ?? 0);
        });

        echo json_encode($batches);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getBatchFilterOptions($pdo) {
    ensureBatchesTable($pdo);
    try {
        $courses = [];
        try {
            $stmt = $pdo->query("SELECT DISTINCT course_name FROM institute_batches WHERE course_name IS NOT NULL AND TRIM(course_name) != '' ORDER BY course_name ASC");
            while ($row = $stmt->fetchColumn()) {
                if ($row) $courses[] = trim($row);
            }
        } catch (Exception $e) {}

        try {
            $stmt = $pdo->query("SELECT DISTINCT name FROM courses WHERE is_active = 1 AND name IS NOT NULL AND TRIM(name) != '' ORDER BY name ASC");
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
    ensureBatchesTable($pdo);
    try {
        $userRole = strtolower($user['role'] ?? '');
        if ($userRole !== 'admin' && $userRole !== 'teacher') {
            http_response_code(403);
            echo json_encode(["message" => "Access denied. Only administrators and authorized teachers can create batches."]);
            return;
        }

        $batchTime = trim($body['batchTime'] ?? $body['batch_time'] ?? '');
        $courseName = trim($body['courseName'] ?? $body['course_name'] ?? '');
        $batchName = trim($body['batchName'] ?? $body['batch_name'] ?? '');
        $topic = trim($body['topic'] ?? '');
        $status = trim($body['status'] ?? 'Upcoming');
        $date = trim($body['date'] ?? date('Y-m-d'));
        $students = trim($body['students'] ?? '');

        // Instructor ID
        $instructorId = null;
        if (array_key_exists('instructorId', $body) || array_key_exists('instructor_id', $body)) {
            $rawInst = $body['instructorId'] ?? $body['instructor_id'];
            if ($rawInst !== '' && $rawInst !== '0' && $rawInst !== 0 && $rawInst !== null && strtolower(strval($rawInst)) !== 'unassigned') {
                $instructorId = (int)$rawInst;
            }
        }
        if ($instructorId === null && $userRole === 'teacher') {
            $instructorId = (int)$user['sub'];
        }

        // Student count
        $studentCount = 0;
        if (isset($body['studentCount']) && is_numeric($body['studentCount'])) {
            $studentCount = (int)$body['studentCount'];
        } elseif (isset($body['student_count']) && is_numeric($body['student_count'])) {
            $studentCount = (int)$body['student_count'];
        } elseif (!empty($students)) {
            $items = array_filter(array_map('trim', preg_split('/[\r\n,]+/', $students)));
            $studentCount = count($items);
        }

        if (!$batchTime || !$courseName) {
            http_response_code(400);
            echo json_encode(["message" => "Batch time slot and course name are required."]);
            return;
        }

        if (empty($batchName)) {
            $batchName = $topic ?: "{$courseName} ({$batchTime})";
        }
        if (empty($topic)) {
            $topic = $batchName;
        }

        $stmt = $pdo->prepare("
            INSERT INTO institute_batches 
                (batch_name, batch_time, instructor_id, course_name, topic, student_count, students, status, `date`) 
            VALUES 
                (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $batchName,
            $batchTime,
            $instructorId,
            $courseName,
            $topic,
            $studentCount,
            $students,
            $status,
            $date
        ]);

        $id = $pdo->lastInsertId();
        $stmt = $pdo->prepare("
            SELECT b.*, u.full_name as instructor_name 
            FROM institute_batches b 
            LEFT JOIN portal_users u ON u.id = b.instructor_id 
            WHERE b.id = ?
        ");
        $stmt->execute([$id]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);

        http_response_code(201);
        echo json_encode($record);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function updateBatch($pdo, $user, $id, $body) {
    ensureBatchesTable($pdo);
    try {
        $userRole = strtolower($user['role'] ?? '');
        if ($userRole !== 'admin' && $userRole !== 'teacher') {
            http_response_code(403);
            echo json_encode(["message" => "Access denied. Only administrators and authorized teachers can edit batches."]);
            return;
        }

        $stmt = $pdo->prepare("SELECT * FROM institute_batches WHERE id = ?");
        $stmt->execute([$id]);
        $batch = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$batch) {
            http_response_code(404);
            echo json_encode(["message" => "Batch not found."]);
            return;
        }

        $isAssignedToOther = !empty($batch['instructor_id']) && (int)$batch['instructor_id'] !== (int)$user['sub'];
        if ($userRole !== 'admin' && $isAssignedToOther) {
            http_response_code(403);
            echo json_encode(["message" => "Access denied. You can only edit your own batches or unassigned batches."]);
            return;
        }

        $batchName = array_key_exists('batchName', $body) 
            ? trim($body['batchName']) 
            : (array_key_exists('batch_name', $body) ? trim($body['batch_name']) : ($batch['batch_name'] ?? $batch['topic']));

        $batchTime = trim($body['batchTime'] ?? $body['batch_time'] ?? $batch['batch_time']);
        $courseName = trim($body['courseName'] ?? $body['course_name'] ?? $batch['course_name']);
        $topic = array_key_exists('topic', $body) ? trim($body['topic']) : $batch['topic'];
        $status = trim($body['status'] ?? $batch['status']);
        $date = trim($body['date'] ?? $batch['date'] ?? date('Y-m-d'));
        $students = array_key_exists('students', $body) ? trim($body['students']) : ($batch['students'] ?? '');

        // Instructor ID
        $instructorId = $batch['instructor_id'];
        if (array_key_exists('instructorId', $body) || array_key_exists('instructor_id', $body)) {
            $rawInst = $body['instructorId'] ?? $body['instructor_id'];
            if ($rawInst === '' || $rawInst === '0' || $rawInst === 0 || $rawInst === null || strtolower(strval($rawInst)) === 'unassigned') {
                $instructorId = null;
            } else {
                $instructorId = (int)$rawInst;
            }
        }

        // Student count
        $studentCount = $batch['student_count'];
        if (isset($body['studentCount']) && is_numeric($body['studentCount'])) {
            $studentCount = (int)$body['studentCount'];
        } elseif (isset($body['student_count']) && is_numeric($body['student_count'])) {
            $studentCount = (int)$body['student_count'];
        }

        if (empty($batchName)) {
            $batchName = $topic ?: "{$courseName} ({$batchTime})";
        }

        $stmt = $pdo->prepare("
            UPDATE institute_batches 
            SET batch_name = ?,
                batch_time = ?, 
                instructor_id = ?, 
                course_name = ?, 
                topic = ?, 
                student_count = ?, 
                students = ?, 
                status = ?, 
                `date` = ?, 
                updated_at = NOW() 
            WHERE id = ?
        ");
        $stmt->execute([
            $batchName, 
            $batchTime, 
            $instructorId, 
            $courseName, 
            $topic, 
            $studentCount, 
            $students, 
            $status, 
            $date, 
            $id
        ]);

        $stmt = $pdo->prepare("
            SELECT b.*, u.full_name as instructor_name 
            FROM institute_batches b 
            LEFT JOIN portal_users u ON u.id = b.instructor_id 
            WHERE b.id = ?
        ");
        $stmt->execute([$id]);
        echo json_encode($stmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function deleteBatch($pdo, $user, $id) {
    ensureBatchesTable($pdo);
    try {
        $userRole = strtolower($user['role'] ?? '');
        if ($userRole !== 'admin' && $userRole !== 'teacher') {
            http_response_code(403);
            echo json_encode(["message" => "Access denied. Only administrators and authorized teachers can delete batches."]);
            return;
        }

        $stmt = $pdo->prepare("SELECT * FROM institute_batches WHERE id = ?");
        $stmt->execute([$id]);
        $batch = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$batch) {
            http_response_code(404);
            echo json_encode(["message" => "Batch not found."]);
            return;
        }

        $isAssignedToOther = !empty($batch['instructor_id']) && (int)$batch['instructor_id'] !== (int)$user['sub'];
        if ($userRole !== 'admin' && $isAssignedToOther) {
            http_response_code(403);
            echo json_encode(["message" => "Access denied. You can only delete your own batches or unassigned batches."]);
            return;
        }

        $stmt = $pdo->prepare("DELETE FROM institute_batches WHERE id = ?");
        $stmt->execute([$id]);

        echo json_encode(["ok" => true, "message" => "Batch deleted successfully.", "deletedId" => $id]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}
