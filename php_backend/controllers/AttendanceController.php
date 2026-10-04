<?php

function getAttendance($pdo, $user) {
    try {
        if ($user['role'] === 'admin') {
            $stmt = $pdo->prepare("
                SELECT a.*, u.full_name as staff_name 
                FROM staff_attendance a 
                LEFT JOIN portal_users u ON u.id = a.staff_id 
                ORDER BY a.`date` DESC, a.clock_in DESC
            ");
            $stmt->execute();
        } else {
            $stmt = $pdo->prepare("
                SELECT a.*, u.full_name as staff_name 
                FROM staff_attendance a 
                LEFT JOIN portal_users u ON u.id = a.staff_id 
                WHERE a.staff_id = ? 
                ORDER BY a.`date` DESC, a.clock_in DESC
            ");
            $stmt->execute([$user['sub']]);
        }
        echo json_encode($stmt->fetchAll());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function clockIn($pdo, $user) {
    try {
        $staffId = $user['sub'];
        $date = date('Y-m-d');
        $now = date('Y-m-d H:i:s');

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
        $staffId = $user['sub'];
        $date = date('Y-m-d');
        $now = date('Y-m-d H:i:s');

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
