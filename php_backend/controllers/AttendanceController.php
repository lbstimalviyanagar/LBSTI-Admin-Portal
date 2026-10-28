<?php

// Ensure IST is always used for all date/time operations in this controller,
// regardless of the hosting server's default timezone.
date_default_timezone_set('Asia/Kolkata');

function getAttendance($pdo, $user) {
    try {
        $staffId = $_GET['staff_id'] ?? null;
        $date = $_GET['date'] ?? null;
        $status = $_GET['status'] ?? null;
        $q = $_GET['q'] ?? null;

        $conditions = [];
        $params = [];

        // Role-based staff filtering
        if ($user['role'] !== 'admin') {
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

        // Dynamic search across staff name, date, status, clock_in, clock_out, total_hours
        if (!empty($q)) {
            $like = "%" . trim($q) . "%";
            $conditions[] = "(u.full_name LIKE ? OR a.`date` LIKE ? OR a.status LIKE ? OR a.clock_in LIKE ? OR a.clock_out LIKE ? OR CAST(a.total_hours AS CHAR) LIKE ?)";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $pdo->prepare("
            SELECT a.*, u.full_name as staff_name 
            FROM staff_attendance a 
            LEFT JOIN portal_users u ON u.id = a.staff_id 
            {$whereClause}
            ORDER BY a.`date` DESC, a.clock_in DESC
        ");
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getAttendanceFilterOptions($pdo, $user) {
    try {
        $staff = [];
        $statuses = ['Present', 'Half Day', 'Leave', 'Absent'];

        if ($user['role'] === 'admin') {
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
    try {
        // Force IST for this operation
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

        $stmt = $pdo->prepare("INSERT INTO staff_attendance (staff_id, `date`, clock_in) VALUES (?, ?, ?)");
        $stmt->execute([$staffId, $date, $now]);
        
        $id = $pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM staff_attendance WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode($stmt->fetch());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function clockOut($pdo, $user, $body) {
    try {
        // Force IST for this operation
        date_default_timezone_set('Asia/Kolkata');

        $staffId = $user['sub'];
        $date    = date('Y-m-d');           // Today in IST
        $now     = date('Y-m-d H:i:s');     // Current time in IST

        $stmt = $pdo->prepare("SELECT * FROM staff_attendance WHERE staff_id = ? AND `date` = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1");
        $stmt->execute([$staffId, $date]);
        $record = $stmt->fetch();

        if (!$record) {
            http_response_code(404);
            echo json_encode(["message" => "No active clock-in found for today."]);
            return;
        }

        $clockInTime = strtotime($record['clock_in']);
        $clockOutTime = strtotime($now);
        $hours = ($clockOutTime - $clockInTime) / 3600;

        $stmt = $pdo->prepare("UPDATE staff_attendance SET clock_out = ?, total_hours = ? WHERE id = ?");
        $stmt->execute([$now, round($hours, 2), $record['id']]);

        $stmt = $pdo->prepare("SELECT * FROM staff_attendance WHERE id = ?");
        $stmt->execute([$record['id']]);
        
        echo json_encode($stmt->fetch());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}
