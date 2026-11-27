<?php

// Ensure IST is always used for all date/time operations in this controller,
// regardless of the hosting server's default timezone.
date_default_timezone_set('Asia/Kolkata');

function ensureStaffAttendanceTables($pdo) {
    static $initialized = false;
    if ($initialized) return;
    try {
        // Ensure staff_attendance base table exists
        $pdo->exec("CREATE TABLE IF NOT EXISTS `staff_attendance` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `staff_id` BIGINT UNSIGNED NOT NULL,
            `date` DATE NOT NULL,
            `clock_in` DATETIME DEFAULT NULL,
            `clock_out` DATETIME DEFAULT NULL,
            `total_hours` DECIMAL(5,2) DEFAULT 0.00,
            `status` VARCHAR(50) DEFAULT 'Present',
            `leave_type` VARCHAR(80) NULL DEFAULT NULL,
            `is_admin_modified` TINYINT(1) DEFAULT 0,
            `last_modified_by` VARCHAR(150) NULL DEFAULT NULL,
            `last_modified_at` DATETIME NULL DEFAULT NULL,
            `modification_reason` TEXT NULL DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_staff_date` (`staff_id`, `date`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // Relax clock_in to allow NULL if it was originally NOT NULL
        try {
            $pdo->exec("ALTER TABLE `staff_attendance` MODIFY `clock_in` DATETIME NULL DEFAULT NULL;");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE `staff_attendance` MODIFY `status` VARCHAR(50) DEFAULT 'Present';");
        } catch (Exception $e) {}

        // Add admin modification tracking columns if not already present
        try {
            $pdo->exec("ALTER TABLE `staff_attendance` ADD COLUMN `leave_type` VARCHAR(80) NULL DEFAULT NULL;");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE `staff_attendance` ADD COLUMN `is_admin_modified` TINYINT(1) DEFAULT 0;");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE `staff_attendance` ADD COLUMN `last_modified_by` VARCHAR(150) NULL DEFAULT NULL;");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE `staff_attendance` ADD COLUMN `last_modified_at` DATETIME NULL DEFAULT NULL;");
        } catch (Exception $e) {}
        try {
            $pdo->exec("ALTER TABLE `staff_attendance` ADD COLUMN `modification_reason` TEXT NULL DEFAULT NULL;");
        } catch (Exception $e) {}

        // Ensure audit log table exists
        $pdo->exec("CREATE TABLE IF NOT EXISTS `staff_attendance_audit_logs` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `attendance_id` BIGINT UNSIGNED NOT NULL,
            `staff_id` BIGINT UNSIGNED NOT NULL,
            `admin_id` BIGINT UNSIGNED NOT NULL,
            `admin_name` VARCHAR(150) NOT NULL,
            `action` VARCHAR(50) NOT NULL DEFAULT 'UPDATE',
            `previous_data` JSON DEFAULT NULL,
            `updated_data` JSON DEFAULT NULL,
            `reason` TEXT NOT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_audit_attendance` (`attendance_id`),
            KEY `idx_audit_staff` (`staff_id`),
            KEY `idx_audit_created` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `staff_leave_requests` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `staff_id` BIGINT UNSIGNED NOT NULL,
            `leave_type` VARCHAR(80) NOT NULL,
            `start_date` DATE NOT NULL,
            `end_date` DATE NOT NULL,
            `reason` TEXT NOT NULL,
            `status` ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
            `reviewed_by` BIGINT UNSIGNED DEFAULT NULL,
            `reviewed_by_name` VARCHAR(150) DEFAULT NULL,
            `reviewed_at` DATETIME DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_leave_staff_dates` (`staff_id`, `start_date`, `end_date`),
            KEY `idx_leave_status` (`status`, `created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        $initialized = true;
    } catch (Exception $e) {
        error_log("Staff attendance table setup warning: " . $e->getMessage());
    }
}

function getAttendance($pdo, $user) {
    ensureStaffAttendanceTables($pdo);
    try {
        $staffId = $_GET['staff_id'] ?? null;
        $date = $_GET['date'] ?? null;
        $status = $_GET['status'] ?? null;
        $q = $_GET['q'] ?? null;

        $conditions = [];
        $params = [];

        // Role-based staff filtering: non-admins can only see their own attendance
        if (strtolower($user['role'] ?? '') !== 'admin') {
            $conditions[] = "a.staff_id = ?";
            $params[] = $user['sub'];
        } else {
            if (!empty($staffId) && strtolower($staffId) !== 'all') {
                $conditions[] = "a.staff_id = ?";
                $params[] = $staffId;
            }
        }

        // Status filter
        if (!empty($status) && strtolower($status) !== 'all') {
            $conditions[] = "LOWER(TRIM(a.status)) = LOWER(TRIM(?))";
            $params[] = $status;
        }

        // Date filter
        if (!empty($date) && strtolower($date) !== 'all') {
            if ($date === 'today') {
                $conditions[] = "a.`date` = CURDATE()";
            } elseif ($date === 'yesterday') {
                $conditions[] = "a.`date` = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
            } elseif ($date === 'this_week') {
                $conditions[] = "a.`date` >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
            } elseif ($date === 'this_month') {
                $conditions[] = "a.`date` >= DATE_FORMAT(CURDATE(), '%Y-%m-01')";
            } else {
                $conditions[] = "a.`date` = ?";
                $params[] = $date;
            }
        }

        // Dynamic search across staff name, date, status, clock_in, clock_out, total_hours, modification_reason
        if (!empty($q)) {
            $like = "%" . trim($q) . "%";
            $conditions[] = "(u.full_name LIKE ? OR a.`date` LIKE ? OR a.status LIKE ? OR a.clock_in LIKE ? OR a.clock_out LIKE ? OR CAST(a.total_hours AS CHAR) LIKE ? OR a.modification_reason LIKE ? OR a.last_modified_by LIKE ?)";
            for ($i = 0; $i < 8; $i++) {
                $params[] = $like;
            }
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $pdo->prepare("
            SELECT a.*, 
                   u.full_name as staff_name,
                   u.username as staff_username,
                   u.role as staff_role
            FROM staff_attendance a 
            LEFT JOIN portal_users u ON u.id = a.staff_id 
            {$whereClause}
            ORDER BY a.`date` DESC, a.clock_in DESC, a.id DESC
        ");
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getAttendanceFilterOptions($pdo, $user) {
    ensureStaffAttendanceTables($pdo);
    try {
        $staff = [];
        $statuses = ['Present', 'Half Day', 'Leave', 'On Leave', 'Absent'];

        if (strtolower($user['role'] ?? '') === 'admin') {
            try {
                $stmt = $pdo->query("SELECT id, full_name, username, role FROM portal_users WHERE (full_name IS NOT NULL AND TRIM(full_name) != '') OR (username IS NOT NULL AND TRIM(username) != '') ORDER BY full_name ASC");
                while ($row = $stmt->fetch()) {
                    $name = trim($row['full_name'] ?: $row['username']);
                    if ($name) {
                        $staff[] = [
                            'id' => (int)$row['id'],
                            'name' => $name,
                            'role' => $row['role'] ?? 'staff'
                        ];
                    }
                }
            } catch (Exception $e) {}
        } else {
            $name = trim($user['name'] ?? $user['username'] ?? 'Me');
            $staff[] = [
                'id' => (int)$user['sub'],
                'name' => $name,
                'role' => $user['role'] ?? 'staff'
            ];
        }

        $dates = [];
        try {
            $dateStmt = $pdo->query("SELECT DISTINCT `date` FROM staff_attendance ORDER BY `date` DESC LIMIT 60");
            while ($dRow = $dateStmt->fetch()) {
                if (!empty($dRow['date'])) {
                    $dates[] = $dRow['date'];
                }
            }
        } catch (Exception $e) {}

        echo json_encode([
            "staff" => $staff,
            "statuses" => $statuses,
            "dates" => $dates
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function clockIn($pdo, $user) {
    ensureStaffAttendanceTables($pdo);
    try {
        date_default_timezone_set('Asia/Kolkata');

        $staffId = $user['sub'];
        $date    = date('Y-m-d');           // Today in IST
        $now     = date('Y-m-d H:i:s');     // Current time in IST

        $stmt = $pdo->prepare("SELECT id FROM staff_attendance WHERE staff_id = ? AND `date` = ? AND clock_out IS NULL");
        $stmt->execute([$staffId, $date]);
        if ($stmt->fetch()) {
            http_response_code(400);
            echo json_encode(["message" => "Already clocked in today without clocking out."]);
            return;
        }

        $stmt = $pdo->prepare("INSERT INTO staff_attendance (staff_id, `date`, clock_in, status) VALUES (?, ?, ?, 'Present')");
        $stmt->execute([$staffId, $date, $now]);
        
        $id = $pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT a.*, u.full_name as staff_name FROM staff_attendance a LEFT JOIN portal_users u ON u.id = a.staff_id WHERE a.id = ?");
        $stmt->execute([$id]);
        
        echo json_encode($stmt->fetch());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function clockOut($pdo, $user, $body) {
    ensureStaffAttendanceTables($pdo);
    try {
        date_default_timezone_set('Asia/Kolkata');

        $staffId = $user['sub'];
        $date    = date('Y-m-d');           // Today in IST
        $now     = date('Y-m-d H:i:s');     // Current time in IST

        $stmt = $pdo->prepare("SELECT * FROM staff_attendance WHERE staff_id = ? AND `date` = ? AND clock_in IS NOT NULL AND clock_out IS NULL AND LOWER(TRIM(status)) NOT IN ('absent', 'leave', 'on leave') ORDER BY clock_in DESC LIMIT 1");
        $stmt->execute([$staffId, $date]);
        $record = $stmt->fetch();

        if (!$record) {
            http_response_code(404);
            echo json_encode(["message" => "No active clock-in found for today."]);
            return;
        }

        $clockInTime = !empty($record['clock_in']) ? strtotime($record['clock_in']) : strtotime($now);
        $clockOutTime = strtotime($now);
        $hours = max(0, ($clockOutTime - $clockInTime) / 3600);

        $stmt = $pdo->prepare("UPDATE staff_attendance SET clock_out = ?, total_hours = ? WHERE id = ?");
        $stmt->execute([$now, round($hours, 2), $record['id']]);

        $stmt = $pdo->prepare("SELECT a.*, u.full_name as staff_name FROM staff_attendance a LEFT JOIN portal_users u ON u.id = a.staff_id WHERE a.id = ?");
        $stmt->execute([$record['id']]);
        
        echo json_encode($stmt->fetch());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function markStaffLeave($pdo, $user, $body) {
    ensureStaffAttendanceTables($pdo);
    try {
        date_default_timezone_set('Asia/Kolkata');

        $isAdmin = strtolower($user['role'] ?? '') === 'admin';
        if (!$isAdmin) {
            http_response_code(403);
            echo json_encode(["message" => "Staff must submit a leave request for administrator approval."]);
            return;
        }
        $staffId = $isAdmin
            ? (int)($body['staff_id'] ?? 0)
            : (int)($user['sub'] ?? 0);
        $date = trim($body['date'] ?? '');
        $leaveType = trim($body['leave_type'] ?? '');
        $reason = trim($body['reason'] ?? '');
        $allowedLeaveTypes = ['Sick', 'Casual', 'Paid', 'Unpaid', 'Other'];

        if (!$staffId) {
            http_response_code(400);
            echo json_encode(["message" => "Please select a valid staff member."]);
            return;
        }
        if (!$isAdmin && isset($body['staff_id']) && (int)$body['staff_id'] !== $staffId) {
            http_response_code(403);
            echo json_encode(["message" => "Staff members can only mark leave for themselves."]);
            return;
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4))) {
            http_response_code(400);
            echo json_encode(["message" => "A valid leave date in YYYY-MM-DD format is required."]);
            return;
        }
        if (!in_array($leaveType, $allowedLeaveTypes, true)) {
            http_response_code(400);
            echo json_encode(["message" => "Please select a valid leave type."]);
            return;
        }
        if ($reason === '' || strlen($reason) > 2000) {
            http_response_code(400);
            echo json_encode(["message" => "A leave reason of 1 to 2000 characters is required."]);
            return;
        }

        $userStmt = $pdo->prepare("SELECT id, full_name, username FROM portal_users WHERE id = ?");
        $userStmt->execute([$staffId]);
        $staffUser = $userStmt->fetch();
        if (!$staffUser) {
            http_response_code(404);
            echo json_encode(["message" => "Staff member not found in the database."]);
            return;
        }

        $existingStmt = $pdo->prepare("SELECT id FROM staff_attendance WHERE staff_id = ? AND `date` = ? LIMIT 1");
        $existingStmt->execute([$staffId, $date]);
        if ($existingStmt->fetch()) {
            http_response_code(409);
            echo json_encode(["message" => "An attendance record already exists for this staff member on that date."]);
            return;
        }

        $actorId = (int)($user['sub'] ?? 0);
        $actorName = trim($user['name'] ?? $user['username'] ?? ($isAdmin ? 'Admin' : 'Staff'));
        $pdo->beginTransaction();
        $insertStmt = $pdo->prepare("
            INSERT INTO staff_attendance
                (staff_id, `date`, clock_in, clock_out, total_hours, status, leave_type, is_admin_modified, last_modified_by, last_modified_at, modification_reason)
            VALUES (?, ?, NULL, NULL, 0.00, 'On Leave', ?, ?, ?, NOW(), ?)
        ");
        $insertStmt->execute([$staffId, $date, $leaveType, $isAdmin ? 1 : 0, $actorName, $reason]);
        $attendanceId = $pdo->lastInsertId();

        $updatedData = [
            'staff_id' => $staffId,
            'staff_name' => $staffUser['full_name'] ?: $staffUser['username'],
            'date' => $date,
            'status' => 'On Leave',
            'leave_type' => $leaveType,
            'total_hours' => 0,
            'reason' => $reason
        ];
        $auditStmt = $pdo->prepare("
            INSERT INTO staff_attendance_audit_logs
                (attendance_id, staff_id, admin_id, admin_name, action, previous_data, updated_data, reason, created_at)
            VALUES (?, ?, ?, ?, 'CREATE', NULL, ?, ?, NOW())
        ");
        $auditStmt->execute([
            $attendanceId,
            $staffId,
            $actorId,
            $actorName,
            json_encode($updatedData, JSON_UNESCAPED_UNICODE),
            $reason
        ]);
        $pdo->commit();

        $fetchStmt = $pdo->prepare("
            SELECT a.*, u.full_name AS staff_name, u.username AS staff_username, u.role AS staff_role
            FROM staff_attendance a
            LEFT JOIN portal_users u ON u.id = a.staff_id
            WHERE a.id = ?
        ");
        $fetchStmt->execute([$attendanceId]);
        http_response_code(201);
        echo json_encode([
            "ok" => true,
            "message" => "Leave marked successfully.",
            "record" => $fetchStmt->fetch()
        ]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getStaffLeaveRequests($pdo, $user) {
    ensureStaffAttendanceTables($pdo);
    try {
        $isAdmin = strtolower($user['role'] ?? '') === 'admin';
        $params = [];
        $where = '';
        if (!$isAdmin) {
            $where = 'WHERE lr.staff_id = ?';
            $params[] = (int)$user['sub'];
        } elseif (!empty($_GET['status']) && in_array($_GET['status'], ['Pending', 'Approved', 'Rejected'], true)) {
            $where = 'WHERE lr.status = ?';
            $params[] = $_GET['status'];
        }

        $stmt = $pdo->prepare("
            SELECT lr.*, COALESCE(NULLIF(u.full_name, ''), u.username) AS staff_name
            FROM staff_leave_requests lr
            LEFT JOIN portal_users u ON u.id = lr.staff_id
            {$where}
            ORDER BY CASE WHEN lr.status = 'Pending' THEN 0 ELSE 1 END, lr.created_at DESC, lr.id DESC
        ");
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function submitStaffLeaveRequest($pdo, $user, $body) {
    ensureStaffAttendanceTables($pdo);
    try {
        $isAdmin = strtolower($user['role'] ?? '') === 'admin';
        $staffId = $isAdmin && !empty($body['staff_id'])
            ? (int)$body['staff_id']
            : (int)($user['sub'] ?? 0);
        $startDate = trim($body['start_date'] ?? '');
        $endDate = trim($body['end_date'] ?? '');
        $leaveType = trim($body['leave_type'] ?? '');
        $reason = trim($body['reason'] ?? '');
        $allowedLeaveTypes = ['Sick', 'Casual', 'Paid', 'Unpaid', 'Other'];
        $isValidDate = function($date) {
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) return false;
            return checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4));
        };

        if (!$staffId) {
            http_response_code(401);
            echo json_encode(["message" => "A valid staff account is required."]);
            return;
        }
        if (!$isValidDate($startDate) || !$isValidDate($endDate) || $endDate < $startDate) {
            http_response_code(400);
            echo json_encode(["message" => "Enter a valid leave start and end date; the end date cannot be before the start date."]);
            return;
        }
        if (!in_array($leaveType, $allowedLeaveTypes, true)) {
            http_response_code(400);
            echo json_encode(["message" => "Please select a valid leave type."]);
            return;
        }
        if ($reason === '' || strlen($reason) > 2000) {
            http_response_code(400);
            echo json_encode(["message" => "A leave reason of 1 to 2000 characters is required."]);
            return;
        }

        $pdo->beginTransaction();
        $overlap = $pdo->prepare("
            SELECT id FROM staff_leave_requests
            WHERE staff_id = ? AND status IN ('Pending', 'Approved')
              AND start_date <= ? AND end_date >= ?
            LIMIT 1
        ");
        $overlap->execute([$staffId, $endDate, $startDate]);
        if ($overlap->fetch()) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(["message" => "A pending or approved leave request already overlaps these dates."]);
            return;
        }

        $staffStmt = $pdo->prepare("SELECT id FROM portal_users WHERE id = ?");
        $staffStmt->execute([$staffId]);
        if (!$staffStmt->fetch()) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(["message" => "Staff member not found."]);
            return;
        }

        $stmt = $pdo->prepare("
            INSERT INTO staff_leave_requests (staff_id, leave_type, start_date, end_date, reason, status)
            VALUES (?, ?, ?, ?, ?, 'Pending')
        ");
        $stmt->execute([$staffId, $leaveType, $startDate, $endDate, $reason]);
        $requestId = (int)$pdo->lastInsertId();
        $pdo->commit();

        $fetch = $pdo->prepare("
            SELECT lr.*, COALESCE(NULLIF(u.full_name, ''), u.username) AS staff_name
            FROM staff_leave_requests lr
            LEFT JOIN portal_users u ON u.id = lr.staff_id
            WHERE lr.id = ?
        ");
        $fetch->execute([$requestId]);
        http_response_code(201);
        echo json_encode($fetch->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function reviewStaffLeaveRequest($pdo, $user, $id, $body) {
    ensureStaffAttendanceTables($pdo);
    if (strtolower($user['role'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(["message" => "Only administrators can review staff leave requests."]);
        return;
    }

    $requestId = (int)$id;
    $decision = trim($body['status'] ?? '');
    if (!$requestId || !in_array($decision, ['Approved', 'Rejected'], true)) {
        http_response_code(400);
        echo json_encode(["message" => "A valid request ID and Approved or Rejected decision are required."]);
        return;
    }

    try {
        $pdo->beginTransaction();
        $requestStmt = $pdo->prepare("SELECT * FROM staff_leave_requests WHERE id = ? FOR UPDATE");
        $requestStmt->execute([$requestId]);
        $request = $requestStmt->fetch(PDO::FETCH_ASSOC);
        if (!$request) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode(["message" => "Leave request not found."]);
            return;
        }
        if ($request['status'] !== 'Pending') {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode(["message" => "This leave request has already been reviewed."]);
            return;
        }

        $adminId = (int)($user['sub'] ?? 0);
        $adminName = trim($user['name'] ?? $user['username'] ?? 'Admin');
        $review = $pdo->prepare("
            UPDATE staff_leave_requests
            SET status = ?, reviewed_by = ?, reviewed_by_name = ?, reviewed_at = NOW()
            WHERE id = ? AND status = 'Pending'
        ");
        $review->execute([$decision, $adminId, $adminName, $requestId]);

        if ($decision === 'Approved') {
            $staffStmt = $pdo->prepare("SELECT full_name, username FROM portal_users WHERE id = ?");
            $staffStmt->execute([(int)$request['staff_id']]);
            $staff = $staffStmt->fetch(PDO::FETCH_ASSOC);
            if (!$staff) {
                throw new RuntimeException("Staff member for this leave request no longer exists.");
            }
            $staffName = $staff['full_name'] ?: $staff['username'];
            $start = new DateTimeImmutable($request['start_date']);
            $end = new DateTimeImmutable($request['end_date']);
            $day = new DateInterval('P1D');
            $period = new DatePeriod($start, $day, $end->modify('+1 day'));

            foreach ($period as $date) {
                $dateValue = $date->format('Y-m-d');
                $existingStmt = $pdo->prepare("SELECT * FROM staff_attendance WHERE staff_id = ? AND `date` = ?");
                $existingStmt->execute([(int)$request['staff_id'], $dateValue]);
                $existingRows = $existingStmt->fetchAll(PDO::FETCH_ASSOC);
                $previousData = $existingRows
                    ? json_encode($existingRows, JSON_UNESCAPED_UNICODE)
                    : null;

                if ($existingRows) {
                    $updateAttendance = $pdo->prepare("
                        UPDATE staff_attendance
                        SET clock_in = NULL, clock_out = NULL, total_hours = 0.00, status = 'On Leave',
                            leave_type = ?, is_admin_modified = 1, last_modified_by = ?,
                            last_modified_at = NOW(), modification_reason = ?
                        WHERE staff_id = ? AND `date` = ?
                    ");
                    $updateAttendance->execute([
                        $request['leave_type'], $adminName, $request['reason'],
                        (int)$request['staff_id'], $dateValue
                    ]);
                    $ids = array_column($existingRows, 'id');
                } else {
                    $insertAttendance = $pdo->prepare("
                        INSERT INTO staff_attendance
                            (staff_id, `date`, clock_in, clock_out, total_hours, status, leave_type,
                             is_admin_modified, last_modified_by, last_modified_at, modification_reason)
                        VALUES (?, ?, NULL, NULL, 0.00, 'On Leave', ?, 1, ?, NOW(), ?)
                    ");
                    $insertAttendance->execute([
                        (int)$request['staff_id'], $dateValue, $request['leave_type'],
                        $adminName, $request['reason']
                    ]);
                    $ids = [(int)$pdo->lastInsertId()];
                }

                foreach ($ids as $attendanceId) {
                    $updatedData = [
                        'staff_id' => (int)$request['staff_id'],
                        'staff_name' => $staffName,
                        'date' => $dateValue,
                        'status' => 'On Leave',
                        'leave_type' => $request['leave_type'],
                        'total_hours' => 0,
                        'leave_request_id' => $requestId
                    ];
                    $audit = $pdo->prepare("
                        INSERT INTO staff_attendance_audit_logs
                            (attendance_id, staff_id, admin_id, admin_name, action, previous_data, updated_data, reason, created_at)
                        VALUES (?, ?, ?, ?, 'LEAVE_APPROVED', ?, ?, ?, NOW())
                    ");
                    $audit->execute([
                        (int)$attendanceId, (int)$request['staff_id'], $adminId, $adminName,
                        $previousData, json_encode($updatedData, JSON_UNESCAPED_UNICODE),
                        "Leave request #{$requestId} approved. " . $request['reason']
                    ]);
                }
            }
        }

        $pdo->commit();
        $fetch = $pdo->prepare("
            SELECT lr.*, COALESCE(NULLIF(u.full_name, ''), u.username) AS staff_name
            FROM staff_leave_requests lr
            LEFT JOIN portal_users u ON u.id = lr.staff_id
            WHERE lr.id = ?
        ");
        $fetch->execute([$requestId]);
        echo json_encode($fetch->fetch(PDO::FETCH_ASSOC));
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(["message" => "Unable to review leave request: " . $e->getMessage()]);
    }
}

function adminAddAttendance($pdo, $user, $body) {
    ensureStaffAttendanceTables($pdo);
    if (strtolower($user['role'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(["message" => "Access denied: Only administrators can add staff attendance."]);
        return;
    }

    try {
        date_default_timezone_set('Asia/Kolkata');

        $staffId = !empty($body['staff_id']) ? (int)$body['staff_id'] : 0;
        $date = trim($body['date'] ?? '');
        $status = trim($body['status'] ?? 'Present');
        $rawClockIn = trim($body['clock_in'] ?? '');
        $rawClockOut = trim($body['clock_out'] ?? '');
        $totalHours = isset($body['total_hours']) && $body['total_hours'] !== '' ? (float)$body['total_hours'] : null;
        $reason = trim($body['reason'] ?? '');

        if (!$staffId) {
            http_response_code(400);
            echo json_encode(["message" => "Please select a valid staff member."]);
            return;
        }

        if (empty($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(["message" => "A valid date in YYYY-MM-DD format is required."]);
            return;
        }

        if (empty($reason)) {
            http_response_code(400);
            echo json_encode(["message" => "A reason for adding this attendance record is required."]);
            return;
        }

        // Verify staff exists in database
        $userStmt = $pdo->prepare("SELECT id, full_name, username FROM portal_users WHERE id = ?");
        $userStmt->execute([$staffId]);
        $staffUser = $userStmt->fetch();
        if (!$staffUser) {
            http_response_code(404);
            echo json_encode(["message" => "Staff member not found in the database."]);
            return;
        }

        // Format clock_in and clock_out
        $clockIn = null;
        $clockOut = null;

        if (in_array(strtolower($status), ['absent', 'leave', 'on leave'])) {
            $clockIn = null;
            $clockOut = null;
            $totalHours = 0.00;
        } else {
            if (!empty($rawClockIn)) {
                $clockIn = (strlen($rawClockIn) <= 8) ? "{$date} {$rawClockIn}" : date('Y-m-d H:i:s', strtotime($rawClockIn));
            }
            if (!empty($rawClockOut)) {
                $clockOut = (strlen($rawClockOut) <= 8) ? "{$date} {$rawClockOut}" : date('Y-m-d H:i:s', strtotime($rawClockOut));
            }

            if ($totalHours === null && $clockIn && $clockOut) {
                $inTs = strtotime($clockIn);
                $outTs = strtotime($clockOut);
                if ($outTs > $inTs) {
                    $totalHours = round(($outTs - $inTs) / 3600, 2);
                } else {
                    $totalHours = 0.00;
                }
            } elseif ($totalHours === null) {
                $totalHours = strtolower($status) === 'half day' ? 4.00 : 8.00;
            }
        }

        $adminId = (int)($user['sub'] ?? 0);
        $adminName = trim($user['name'] ?? $user['username'] ?? 'Admin');

        $stmt = $pdo->prepare("
            INSERT INTO staff_attendance (staff_id, `date`, clock_in, clock_out, total_hours, status, is_admin_modified, last_modified_by, last_modified_at, modification_reason)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, NOW(), ?)
        ");
        $stmt->execute([
            $staffId,
            $date,
            $clockIn,
            $clockOut,
            $totalHours !== null ? $totalHours : 0.00,
            $status,
            $adminName,
            $reason
        ]);

        $attendanceId = $pdo->lastInsertId();

        // Write Audit Log
        $updatedData = [
            'staff_id' => $staffId,
            'staff_name' => $staffUser['full_name'] ?: $staffUser['username'],
            'date' => $date,
            'status' => $status,
            'clock_in' => $clockIn,
            'clock_out' => $clockOut,
            'total_hours' => $totalHours
        ];

        $auditStmt = $pdo->prepare("
            INSERT INTO staff_attendance_audit_logs (attendance_id, staff_id, admin_id, admin_name, action, previous_data, updated_data, reason, created_at)
            VALUES (?, ?, ?, ?, 'CREATE', NULL, ?, ?, NOW())
        ");
        $auditStmt->execute([
            $attendanceId,
            $staffId,
            $adminId,
            $adminName,
            json_encode($updatedData, JSON_UNESCAPED_UNICODE),
            $reason
        ]);

        // Return newly created record
        $fetchStmt = $pdo->prepare("
            SELECT a.*, u.full_name as staff_name, u.username as staff_username, u.role as staff_role
            FROM staff_attendance a
            LEFT JOIN portal_users u ON u.id = a.staff_id
            WHERE a.id = ?
        ");
        $fetchStmt->execute([$attendanceId]);
        $record = $fetchStmt->fetch();

        http_response_code(201);
        echo json_encode([
            "ok" => true,
            "message" => "Staff attendance added successfully.",
            "record" => $record
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function adminUpdateAttendance($pdo, $id, $user, $body) {
    ensureStaffAttendanceTables($pdo);
    if (strtolower($user['role'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(["message" => "Access denied: Only administrators can modify staff attendance."]);
        return;
    }

    try {
        date_default_timezone_set('Asia/Kolkata');

        $id = (int)$id;
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "Invalid attendance ID."]);
            return;
        }

        // Fetch current record
        $currStmt = $pdo->prepare("
            SELECT a.*, u.full_name as staff_name, u.username as staff_username
            FROM staff_attendance a
            LEFT JOIN portal_users u ON u.id = a.staff_id
            WHERE a.id = ?
        ");
        $currStmt->execute([$id]);
        $existing = $currStmt->fetch();

        if (!$existing) {
            http_response_code(404);
            echo json_encode(["message" => "Attendance record not found."]);
            return;
        }

        $reason = trim($body['reason'] ?? '');
        if (empty($reason)) {
            http_response_code(400);
            echo json_encode(["message" => "A reason for modification is required."]);
            return;
        }

        $staffId = !empty($body['staff_id']) ? (int)$body['staff_id'] : (int)$existing['staff_id'];
        $date = trim($body['date'] ?? $existing['date']);
        $status = trim($body['status'] ?? $existing['status']);
        $rawClockIn = isset($body['clock_in']) ? trim($body['clock_in']) : null;
        $rawClockOut = isset($body['clock_out']) ? trim($body['clock_out']) : null;
        $totalHours = isset($body['total_hours']) && $body['total_hours'] !== '' ? (float)$body['total_hours'] : null;

        if (empty($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(["message" => "A valid date in YYYY-MM-DD format is required."]);
            return;
        }

        // Format clock_in and clock_out
        $clockIn = $existing['clock_in'];
        $clockOut = $existing['clock_out'];

        if (in_array(strtolower($status), ['absent', 'leave', 'on leave'])) {
            $clockIn = null;
            $clockOut = null;
            $totalHours = 0.00;
        } else {
            if ($rawClockIn !== null) {
                $clockIn = !empty($rawClockIn) ? ((strlen($rawClockIn) <= 8) ? "{$date} {$rawClockIn}" : date('Y-m-d H:i:s', strtotime($rawClockIn))) : null;
            }
            if ($rawClockOut !== null) {
                $clockOut = !empty($rawClockOut) ? ((strlen($rawClockOut) <= 8) ? "{$date} {$rawClockOut}" : date('Y-m-d H:i:s', strtotime($rawClockOut))) : null;
            }

            if ($totalHours === null && $clockIn && $clockOut) {
                $inTs = strtotime($clockIn);
                $outTs = strtotime($clockOut);
                if ($outTs > $inTs) {
                    $totalHours = round(($outTs - $inTs) / 3600, 2);
                } else {
                    $totalHours = 0.00;
                }
            } elseif ($totalHours === null) {
                $totalHours = (float)($existing['total_hours'] ?? 0.00);
            }
        }

        $adminId = (int)($user['sub'] ?? 0);
        $adminName = trim($user['name'] ?? $user['username'] ?? 'Admin');

        // Snapshot previous data for audit
        $previousData = [
            'staff_id' => $existing['staff_id'],
            'staff_name' => $existing['staff_name'] ?: $existing['staff_username'],
            'date' => $existing['date'],
            'status' => $existing['status'],
            'clock_in' => $existing['clock_in'],
            'clock_out' => $existing['clock_out'],
            'total_hours' => $existing['total_hours'],
            'is_admin_modified' => $existing['is_admin_modified'] ?? 0,
            'last_modified_by' => $existing['last_modified_by'] ?? null,
            'modification_reason' => $existing['modification_reason'] ?? null
        ];

        $updatedData = [
            'staff_id' => $staffId,
            'date' => $date,
            'status' => $status,
            'clock_in' => $clockIn,
            'clock_out' => $clockOut,
            'total_hours' => $totalHours
        ];

        // Perform update
        $stmt = $pdo->prepare("
            UPDATE staff_attendance
            SET staff_id = ?,
                `date` = ?,
                clock_in = ?,
                clock_out = ?,
                total_hours = ?,
                status = ?,
                is_admin_modified = 1,
                last_modified_by = ?,
                last_modified_at = NOW(),
                modification_reason = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $staffId,
            $date,
            $clockIn,
            $clockOut,
            $totalHours !== null ? $totalHours : 0.00,
            $status,
            $adminName,
            $reason,
            $id
        ]);

        // Insert audit log
        $auditStmt = $pdo->prepare("
            INSERT INTO staff_attendance_audit_logs (attendance_id, staff_id, admin_id, admin_name, action, previous_data, updated_data, reason, created_at)
            VALUES (?, ?, ?, ?, 'UPDATE', ?, ?, ?, NOW())
        ");
        $auditStmt->execute([
            $id,
            $staffId,
            $adminId,
            $adminName,
            json_encode($previousData, JSON_UNESCAPED_UNICODE),
            json_encode($updatedData, JSON_UNESCAPED_UNICODE),
            $reason
        ]);

        // Fetch and return the updated record
        $fetchStmt = $pdo->prepare("
            SELECT a.*, u.full_name as staff_name, u.username as staff_username, u.role as staff_role
            FROM staff_attendance a
            LEFT JOIN portal_users u ON u.id = a.staff_id
            WHERE a.id = ?
        ");
        $fetchStmt->execute([$id]);
        $updatedRecord = $fetchStmt->fetch();

        echo json_encode([
            "ok" => true,
            "message" => "Attendance record updated successfully and audit log created.",
            "record" => $updatedRecord
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getAttendanceAuditLogs($pdo, $user, $attendanceId = null) {
    ensureStaffAttendanceTables($pdo);
    if (strtolower($user['role'] ?? '') !== 'admin') {
        http_response_code(403);
        echo json_encode(["message" => "Access denied: Only administrators can view attendance audit logs."]);
        return;
    }

    try {
        $attId = $attendanceId ?: ($_GET['attendance_id'] ?? null);
        $staffId = $_GET['staff_id'] ?? null;

        $conditions = [];
        $params = [];

        if (!empty($attId) && is_numeric($attId)) {
            $conditions[] = "l.attendance_id = ?";
            $params[] = (int)$attId;
        }

        if (!empty($staffId) && is_numeric($staffId)) {
            $conditions[] = "l.staff_id = ?";
            $params[] = (int)$staffId;
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $pdo->prepare("
            SELECT l.*,
                   s.full_name as staff_name,
                   s.username as staff_username,
                   adm.full_name as admin_full_name,
                   adm.username as admin_username
            FROM staff_attendance_audit_logs l
            LEFT JOIN portal_users s ON s.id = l.staff_id
            LEFT JOIN portal_users adm ON adm.id = l.admin_id
            {$whereClause}
            ORDER BY l.created_at DESC, l.id DESC
            LIMIT 200
        ");
        $stmt->execute($params);
        $logs = $stmt->fetchAll();

        // Decode JSON fields if not auto-decoded
        foreach ($logs as &$log) {
            if (!empty($log['previous_data']) && is_string($log['previous_data'])) {
                $log['previous_data'] = json_decode($log['previous_data'], true);
            }
            if (!empty($log['updated_data']) && is_string($log['updated_data'])) {
                $log['updated_data'] = json_decode($log['updated_data'], true);
            }
        }

        echo json_encode($logs);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}
