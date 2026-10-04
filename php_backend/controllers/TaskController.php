<?php

function getTasks($pdo, $user) {
    try {
        if ($user['role'] === 'admin') {
            $stmt = $pdo->prepare("
                SELECT t.*, u1.full_name as assigned_to_name, u2.full_name as assigned_by_name 
                FROM staff_tasks t 
                LEFT JOIN portal_users u1 ON u1.id = t.assigned_to 
                LEFT JOIN portal_users u2 ON u2.id = t.assigned_by 
                ORDER BY t.created_at DESC
            ");
            $stmt->execute();
        } else {
            $stmt = $pdo->prepare("
                SELECT t.*, u1.full_name as assigned_to_name, u2.full_name as assigned_by_name 
                FROM staff_tasks t 
                LEFT JOIN portal_users u1 ON u1.id = t.assigned_to 
                LEFT JOIN portal_users u2 ON u2.id = t.assigned_by 
                WHERE t.assigned_to = ? 
                ORDER BY t.created_at DESC
            ");
            $stmt->execute([$user['sub']]);
        }
        echo json_encode($stmt->fetchAll());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createTask($pdo, $user, $body) {
    try {
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["message" => "Only admins can assign tasks."]);
            return;
        }

        $assignedTo = $body['assignedTo'] ?? null;
        $title = $body['title'] ?? null;
        $description = $body['description'] ?? null;
        $dueDate = $body['dueDate'] ?? null;

        if (!$assignedTo || !$title) {
            http_response_code(400);
            echo json_encode(["message" => "Assigned to and title are required."]);
            return;
        }

        $stmt = $pdo->prepare("INSERT INTO staff_tasks (assigned_to, assigned_by, title, description, due_date) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$assignedTo, $user['sub'], $title, $description, $dueDate]);
        
        $id = $pdo->lastInsertId();
        $stmt = $pdo->prepare("SELECT * FROM staff_tasks WHERE id = ?");
        $stmt->execute([$id]);
        
        echo json_encode($stmt->fetch());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function updateTask($pdo, $user, $id, $body) {
    try {
        $stmt = $pdo->prepare("SELECT * FROM staff_tasks WHERE id = ?");
        $stmt->execute([$id]);
        $task = $stmt->fetch();

        if (!$task) {
            http_response_code(404);
            echo json_encode(["message" => "Task not found."]);
            return;
        }

        if ($user['role'] === 'admin') {
            $assignedTo = $body['assignedTo'] ?? $task['assigned_to'];
            $title = $body['title'] ?? $task['title'];
            $description = $body['description'] ?? $task['description'];
            $dueDate = $body['dueDate'] ?? $task['due_date'];
            $status = $body['status'] ?? $task['status'];
            $remarks = $body['remarks'] ?? $task['remarks'];

            $stmt = $pdo->prepare("UPDATE staff_tasks SET assigned_to = ?, title = ?, description = ?, due_date = ?, status = ?, remarks = ? WHERE id = ?");
            $stmt->execute([$assignedTo, $title, $description, $dueDate, $status, $remarks, $id]);
        } else {
            if ($task['assigned_to'] != $user['sub']) {
                http_response_code(403);
                echo json_encode(["message" => "You can only update your own tasks."]);
                return;
            }
            $status = $body['status'] ?? $task['status'];
            $remarks = $body['remarks'] ?? $task['remarks'];

            $stmt = $pdo->prepare("UPDATE staff_tasks SET status = ?, remarks = ? WHERE id = ?");
            $stmt->execute([$status, $remarks, $id]);
        }

        $stmt = $pdo->prepare("
            SELECT t.*, u1.full_name as assigned_to_name, u2.full_name as assigned_by_name 
            FROM staff_tasks t 
            LEFT JOIN portal_users u1 ON u1.id = t.assigned_to 
            LEFT JOIN portal_users u2 ON u2.id = t.assigned_by 
            WHERE t.id = ?
        ");
        $stmt->execute([$id]);
        echo json_encode($stmt->fetch());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function deleteTask($pdo, $user, $id) {
    try {
        if ($user['role'] !== 'admin') {
            http_response_code(403);
            echo json_encode(["message" => "Only admins can delete tasks."]);
            return;
        }

        $stmt = $pdo->prepare("DELETE FROM staff_tasks WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(["message" => "Task deleted"]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}
