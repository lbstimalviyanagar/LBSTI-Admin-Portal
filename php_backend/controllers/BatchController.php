<?php

function getBatches($pdo) {
    try {
        $date = $_GET['date'] ?? date('Y-m-d');
        
        $stmt = $pdo->prepare("
            SELECT b.*, u.full_name as instructor_name 
            FROM institute_batches b 
            LEFT JOIN portal_users u ON u.id = b.instructor_id 
            WHERE b.`date` = ? 
            ORDER BY b.batch_time ASC
        ");
        $stmt->execute([$date]);
        echo json_encode($stmt->fetchAll());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createBatch($pdo, $user, $body) {
    try {
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["message" => "Only admins can manage batches."]);
            return;
        }

        $batchTime = $body['batchTime'] ?? null;
        $instructorId = $body['instructorId'] ?? null;
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
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["message" => "Only admins can manage batches."]);
            return;
        }

        $stmt = $pdo->prepare("SELECT * FROM institute_batches WHERE id = ?");
        $stmt->execute([$id]);
        $batch = $stmt->fetch();

        if (!$batch) {
            http_response_code(404);
            echo json_encode(["message" => "Batch not found."]);
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
