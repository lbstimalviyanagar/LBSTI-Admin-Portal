<?php
function ensureFeesTable($pdo) {
    // Use TEXT instead of JSON for broader MySQL compatibility (5.6+)
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS fees (
            id INT(11) PRIMARY KEY AUTO_INCREMENT,
            enquiry_id INT(11),
            student_name VARCHAR(255),
            course VARCHAR(255),
            amount DECIMAL(12,2) DEFAULT 0,
            payment_date DATE,
            mode VARCHAR(100),
            received_by VARCHAR(255) DEFAULT 'Admin',
            notes TEXT,
            receipt_details TEXT,
            receipt_number VARCHAR(100),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");
    } catch (Exception $e) {
        // Table may already exist with a different schema; proceed
    }
}

function getFees($pdo, $id) {
    ensureFeesTable($pdo);

    if ($id) {
        $stmt = $pdo->prepare("SELECT * FROM fees WHERE id = ?");
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) {
            http_response_code(404);
            die(json_encode(["message" => "Fee record not found."]));
        }
        echo json_encode(normalizeFee($row));
    } else {
        $stmt = $pdo->query("SELECT * FROM fees ORDER BY created_at DESC");
        $data = [];
        while ($row = $stmt->fetch()) {
            $data[] = normalizeFee($row);
        }
        echo json_encode($data);
    }
}

function createFee($pdo, $body, $user) {
    ensureFeesTable($pdo);

    $enquiryId      = isset($body["enquiryId"])      ? (int)$body["enquiryId"]      : null;
    $amount         = isset($body["amount"])          ? (float)$body["amount"]       : 0;
    $paymentDate    = isset($body["paymentDate"])     ? $body["paymentDate"]         : date("Y-m-d");
    $mode           = isset($body["mode"])            ? $body["mode"]                : "Cash";
    $notes          = isset($body["notes"])           ? $body["notes"]               : "";
    $receiptDetails = isset($body["receiptDetails"])  ? $body["receiptDetails"]      : null;

    if (!$enquiryId || !($amount > 0)) {
        http_response_code(400);
        die(json_encode(["message" => "Student and amount are required."]));
    }

    // ---------------------------------------------------------------
    // Look up student name + course from enquiries table first.
    // The Payments tab sends enquiryId which maps to enquiries.id.
    // ---------------------------------------------------------------
    $studentName = "Student";
    $course      = "";

    try {
        $stmt = $pdo->prepare("SELECT name, course FROM enquiries WHERE id = ?");
        $stmt->execute([$enquiryId]);
        $enquiryRow = $stmt->fetch();
        if ($enquiryRow) {
            $studentName = $enquiryRow["name"]   ? $enquiryRow["name"]   : "Student";
            $course      = $enquiryRow["course"] ? $enquiryRow["course"] : "";
        }
    } catch (Exception $e) {
        // enquiries table unavailable — fall through to students lookup
    }

    // Fallback: try students + enrollments tables
    if ($studentName === "Student") {
        try {
            $stmt = $pdo->prepare(
                "SELECT s.name, GROUP_CONCAT(DISTINCT e.course SEPARATOR ', ') AS courses
                 FROM students s
                 LEFT JOIN enrollments e ON e.student_id = s.student_id
                 WHERE s.id = ?
                 GROUP BY s.id"
            );
            $stmt->execute([$enquiryId]);
            $studentRow = $stmt->fetch();
            if ($studentRow) {
                $studentName = $studentRow["name"]    ? $studentRow["name"]    : "Student";
                $course      = $studentRow["courses"] ? $studentRow["courses"] : "";
            }
        } catch (Exception $e) {
            // students/enrollments table may not exist; keep defaults
        }
    }

    $receivedBy         = isset($user["name"]) ? $user["name"] : "Admin";
    $receiptDetailsJson = $receiptDetails ? json_encode($receiptDetails) : null;
    $now                = date("Y-m-d H:i:s");

    $stmt = $pdo->prepare(
        "INSERT INTO fees
            (enquiry_id, student_name, course, amount, payment_date, mode, received_by, notes, receipt_details, created_at, updated_at)
         VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $enquiryId, $studentName, $course, $amount,
        $paymentDate, $mode, $receivedBy, $notes,
        $receiptDetailsJson, $now, $now
    ]);

    $newId = $pdo->lastInsertId();
    $stmt  = $pdo->prepare("SELECT * FROM fees WHERE id = ?");
    $stmt->execute([$newId]);

    http_response_code(201);
    echo json_encode(normalizeFee($stmt->fetch()));
}

function updateFee($pdo, $id, $body) {
    $updates = [];
    $params  = [];
    $now     = date("Y-m-d H:i:s");

    $fields = [
        "amount"      => "amount",
        "paymentDate" => "payment_date",
        "mode"        => "mode",
        "notes"       => "notes"
    ];

    foreach ($fields as $jsonKey => $dbKey) {
        if (array_key_exists($jsonKey, $body)) {
            $updates[] = "$dbKey = ?";
            $params[]  = $body[$jsonKey];
        }
    }

    if (array_key_exists("receiptDetails", $body)) {
        $updates[] = "receipt_details = ?";
        $params[]  = json_encode($body["receiptDetails"]);
    }

    if (count($updates) > 0) {
        $updates[] = "updated_at = ?";
        $params[]  = $now;
        $params[]  = $id;
        $sql       = "UPDATE fees SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt      = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    $stmt = $pdo->prepare("SELECT * FROM fees WHERE id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        die(json_encode(["message" => "Fee record not found."]));
    }
    echo json_encode(normalizeFee($row));
}

function deleteFee($pdo, $id) {
    $stmt = $pdo->prepare("DELETE FROM fees WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(["message" => "Fee payment deleted."]);
}

function normalizeFee($row) {
    $receiptDetails = null;
    if (!empty($row["receipt_details"])) {
        $decoded = json_decode($row["receipt_details"], true);
        if (json_last_error() === JSON_ERROR_NONE) {
            $receiptDetails = $decoded;
        }
    }
    return [
        "id"             => (int)$row["id"],
        "enquiryId"      => (int)($row["enquiry_id"] ?? 0),
        "studentName"    => $row["student_name"] ?? "Student",
        "course"         => $row["course"]        ?? "",
        "amount"         => (float)($row["amount"] ?? 0),
        "paymentDate"    => $row["payment_date"]  ?? "",
        "mode"           => $row["mode"]          ?? "Cash",
        "receivedBy"     => $row["received_by"]   ?? "Admin",
        "notes"          => $row["notes"]         ?? "",
        "receiptDetails" => $receiptDetails,
        "receiptNumber"  => $row["receipt_number"] ?? null,
        "createdAt"      => $row["created_at"]    ?? "",
        "updatedAt"      => $row["updated_at"]    ?? ""
    ];
}
