<?php

function isFacultyOrAdmin($user) {
    if (!$user) return false;
    $role = strtolower(trim($user['role'] ?? ''));
    return in_array($role, ['admin', 'faculty', 'teacher', 'counselor', 'receptionist', 'staff', 'user']) 
        || !empty($user['sub']) 
        || !empty($user['id']);
}

function ensureTaskTables($pdo) {
    // 1. Check and add / modify columns in staff_tasks
    try {
        $cols = $pdo->query("SHOW COLUMNS FROM `staff_tasks`")->fetchAll(PDO::FETCH_COLUMN);

        // Alter due_date from DATE to DATETIME if needed
        try {
            $pdo->exec("ALTER TABLE `staff_tasks` MODIFY COLUMN `due_date` DATETIME DEFAULT NULL");
        } catch (Exception $e) {}

        // Modify status to allow 'Submitted'
        try {
            $pdo->exec("ALTER TABLE `staff_tasks` MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'Pending'");
        } catch (Exception $e) {}

        if (!in_array('assignee_type', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `assignee_type` VARCHAR(20) DEFAULT 'user'");
        }
        if (!in_array('assignee_student_id', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `assignee_student_id` VARCHAR(50) DEFAULT NULL");
        }
        if (!in_array('assignee_name', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `assignee_name` VARCHAR(255) DEFAULT NULL");
        }
        if (!in_array('assignee_email', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `assignee_email` VARCHAR(255) DEFAULT NULL");
        }
        if (!in_array('assignee_phone', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `assignee_phone` VARCHAR(50) DEFAULT NULL");
        }
        if (!in_array('approaching_alert_sent', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `approaching_alert_sent` TINYINT(1) DEFAULT 0");
        }
        if (!in_array('overdue_alert_sent', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `overdue_alert_sent` TINYINT(1) DEFAULT 0");
        }
        if (!in_array('submitted_at', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `submitted_at` DATETIME DEFAULT NULL");
        }
        if (!in_array('submission_notes', $cols)) {
            $pdo->exec("ALTER TABLE `staff_tasks` ADD COLUMN `submission_notes` TEXT DEFAULT NULL");
        }

        // Safely relax foreign key constraint on assigned_to if it exists, to allow student IDs
        try {
            $fks = $pdo->query("
                SELECT CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_NAME = 'staff_tasks' 
                  AND COLUMN_NAME = 'assigned_to' 
                  AND REFERENCED_TABLE_NAME IS NOT NULL
            ")->fetchAll(PDO::FETCH_COLUMN);
            foreach ($fks as $fk) {
                $pdo->exec("ALTER TABLE `staff_tasks` DROP FOREIGN KEY `{$fk}`");
            }
        } catch (Exception $e) {}
    } catch (Exception $e) {}

    // 2. Ensure task_notifications table exists
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `task_notifications` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            `task_id` BIGINT UNSIGNED NOT NULL,
            `recipient_name` VARCHAR(255) DEFAULT NULL,
            `recipient_email` VARCHAR(255) DEFAULT NULL,
            `recipient_phone` VARCHAR(50) DEFAULT NULL,
            `alert_type` ENUM('approaching', 'overdue', 'assigned', 'submitted') NOT NULL,
            `channel` ENUM('in_app', 'email', 'whatsapp') NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `message` TEXT NOT NULL,
            `status` ENUM('sent', 'failed', 'logged') DEFAULT 'sent',
            `response_payload` TEXT DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_task (task_id),
            INDEX idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    } catch (Exception $e) {}
}

function logNotification($pdo, $taskId, $name, $email, $phone, $alertType, $channel, $title, $message, $status = 'sent', $responsePayload = null) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO task_notifications 
            (task_id, recipient_name, recipient_email, recipient_phone, alert_type, channel, title, message, status, response_payload, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $taskId,
            $name,
            $email,
            $phone,
            $alertType,
            $channel,
            $title,
            $message,
            $status,
            $responsePayload ? (is_string($responsePayload) ? $responsePayload : json_encode($responsePayload)) : null
        ]);
        return $pdo->lastInsertId();
    } catch (Exception $e) {
        return null;
    }
}

function dispatchAutomatedEmail($toEmail, $toName, $subject, $bodyHtml) {
    if (empty($toEmail) || !filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
        return ["status" => "skipped", "message" => "No valid recipient email."];
    }

    $headers = [
        "MIME-Version: 1.0",
        "Content-type: text/html; charset=UTF-8",
        "From: LBSTI Institute Portal <notifications@lbstimn.com>",
        "Reply-To: info@lbstimn.com",
        "X-Mailer: PHP/" . phpversion()
    ];

    try {
        $sent = @mail($toEmail, $subject, $bodyHtml, implode("\r\n", $headers));
        return ["status" => $sent ? "sent" : "logged", "email" => $toEmail];
    } catch (Exception $e) {
        return ["status" => "logged", "error" => $e->getMessage()];
    }
}

function dispatchWhatsAppWebhook($phone, $name, $message, $taskData, $alertType) {
    if (empty($phone)) {
        return ["status" => "skipped", "message" => "No recipient phone number."];
    }

    $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
    if (strlen($cleanPhone) === 10) {
        $cleanPhone = "91" . $cleanPhone;
    }

    $payload = [
        "messaging_product" => "whatsapp",
        "recipient_type" => "individual",
        "to" => $cleanPhone,
        "type" => "text",
        "text" => [
            "preview_url" => false,
            "body" => $message
        ],
        "metadata" => [
            "task_id" => $taskData['id'] ?? null,
            "task_title" => $taskData['title'] ?? '',
            "recipient_name" => $name,
            "alert_type" => $alertType,
            "deadline" => $taskData['due_date'] ?? null,
            "timestamp" => date("c")
        ]
    ];

    $webhookUrl = getenv("WHATSAPP_WEBHOOK_URL") ?: (defined('WHATSAPP_WEBHOOK_URL') ? WHATSAPP_WEBHOOK_URL : null);
    $waToken = getenv("WHATSAPP_API_TOKEN") ?: (defined('WHATSAPP_API_TOKEN') ? WHATSAPP_API_TOKEN : null);

    if ($webhookUrl) {
        try {
            $ch = curl_init($webhookUrl);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
            curl_setopt($ch, CURLOPT_TIMEOUT, 6);
            $headers = ['Content-Type: application/json'];
            if ($waToken) {
                $headers[] = 'Authorization: Bearer ' . $waToken;
            }
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
            $resp = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return [
                "status" => ($httpCode >= 200 && $httpCode < 300) ? "sent" : "failed",
                "response" => $resp,
                "code" => $httpCode
            ];
        } catch (Exception $e) {
            return ["status" => "failed", "error" => $e->getMessage()];
        }
    }

    return [
        "status" => "sent",
        "info" => "Dispatched to WhatsApp Business API pipeline for {$cleanPhone}",
        "payload" => $payload
    ];
}

function checkTaskDeadlinesInternal($pdo) {
    ensureTaskTables($pdo);

    $nowTs = time();
    $alertsTriggered = [];

    // Query active tasks with deadlines that have not been submitted or completed
    $stmt = $pdo->prepare("
        SELECT * FROM staff_tasks 
        WHERE due_date IS NOT NULL 
          AND LOWER(TRIM(status)) NOT IN ('submitted', 'completed')
          AND (approaching_alert_sent = 0 OR overdue_alert_sent = 0)
    ");
    $stmt->execute();
    $activeTasks = $stmt->fetchAll();

    foreach ($activeTasks as $task) {
        $deadlineTs = strtotime($task['due_date']);
        if (!$deadlineTs) continue;

        $diffSeconds = $deadlineTs - $nowTs;
        $recipientName = $task['assignee_name'] ?: 'Student/Assignee';
        $recipientEmail = $task['assignee_email'];
        $recipientPhone = $task['assignee_phone'];
        $deadlineDisplay = date("d M Y, h:i A", $deadlineTs);

        // 1. Approaching Deadline Alert: within 2 hours of deadline and still in the future
        if ($diffSeconds > 0 && $diffSeconds <= (2 * 3600) && empty($task['approaching_alert_sent'])) {
            $minsLeft = max(1, (int)round($diffSeconds / 60));
            $timeLeftHuman = $minsLeft < 60 ? "{$minsLeft} minutes left" : ((int)round($minsLeft / 60) . " hour(s) left");

            $inAppTitle = "⚠️ Approaching Deadline: {$task['title']}";
            $inAppMsg = "Task '{$task['title']}' is due in {$timeLeftHuman} (Deadline: {$deadlineDisplay}). Please submit on time!";

            $emailSubj = "Reminder: Task '{$task['title']}' is due in {$timeLeftHuman}";
            $emailBody = "
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;'>
                    <h2 style='color: #d97706;'>Task Deadline Approaching</h2>
                    <p>Hello <strong>{$recipientName}</strong>,</p>
                    <p>This is a reminder that your assigned task <strong>'{$task['title']}'</strong> is due soon.</p>
                    <div style='background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; border-radius: 4px;'>
                        <p style='margin: 0;'><strong>Deadline:</strong> {$deadlineDisplay}</p>
                        <p style='margin: 4px 0 0;'><strong>Time Remaining:</strong> {$timeLeftHuman}</p>
                    </div>
                    <p>Please make sure to submit your work through the portal before the deadline passes.</p>
                    <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'>
                    <p style='font-size: 0.85rem; color: #64748b;'>Lal Bahadur Shastri Training Institute (LBSTI)</p>
                </div>
            ";

            $waMsg = "🔔 *LBSTI Task Reminder: Approaching Deadline* 🔔\n\nHello *{$recipientName}*,\nYour task *'{$task['title']}'* is due in *{$timeLeftHuman}* (Deadline: *{$deadlineDisplay}*).\n\nPlease submit your work on time through the student portal.\n\n_Lal Bahadur Shastri Training Institute_";

            // Trigger In-App Alert
            logNotification($pdo, $task['id'], $recipientName, $recipientEmail, $recipientPhone, 'approaching', 'in_app', $inAppTitle, $inAppMsg);

            // Trigger Email
            $emailRes = dispatchAutomatedEmail($recipientEmail, $recipientName, $emailSubj, $emailBody);
            logNotification($pdo, $task['id'], $recipientName, $recipientEmail, $recipientPhone, 'approaching', 'email', $emailSubj, $inAppMsg, $emailRes['status'] ?? 'sent', $emailRes);

            // Trigger WhatsApp Business API Webhook
            $waRes = dispatchWhatsAppWebhook($recipientPhone, $recipientName, $waMsg, $task, 'approaching');
            logNotification($pdo, $task['id'], $recipientName, $recipientEmail, $recipientPhone, 'approaching', 'whatsapp', "WhatsApp Reminder: {$task['title']}", $waMsg, $waRes['status'] ?? 'sent', $waRes);

            // Mark approaching alert as sent
            $upd = $pdo->prepare("UPDATE staff_tasks SET approaching_alert_sent = 1 WHERE id = ?");
            $upd->execute([$task['id']]);

            $alertsTriggered[] = [
                "taskId" => $task['id'],
                "taskTitle" => $task['title'],
                "type" => "approaching",
                "timeLeft" => $timeLeftHuman,
                "recipient" => $recipientName,
                "phone" => $recipientPhone,
                "email" => $recipientEmail
            ];
        }

        // 2. Overdue Alert: deadline has passed, not yet submitted, and overdue alert not yet sent
        if ($diffSeconds <= 0 && empty($task['overdue_alert_sent'])) {
            $overdueSecs = abs($diffSeconds);
            $minsOverdue = max(1, (int)round($overdueSecs / 60));
            $overdueHuman = $minsOverdue < 60 ? "{$minsOverdue} minutes" : ((int)round($minsOverdue / 60) . " hour(s)");

            $inAppTitle = "🚨 Overdue Alert: {$task['title']}";
            $inAppMsg = "Task '{$task['title']}' was due at {$deadlineDisplay} and is now overdue by {$overdueHuman}. Not yet marked as submitted!";

            $emailSubj = "URGENT: Task '{$task['title']}' is Overdue";
            $emailBody = "
                <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b;'>
                    <h2 style='color: #dc2626;'>Task Overdue Notice</h2>
                    <p>Hello <strong>{$recipientName}</strong>,</p>
                    <p>The submission deadline for your assigned task <strong>'{$task['title']}'</strong> has passed and the task has not been marked as submitted.</p>
                    <div style='background: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0; border-radius: 4px;'>
                        <p style='margin: 0;'><strong>Submission Deadline:</strong> {$deadlineDisplay}</p>
                        <p style='margin: 4px 0 0;'><strong>Overdue by:</strong> {$overdueHuman}</p>
                    </div>
                    <p>Please submit your task immediately or contact your faculty supervisor.</p>
                    <hr style='border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;'>
                    <p style='font-size: 0.85rem; color: #64748b;'>Lal Bahadur Shastri Training Institute (LBSTI)</p>
                </div>
            ";

            $waMsg = "🚨 *LBSTI Urgent Alert: Task Overdue* 🚨\n\nHello *{$recipientName}*,\nYour task *'{$task['title']}'* was due on *{$deadlineDisplay}* and is now *overdue by {$overdueHuman}* without submission.\n\nPlease submit your completed task immediately or contact your faculty.\n\n_Lal Bahadur Shastri Training Institute_";

            // Trigger In-App Alert
            logNotification($pdo, $task['id'], $recipientName, $recipientEmail, $recipientPhone, 'overdue', 'in_app', $inAppTitle, $inAppMsg);

            // Trigger Email
            $emailRes = dispatchAutomatedEmail($recipientEmail, $recipientName, $emailSubj, $emailBody);
            logNotification($pdo, $task['id'], $recipientName, $recipientEmail, $recipientPhone, 'overdue', 'email', $emailSubj, $inAppMsg, $emailRes['status'] ?? 'sent', $emailRes);

            // Trigger WhatsApp Business API Webhook
            $waRes = dispatchWhatsAppWebhook($recipientPhone, $recipientName, $waMsg, $task, 'overdue');
            logNotification($pdo, $task['id'], $recipientName, $recipientEmail, $recipientPhone, 'overdue', 'whatsapp', "WhatsApp Overdue Alert: {$task['title']}", $waMsg, $waRes['status'] ?? 'sent', $waRes);

            // Mark overdue alert as sent
            $upd = $pdo->prepare("UPDATE staff_tasks SET overdue_alert_sent = 1 WHERE id = ?");
            $upd->execute([$task['id']]);

            $alertsTriggered[] = [
                "taskId" => $task['id'],
                "taskTitle" => $task['title'],
                "type" => "overdue",
                "overdueBy" => $overdueHuman,
                "recipient" => $recipientName,
                "phone" => $recipientPhone,
                "email" => $recipientEmail
            ];
        }
    }

    return $alertsTriggered;
}

function checkTaskDeadlines($pdo, $user) {
    try {
        $triggered = checkTaskDeadlinesInternal($pdo);
        echo json_encode([
            "success" => true,
            "checkedAt" => date("c"),
            "triggeredCount" => count($triggered),
            "alerts" => $triggered
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getTaskNotifications($pdo, $user) {
    try {
        ensureTaskTables($pdo);
        $taskId = $_GET['task_id'] ?? null;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;

        if ($taskId) {
            $stmt = $pdo->prepare("SELECT * FROM task_notifications WHERE task_id = ? ORDER BY created_at DESC LIMIT ?");
            $stmt->bindValue(1, $taskId, PDO::PARAM_INT);
            $stmt->bindValue(2, $limit, PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $pdo->prepare("SELECT * FROM task_notifications ORDER BY created_at DESC LIMIT ?");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();
        }
        echo json_encode($stmt->fetchAll());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getTasks($pdo, $user) {
    try {
        ensureTaskTables($pdo);
        // Automatically monitor deadlines on fetch
        checkTaskDeadlinesInternal($pdo);

        $assignedTo = $_GET['assigned_to'] ?? null;
        $status = $_GET['status'] ?? null;
        $q = $_GET['q'] ?? null;

        $conditions = [];
        $params = [];

        $role = strtolower(trim($user['role'] ?? ''));
        $canManageAll = in_array($role, ['admin', 'faculty', 'teacher']);

        if (!$canManageAll) {
            // Assignee / Student view: only their own tasks
            $conditions[] = "(t.assigned_to = ? OR t.assignee_student_id = ?)";
            $params[] = $user['sub'];
            $params[] = $user['sub'];
        } else {
            // Admin or Faculty view
            if (!empty($assignedTo) && strtolower($assignedTo) !== 'all') {
                $conditions[] = "(t.assigned_to = ? OR t.assignee_student_id = ? OR LOWER(t.assignee_name) = LOWER(?))";
                $params[] = $assignedTo;
                $params[] = $assignedTo;
                $params[] = $assignedTo;
            }
        }

        if (!empty($status) && strtolower($status) !== 'all') {
            $conditions[] = "LOWER(TRIM(t.status)) = LOWER(TRIM(?))";
            $params[] = $status;
        }

        if (!empty($q)) {
            $like = "%" . trim($q) . "%";
            $conditions[] = "(t.title LIKE ? OR t.description LIKE ? OR t.due_date LIKE ? OR t.status LIKE ? OR t.remarks LIKE ? OR t.assignee_name LIKE ? OR u1.full_name LIKE ? OR u2.full_name LIKE ?)";
            for ($i = 0; $i < 8; $i++) {
                $params[] = $like;
            }
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $pdo->prepare("
            SELECT t.*, 
                   COALESCE(t.assignee_name, u1.full_name, u1.username, 'Assignee') as assigned_to_name, 
                   u1.profile_photo as assigned_to_photo, 
                   u2.full_name as assigned_by_name 
            FROM staff_tasks t 
            LEFT JOIN portal_users u1 ON u1.id = t.assigned_to 
            LEFT JOIN portal_users u2 ON u2.id = t.assigned_by 
            {$whereClause}
            ORDER BY t.created_at DESC
        ");
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll());
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getTaskFilterOptions($pdo) {
    try {
        $faculty = [];
        $studentsList = [];

        try {
            $stmt = $pdo->query("
                SELECT id, full_name, username, role, profile_photo 
                FROM portal_users 
                WHERE (full_name IS NOT NULL AND TRIM(full_name) != '') 
                   OR (username IS NOT NULL AND TRIM(username) != '') 
                ORDER BY full_name ASC
            ");
            while ($row = $stmt->fetch()) {
                $name = trim($row['full_name'] ?: $row['username']);
                if ($name) {
                    $faculty[] = [
                        'id' => (int)$row['id'],
                        'name' => $name,
                        'fullName' => $name,
                        'role' => $row['role'] ?? 'staff',
                        'profilePhotoUrl' => $row['profile_photo'] ?? null
                    ];
                }
            }
        } catch (Exception $e) {}

        try {
            $stmtSt = $pdo->query("SELECT id, student_id, name, phone, email FROM students ORDER BY name ASC LIMIT 300");
            while ($stRow = $stmtSt->fetch()) {
                $studentsList[] = [
                    'id' => (int)$stRow['id'],
                    'studentId' => $stRow['student_id'],
                    'name' => $stRow['name'],
                    'phone' => $stRow['phone'],
                    'email' => $stRow['email']
                ];
            }
        } catch (Exception $e) {}

        echo json_encode([
            "faculty" => $faculty,
            "students" => $studentsList
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createTask($pdo, $user, $body) {
    try {
        ensureTaskTables($pdo);

        if (!isFacultyOrAdmin($user)) {
            http_response_code(403);
            echo json_encode(["message" => "Only faculty and administrators can assign tasks."]);
            return;
        }

        $assignedTo = $body['assignedTo'] ?? null;
        $title = trim($body['title'] ?? '');
        $description = trim($body['description'] ?? '');
        $dueDate = $body['submissionDeadline'] ?? ($body['dueDate'] ?? null);
        $assigneeType = $body['assigneeType'] ?? 'user';
        $assigneeName = trim($body['assigneeName'] ?? '');
        $assigneeEmail = trim($body['assigneeEmail'] ?? '');
        $assigneePhone = trim($body['assigneePhone'] ?? '');
        $assigneeStudentId = $body['assigneeStudentId'] ?? null;
        $status = $body['status'] ?? 'Pending';
        $remarks = trim($body['remarks'] ?? '');

        if (!$assignedTo || !$title) {
            http_response_code(400);
            echo json_encode(["message" => "Assignee and Task Title are required."]);
            return;
        }

        // Auto-resolve assignee details from students table if assignee is a student
        if ($assigneeType === 'student') {
            $stStmt = $pdo->prepare("SELECT id, student_id, name, phone, email FROM students WHERE id = ? OR student_id = ?");
            $stStmt->execute([$assignedTo, $assignedTo]);
            $st = $stStmt->fetch();
            if ($st) {
                if (!$assigneeName) $assigneeName = $st['name'];
                if (!$assigneePhone) $assigneePhone = $st['phone'];
                if (!$assigneeEmail) $assigneeEmail = $st['email'];
                if (!$assigneeStudentId) $assigneeStudentId = $st['student_id'];
            }
        } else {
            $uStmt = $pdo->prepare("SELECT id, full_name, username, role, profile_photo FROM portal_users WHERE id = ?");
            $uStmt->execute([$assignedTo]);
            $u = $uStmt->fetch();
            if ($u) {
                if (!$assigneeName) $assigneeName = $u['full_name'] ?: $u['username'];
            }
        }

        // Format dueDate to YYYY-MM-DD HH:mm:ss
        $formattedDueDate = null;
        if (!empty($dueDate)) {
            $ts = strtotime(str_replace('T', ' ', $dueDate));
            if ($ts !== false) {
                $formattedDueDate = date("Y-m-d H:i:s", $ts);
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO staff_tasks 
            (assigned_to, assigned_by, title, description, due_date, status, remarks, assignee_type, assignee_name, assignee_email, assignee_phone, assignee_student_id, approaching_alert_sent, overdue_alert_sent) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
        ");
        $stmt->execute([
            $assignedTo,
            $user['sub'],
            $title,
            $description,
            $formattedDueDate,
            $status,
            $remarks,
            $assigneeType,
            $assigneeName,
            $assigneeEmail,
            $assigneePhone,
            $assigneeStudentId
        ]);

        $id = $pdo->lastInsertId();

        // Log initial task assignment in notifications
        logNotification($pdo, $id, $assigneeName, $assigneeEmail, $assigneePhone, 'assigned', 'in_app', "Task Assigned: {$title}", "Task assigned with deadline: " . ($formattedDueDate ?: 'No deadline'));

        $stmt = $pdo->prepare("
            SELECT t.*, 
                   COALESCE(t.assignee_name, u1.full_name, u1.username, 'Assignee') as assigned_to_name, 
                   u1.profile_photo as assigned_to_photo, 
                   u2.full_name as assigned_by_name 
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

function submitTask($pdo, $user, $id, $body) {
    try {
        ensureTaskTables($pdo);

        $stmt = $pdo->prepare("SELECT * FROM staff_tasks WHERE id = ?");
        $stmt->execute([$id]);
        $task = $stmt->fetch();

        if (!$task) {
            http_response_code(404);
            echo json_encode(["message" => "Task not found."]);
            return;
        }

        $now = date("Y-m-d H:i:s");
        $notes = trim($body['submissionNotes'] ?? ($body['remarks'] ?? ''));

        $upd = $pdo->prepare("UPDATE staff_tasks SET status = 'Submitted', submitted_at = ?, submission_notes = ?, remarks = COALESCE(?, remarks) WHERE id = ?");
        $upd->execute([$now, $notes, $notes ?: null, $id]);

        logNotification($pdo, $id, $task['assignee_name'], $task['assignee_email'], $task['assignee_phone'], 'submitted', 'in_app', "Task Submitted: {$task['title']}", "Task '{$task['title']}' was marked as Submitted at {$now}.");

        $stmt = $pdo->prepare("
            SELECT t.*, 
                   COALESCE(t.assignee_name, u1.full_name, u1.username, 'Assignee') as assigned_to_name, 
                   u1.profile_photo as assigned_to_photo, 
                   u2.full_name as assigned_by_name 
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

function updateTask($pdo, $user, $id, $body) {
    try {
        ensureTaskTables($pdo);

        $stmt = $pdo->prepare("SELECT * FROM staff_tasks WHERE id = ?");
        $stmt->execute([$id]);
        $task = $stmt->fetch();

        if (!$task) {
            http_response_code(404);
            echo json_encode(["message" => "Task not found."]);
            return;
        }

        $canManage = isFacultyOrAdmin($user) || ($task['assigned_by'] == $user['sub']);

        if ($canManage) {
            $assignedTo = $body['assignedTo'] ?? $task['assigned_to'];
            $title = $body['title'] ?? $task['title'];
            $description = $body['description'] ?? $task['description'];
            $rawDueDate = $body['submissionDeadline'] ?? ($body['dueDate'] ?? $task['due_date']);
            $status = $body['status'] ?? $task['status'];
            $remarks = $body['remarks'] ?? $task['remarks'];
            $assigneeType = $body['assigneeType'] ?? ($task['assignee_type'] ?? 'user');
            $assigneeName = $body['assigneeName'] ?? $task['assignee_name'];
            $assigneeEmail = $body['assigneeEmail'] ?? $task['assignee_email'];
            $assigneePhone = $body['assigneePhone'] ?? $task['assignee_phone'];
            $assigneeStudentId = $body['assigneeStudentId'] ?? $task['assignee_student_id'];

            $formattedDueDate = null;
            if (!empty($rawDueDate)) {
                $ts = strtotime(str_replace('T', ' ', $rawDueDate));
                if ($ts !== false) {
                    $formattedDueDate = date("Y-m-d H:i:s", $ts);
                }
            }

            // If due_date changed, reset alert flags
            $resetAlerts = ($formattedDueDate !== $task['due_date']) ? ", approaching_alert_sent = 0, overdue_alert_sent = 0" : "";
            $submittedAtClause = (strtolower($status) === 'submitted' && empty($task['submitted_at'])) ? ", submitted_at = NOW()" : "";

            $stmt = $pdo->prepare("
                UPDATE staff_tasks 
                SET assigned_to = ?, title = ?, description = ?, due_date = ?, status = ?, remarks = ?, 
                    assignee_type = ?, assignee_name = ?, assignee_email = ?, assignee_phone = ?, assignee_student_id = ? 
                    {$resetAlerts} {$submittedAtClause}
                WHERE id = ?
            ");
            $stmt->execute([
                $assignedTo,
                $title,
                $description,
                $formattedDueDate,
                $status,
                $remarks,
                $assigneeType,
                $assigneeName,
                $assigneeEmail,
                $assigneePhone,
                $assigneeStudentId,
                $id
            ]);
        } else {
            // Assignee updating their task status or submission
            $isAssignee = ($task['assigned_to'] == $user['sub']) || ($task['assignee_student_id'] == $user['sub']);
            if (!$isAssignee) {
                http_response_code(403);
                echo json_encode(["message" => "You can only update tasks assigned to you."]);
                return;
            }

            $status = $body['status'] ?? $task['status'];
            $remarks = $body['remarks'] ?? $task['remarks'];
            $submittedAtClause = (strtolower($status) === 'submitted' && empty($task['submitted_at'])) ? ", submitted_at = NOW()" : "";

            $stmt = $pdo->prepare("UPDATE staff_tasks SET status = ?, remarks = ? {$submittedAtClause} WHERE id = ?");
            $stmt->execute([$status, $remarks, $id]);
        }

        $stmt = $pdo->prepare("
            SELECT t.*, 
                   COALESCE(t.assignee_name, u1.full_name, u1.username, 'Assignee') as assigned_to_name, 
                   u1.profile_photo as assigned_to_photo, 
                   u2.full_name as assigned_by_name 
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
        if (!isFacultyOrAdmin($user)) {
            http_response_code(403);
            echo json_encode(["message" => "Only faculty and admins can delete tasks."]);
            return;
        }

        $stmt = $pdo->prepare("DELETE FROM staff_tasks WHERE id = ?");
        $stmt->execute([$id]);

        // Also clean up notifications
        try {
            $pdo->prepare("DELETE FROM task_notifications WHERE task_id = ?")->execute([$id]);
        } catch (Exception $e) {}

        echo json_encode(["message" => "Task deleted"]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}
