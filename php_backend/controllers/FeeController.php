<?php
function ensureFeesTable($pdo) {
    // Create table if it doesn't exist (TEXT instead of JSON for MySQL 5.6+ compat)
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
        // Table may already exist — proceed to column migration below
    }

    // ---------------------------------------------------------------
    // Migration: add any columns that are missing in an older table.
    // Each ALTER is in its own try-catch so one failure doesn't block others.
    // ---------------------------------------------------------------
    $columnsToAdd = [
        "student_name"    => "VARCHAR(255) DEFAULT NULL",
        "course"          => "VARCHAR(255) DEFAULT NULL",
        "enrollment_id"   => "VARCHAR(50) DEFAULT NULL",
        "course_id"       => "VARCHAR(50) DEFAULT NULL",
        "billing_month"   => "VARCHAR(50) DEFAULT NULL",
        "balance"         => "DECIMAL(12,2) DEFAULT 0",
        "total_due"       => "DECIMAL(12,2) DEFAULT 0",
        "is_bulk"         => "TINYINT(1) DEFAULT 0",
        "receipt_details" => "TEXT DEFAULT NULL",
        "receipt_number"  => "VARCHAR(100) DEFAULT NULL",
        "updated_at"      => "DATETIME DEFAULT CURRENT_TIMESTAMP",
    ];

    // Fetch existing column names
    $existing = [];
    try {
        $res = $pdo->query("SHOW COLUMNS FROM fees");
        while ($col = $res->fetch()) {
            $existing[] = strtolower($col["Field"]);
        }
    } catch (Exception $e) { /* can't introspect — skip */ }

    foreach ($columnsToAdd as $col => $definition) {
        if (!in_array(strtolower($col), $existing)) {
            try {
                $pdo->exec("ALTER TABLE fees ADD COLUMN $col $definition");
            } catch (Exception $e) {
                // Column may have been added concurrently; ignore
            }
        }
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

    // Course selection
    $selectedCourse = "";
    if (!empty($body["course"])) {
        $selectedCourse = trim($body["course"]);
    } elseif (!empty($receiptDetails["course"])) {
        $selectedCourse = trim($receiptDetails["course"]);
    } elseif (!empty($receiptDetails["batch"])) {
        $selectedCourse = trim($receiptDetails["batch"]);
    }

    $isBulk = !empty($body["isBulkPayment"]) || $selectedCourse === "ALL_COURSES" || strtolower($selectedCourse) === "all enrolled courses (bulk payment)";
    if ($isBulk) {
        $selectedCourse = "All Enrolled Courses (Bulk Payment)";
    }

    $enrollmentId = !empty($body["enrollmentId"]) ? trim($body["enrollmentId"]) : (!empty($receiptDetails["enrollmentId"]) ? trim($receiptDetails["enrollmentId"]) : null);
    $courseId     = !empty($body["courseId"]) ? trim($body["courseId"]) : (!empty($receiptDetails["courseId"]) ? trim($receiptDetails["courseId"]) : ($isBulk ? "BULK" : null));
    $billingMonth = !empty($body["billingMonth"]) ? trim($body["billingMonth"]) : (!empty($receiptDetails["month"]) ? trim($receiptDetails["month"]) : null);

    $totalCourseFeesDue = isset($body["totalCourseFeesDue"]) ? (float)$body["totalCourseFeesDue"] : 0;
    $outstandingBalance = isset($body["outstandingBalance"]) ? (float)$body["outstandingBalance"] : (isset($body["balance"]) ? (float)$body["balance"] : 0);

    if (!$enquiryId || !($amount > 0)) {
        http_response_code(400);
        die(json_encode(["message" => "Student and amount are required."]));
    }

    if (empty($selectedCourse)) {
        http_response_code(400);
        die(json_encode(["message" => "A specific course or bulk payment must be selected."]));
    }

    // Look up student details
    $studentName  = "Student";
    $studentIdStr = !empty($body["studentId"]) ? trim($body["studentId"]) : null;

    try {
        $stmt = $pdo->prepare("SELECT student_id, name FROM students WHERE id = ?");
        $stmt->execute([$enquiryId]);
        $studentRow = $stmt->fetch();
        if ($studentRow) {
            $studentName  = $studentRow["name"] ? $studentRow["name"] : "Student";
            if (empty($studentIdStr)) {
                $studentIdStr = $studentRow["student_id"];
            }
        }
    } catch (Exception $e) {}

    if ($studentName === "Student") {
        try {
            $stmt = $pdo->prepare("SELECT name, course FROM enquiries WHERE id = ?");
            $stmt->execute([$enquiryId]);
            $enquiryRow = $stmt->fetch();
            if ($enquiryRow) {
                $studentName = $enquiryRow["name"] ? $enquiryRow["name"] : "Student";
            }
        } catch (Exception $e) {}
    }

    // If single course and enrollment_id not provided, look it up specifically
    if (!$isBulk && empty($enrollmentId) && !empty($studentIdStr) && !empty($selectedCourse)) {
        try {
            $stmt = $pdo->prepare("SELECT enrollment_id FROM enrollments WHERE student_id = ? AND course = ? LIMIT 1");
            $stmt->execute([$studentIdStr, $selectedCourse]);
            $enrRow = $stmt->fetch();
            if ($enrRow && !empty($enrRow["enrollment_id"])) {
                $enrollmentId = $enrRow["enrollment_id"];
            }
        } catch (Exception $e) {}
    }

    if (empty($courseId) && !empty($enrollmentId)) {
        $courseId = $enrollmentId;
    }

    // Ensure receiptDetails explicitly isolates metadata
    if (is_array($receiptDetails)) {
        $receiptDetails["batch"] = $selectedCourse;
        $receiptDetails["course"] = $selectedCourse;
        $receiptDetails["isBulkPayment"] = $isBulk;
        $receiptDetails["totalCourseFeesDue"] = $totalCourseFeesDue;
        $receiptDetails["outstandingBalance"] = $outstandingBalance;
        $receiptDetails["isSettled"] = $outstandingBalance <= 0;
        if ($enrollmentId) $receiptDetails["enrollmentId"] = $enrollmentId;
        if ($courseId) $receiptDetails["courseId"] = $courseId;
        if ($billingMonth) $receiptDetails["month"] = $billingMonth;
    }

    $receivedBy         = isset($user["name"]) ? $user["name"] : "Admin";
    $receiptDetailsJson = $receiptDetails ? json_encode($receiptDetails) : null;

    // NOTE: created_at and updated_at are set automatically via DEFAULT CURRENT_TIMESTAMP.
    $stmt = $pdo->prepare(
        "INSERT INTO fees
            (enquiry_id, student_name, course, enrollment_id, course_id, billing_month, amount, balance, total_due, is_bulk, payment_date, mode, received_by, notes, receipt_details)
         VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->execute([
        $enquiryId, $studentName, $selectedCourse, $enrollmentId, $courseId, $billingMonth,
        $amount, $outstandingBalance, $totalCourseFeesDue, ($isBulk ? 1 : 0),
        $paymentDate, $mode, $receivedBy, $notes,
        $receiptDetailsJson
    ]);

    $newId = $pdo->lastInsertId();

    // ── Natively update relational student balance and ledger data fields ──
    try {
        if (!empty($studentIdStr) || !empty($enquiryId)) {
            $updStudent = $pdo->prepare("UPDATE students SET balance = ?, total_fees = ? WHERE id = ? OR student_id = ?");
            $updStudent->execute([$outstandingBalance, $totalCourseFeesDue, $enquiryId, $studentIdStr]);
        }
    } catch (Exception $e) {}

    try {
        if ($isBulk) {
            if ($outstandingBalance <= 0 && !empty($studentIdStr)) {
                $updEnr = $pdo->prepare("UPDATE enrollments SET balance = 0 WHERE student_id = ?");
                $updEnr->execute([$studentIdStr]);
            }
        } elseif (!empty($studentIdStr) && !empty($selectedCourse)) {
            $updEnr = $pdo->prepare("UPDATE enrollments SET balance = ? WHERE student_id = ? AND course = ?");
            $updEnr->execute([$outstandingBalance, $studentIdStr, $selectedCourse]);
        }
    } catch (Exception $e) {}

    try {
        if (!empty($enquiryId)) {
            $updEnq = $pdo->prepare("UPDATE enquiries SET balance = ? WHERE id = ?");
            $updEnq->execute([$outstandingBalance, $enquiryId]);
        }
    } catch (Exception $e) {}

    $stmt = $pdo->prepare("SELECT * FROM fees WHERE id = ?");
    $stmt->execute([$newId]);

    http_response_code(201);
    echo json_encode(normalizeFee($stmt->fetch()));
}

function updateFee($pdo, $id, $body) {
    $updates = [];
    $params  = [];

    $fields = [
        "amount"       => "amount",
        "paymentDate"  => "payment_date",
        "mode"         => "mode",
        "notes"        => "notes",
        "course"       => "course",
        "enrollmentId" => "enrollment_id",
        "courseId"     => "course_id",
        "billingMonth" => "billing_month",
        "balance"      => "balance",
        "totalDue"     => "total_due",
        "isBulk"       => "is_bulk"
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
        $params[] = $id;
        $sql      = "UPDATE fees SET " . implode(", ", $updates) . " WHERE id = ?";
        $stmt     = $pdo->prepare($sql);
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
        "enquiryId"      => (int)($row["enquiry_id"]   ?? 0),
        "studentName"    => $row["student_name"]        ?? "Student",
        "course"         => $row["course"]              ?? "",
        "enrollmentId"   => $row["enrollment_id"]       ?? null,
        "courseId"       => $row["course_id"]           ?? null,
        "billingMonth"   => $row["billing_month"]       ?? ($receiptDetails["month"] ?? null),
        "amount"         => (float)($row["amount"]      ?? 0),
        "balance"        => (float)($row["balance"]     ?? 0),
        "totalDue"       => (float)($row["total_due"]   ?? 0),
        "isBulk"         => (bool)($row["is_bulk"]      ?? 0),
        "paymentDate"    => $row["payment_date"]        ?? "",
        "mode"           => $row["mode"]                ?? "Cash",
        "receivedBy"     => $row["received_by"]         ?? "Admin",
        "notes"          => $row["notes"]               ?? "",
        "receiptDetails" => $receiptDetails,
        "receiptNumber"  => $row["receipt_number"]      ?? null,
        "createdAt"      => $row["created_at"]          ?? "",
        "updatedAt"      => $row["updated_at"]          ?? ""
    ];
}
