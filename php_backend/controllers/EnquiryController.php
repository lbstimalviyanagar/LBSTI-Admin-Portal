<?php

function normalizeEnquiry($row) {
    return [
        "id" => (int)$row['id'],
        "name" => $row['name'],
        "phone" => $row['phone'],
        "email" => $row['email'],
        "city" => $row['city'],
        "course" => $row['course'],
        "batch" => $row['batch'],
        "source" => $row['source'],
        "status" => $row['status'],
        "assignedTo" => $row['assigned_to'],
        "followUpDate" => $row['follow_up_date'],
        "notes" => $row['notes'],
        "createdAt" => $row['created_at'],
        "updatedAt" => $row['updated_at']
    ];
}

function ensureRemarksTable($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `remarks` (
          `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          `enquiry_id` BIGINT UNSIGNED NOT NULL,
          `text` TEXT NOT NULL,
          `author` VARCHAR(190) DEFAULT 'Admin',
          `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `idx_remarks_enquiry_id` (`enquiry_id`),
          KEY `idx_remarks_created_at` (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");
    } catch (Exception $e) {}
}

function getEnquiries($pdo, $id = null, $resource = null) {
    if ($id && $resource === 'remarks') {
        getRemarks($pdo, $id);
        return;
    }
    
    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM enquiries WHERE id = ?");
        $stmt->execute([(int)$id]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            die(json_encode(["message" => "Enquiry not found."]));
        }
        echo json_encode(normalizeEnquiry($row));
        return;
    }
    
    $stmt = $pdo->query("SELECT * FROM enquiries ORDER BY created_at DESC");
    $enquiries = [];
    while ($row = $stmt->fetch()) {
        $enquiries[] = normalizeEnquiry($row);
    }
    echo json_encode($enquiries);
}

