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

function getEnquiries($pdo, $id = null, $resource = null) {
    if ($id && $resource === 'remarks') {
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
        return;
    }
    
    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM enquiries WHERE id = ?");
        $stmt->execute([$id]);
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

function updateEnquiry($pdo, $id, $body) {
    // Implementation placeholder for updates and remarks...
    http_response_code(501);
    echo json_encode(["message" => "Not fully implemented in this preview."]);
}

function deleteEnquiry($pdo, $id) {
    $stmt = $pdo->prepare("DELETE FROM enquiries WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(["message" => "Enquiry deleted."]);
}