function confirmEnquiry($pdo, $id, $user = null) {
    try {
        $id = (int)$id;
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "Valid enquiry ID is required."]);
            return;
        }

        $stmt = $pdo->prepare("SELECT * FROM enquiries WHERE id = ?");
        $stmt->execute([$id]);
        $enquiry = $stmt->fetch();

        if (!$enquiry) {
            http_response_code(404);
            echo json_encode(["message" => "Enquiry not found."]);
            return;
        }

        $now = date('Y-m-d H:i:s');

        // Permanently persist Confirmed status in database
        $updateStmt = $pdo->prepare("UPDATE enquiries SET status = 'Confirmed', updated_at = ? WHERE id = ?");
        $updateStmt->execute([$now, $id]);

        // Add confirmation activity to remarks history
        ensureRemarksTable($pdo);
        try {
            $author = !empty($user['name']) ? $user['name'] : (!empty($user['username']) ? $user['username'] : 'Admin');
            $remStmt = $pdo->prepare("INSERT INTO remarks (enquiry_id, text, author, created_at) VALUES (?, 'Admission confirmed.', ?, ?)");
            $remStmt->execute([$id, $author, $now]);
        } catch (Exception $e) {}

        // Fetch fresh saved record directly from DB to verify persistence
        $freshStmt = $pdo->prepare("SELECT * FROM enquiries WHERE id = ?");
        $freshStmt->execute([$id]);
        $updated = $freshStmt->fetch();

        echo json_encode(normalizeEnquiry($updated));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function updateEnquiry($pdo, $id, $body) {
    try {
        $id = (int)$id;
        if (!$id) {
            http_response_code(400);
            echo json_encode(["message" => "Valid enquiry ID is required."]);
            return;
        }

        $stmt = $pdo->prepare("SELECT * FROM enquiries WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch();

        if (!$existing) {
            http_response_code(404);
            echo json_encode(["message" => "Enquiry not found."]);
            return;
        }

        $fields = [];
        $params = [];

        if (isset($body['name'])) {
            $fields[] = "name = ?";
            $params[] = trim($body['name']);
        }
        if (isset($body['phone'])) {
            $fields[] = "phone = ?";
            $params[] = trim($body['phone']);
        }
        if (array_key_exists('email', $body)) {
            $fields[] = "email = ?";
            $params[] = $body['email'] !== null ? trim($body['email']) : null;
        }
        if (array_key_exists('city', $body)) {
            $fields[] = "city = ?";
            $params[] = $body['city'] !== null ? trim($body['city']) : null;
        }
        if (array_key_exists('course', $body)) {
            $fields[] = "course = ?";
            $params[] = $body['course'] !== null ? trim($body['course']) : null;
        }
        if (array_key_exists('batch', $body)) {
            $fields[] = "batch = ?";
            $params[] = $body['batch'] !== null ? trim($body['batch']) : null;
        }
        if (array_key_exists('source', $body)) {
            $fields[] = "source = ?";
            $params[] = $body['source'] !== null ? trim($body['source']) : null;
        }
        if (isset($body['status'])) {
            $fields[] = "status = ?";
            $params[] = trim($body['status']);
        }
        if (array_key_exists('assignedTo', $body) || array_key_exists('assigned_to', $body)) {
            $val = $body['assignedTo'] ?? $body['assigned_to'] ?? null;
            $fields[] = "assigned_to = ?";
            $params[] = $val !== null ? trim($val) : null;
        }
        if (array_key_exists('followUpDate', $body) || array_key_exists('follow_up_date', $body)) {
            $val = $body['followUpDate'] ?? $body['follow_up_date'] ?? null;
            $fields[] = "follow_up_date = ?";
            $params[] = !empty($val) ? trim($val) : null;
        }
        if (array_key_exists('notes', $body)) {
            $fields[] = "notes = ?";
            $params[] = $body['notes'] !== null ? trim($body['notes']) : null;
        }

        if (empty($fields)) {
            echo json_encode(normalizeEnquiry($existing));
            return;
        }

        $now = date('Y-m-d H:i:s');
        $fields[] = "updated_at = ?";
        $params[] = $now;

        $params[] = $id;

        $sql = "UPDATE enquiries SET " . implode(", ", $fields) . " WHERE id = ?";
        $updateStmt = $pdo->prepare($sql);
        $updateStmt->execute($params);

        $freshStmt = $pdo->prepare("SELECT * FROM enquiries WHERE id = ?");
        $freshStmt->execute([$id]);
        $updated = $freshStmt->fetch();

        echo json_encode(normalizeEnquiry($updated));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function getRemarks($pdo, $id) {
    try {
        ensureRemarksTable($pdo);
        $id = (int)$id;
        $stmt = $pdo->prepare("SELECT * FROM remarks WHERE enquiry_id = ? ORDER BY created_at ASC");
        $stmt->execute([$id]);
        $remarks = [];
        while($row = $stmt->fetch()) {
            $remarks[] = [
                "id" => (int)$row['id'],
                "enquiryId" => (int)$row['enquiry_id'],
                "text" => $row['text'],
                "author" => $row['author'],
                "createdAt" => $row['created_at']
            ];
        }
        echo json_encode($remarks);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function addRemark($pdo, $id, $body, $user = null) {
    try {
        ensureRemarksTable($pdo);
        $id = (int)$id;
        $text = trim($body['text'] ?? ($body['remark'] ?? ''));
        if (!$text) {
            http_response_code(400);
            echo json_encode(["message" => "Remark text is required."]);
            return;
        }

        $author = trim($body['author'] ?? (!empty($user['name']) ? $user['name'] : (!empty($user['username']) ? $user['username'] : 'Admin')));
        $now = date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("INSERT INTO remarks (enquiry_id, text, author, created_at) VALUES (?, ?, ?, ?)");
        $stmt->execute([$id, $text, $author, $now]);
        $remId = $pdo->lastInsertId();

        echo json_encode([
            "id" => (int)$remId,
            "enquiryId" => $id,
            "text" => $text,
            "author" => $author,
            "createdAt" => $now
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createEnquiry($pdo, $body) {
    $name = trim($body['name'] ?? '');
    $phone = trim($body['phone'] ?? '');
    if (!$name || !$phone) {
        http_response_code(400);
        die(json_encode(["message" => "Name and phone required."]));
    }
    
    $stmt = $pdo->prepare("SELECT id, name FROM enquiries WHERE phone = ?");
    $stmt->execute([$phone]);
    if ($existing = $stmt->fetch()) {
        http_response_code(409);
        die(json_encode(["message" => "An enquiry with this phone already exists."]));
    }
    
    $now = date('Y-m-d H:i:s');
    $sql = "INSERT INTO enquiries (name, phone, email, city, course, batch, source, status, assigned_to, follow_up_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        $name, $phone, $body['email'] ?? null, $body['city'] ?? null, $body['course'] ?? null,
        $body['batch'] ?? null, $body['source'] ?? null, $body['status'] ?? 'New',
        $body['assignedTo'] ?? null, $body['followUpDate'] ?? null, $body['notes'] ?? null,
        $now, $now
    ]);
    
    $id = $pdo->lastInsertId();
    getEnquiries($pdo, $id);
}

function deleteEnquiry($pdo, $id) {
    $id = (int)$id;
    ensureRemarksTable($pdo);
    try {
        $pdo->prepare("DELETE FROM remarks WHERE enquiry_id = ?")->execute([$id]);
    } catch (Exception $e) {}
    $stmt = $pdo->prepare("DELETE FROM enquiries WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(["message" => "Enquiry deleted."]);
}

function bulkCreateEnquiries($pdo, $body) {
    $leads = $body['leads'] ?? [];
    if (!is_array($leads) || count($leads) === 0) {
        http_response_code(400);
        die(json_encode(["message" => "No leads provided for import."]));
    }

    $successCount = 0;
    $skipCount = 0;
    
    $checkStmt = $pdo->prepare("SELECT id FROM enquiries WHERE phone = ?");
    $insertStmt = $pdo->prepare("INSERT INTO enquiries (name, phone, email, city, course, batch, source, status, assigned_to, follow_up_date, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

    foreach ($leads as $lead) {
        $name = trim($lead['name'] ?? '');
        $phone = trim($lead['phone'] ?? '');
        
        if (!$name || !$phone) {
            $skipCount++;
            continue;
        }

        $checkStmt->execute([$phone]);
        if ($checkStmt->fetch()) {
            $skipCount++;
            continue;
        }

        $now = date('Y-m-d H:i:s');
        $insertStmt->execute([
            $name, $phone, trim($lead['email'] ?? ''), trim($lead['city'] ?? ''), trim($lead['course'] ?? ''),
            trim($lead['batch'] ?? ''), trim($lead['source'] ?? ''), trim($lead['status'] ?? 'New'),
            trim($lead['assignedTo'] ?? ''), trim($lead['followUpDate'] ?? '') ?: null, trim($lead['notes'] ?? ''),
            $now, $now
        ]);
        $successCount++;
    }

    echo json_encode(["message" => "Successfully imported $successCount leads. Skipped $skipCount duplicates/invalid."]);
}
