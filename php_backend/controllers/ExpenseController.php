<?php

function ensureExpenseTables($pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `expense_categories` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `name` VARCHAR(120) NOT NULL,
        `is_default` TINYINT(1) NOT NULL DEFAULT 0,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        UNIQUE KEY `uq_expense_categories_name` (`name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `expenses` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `title` VARCHAR(190) NOT NULL,
        `category_id` BIGINT UNSIGNED NOT NULL,
        `amount` DECIMAL(12,2) NOT NULL,
        `expense_date` DATE NOT NULL,
        `payment_method` VARCHAR(40) NOT NULL,
        `payment_status` VARCHAR(16) NOT NULL,
        `vendor_name` VARCHAR(190) NOT NULL,
        `description` TEXT DEFAULT NULL,
        `receipt_data` LONGBLOB DEFAULT NULL,
        `receipt_mime` VARCHAR(80) DEFAULT NULL,
        `receipt_name` VARCHAR(255) DEFAULT NULL,
        `created_by` VARCHAR(190) NOT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        KEY `idx_expenses_date` (`expense_date`, `id`),
        KEY `idx_expenses_category` (`category_id`, `expense_date`),
        KEY `idx_expenses_status` (`payment_status`, `expense_date`),
        CONSTRAINT `fk_expenses_category`
          FOREIGN KEY (`category_id`) REFERENCES `expense_categories` (`id`)
          ON DELETE RESTRICT ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $defaults = [
        'Stationery', 'Pantry', 'Marketing', 'Google Ads', "Teachers' Payments",
        'Employee Salaries', 'Office Rent', 'Water Bills', 'Electricity Bills',
        'Internet & Wi-Fi', 'Maintenance', 'Transportation', 'Miscellaneous'
    ];
    $find = $pdo->prepare('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?) LIMIT 1');
    $insert = $pdo->prepare('INSERT INTO expense_categories (name, is_default) VALUES (?, 1)');
    foreach ($defaults as $name) {
        $find->execute([$name]);
        if (!$find->fetchColumn()) {
            $insert->execute([$name]);
        }
    }
}

function expenseJson($value, $status = 200) {
    http_response_code($status);
    echo json_encode($value, JSON_UNESCAPED_UNICODE);
}

function expenseTextLimit($value, $length) {
    return function_exists('mb_substr') ? mb_substr($value, 0, $length) : substr($value, 0, $length);
}

function normalizeExpenseRecord($row) {
    return [
        'id' => (int)$row['id'],
        'expenseId' => 'EXP-' . str_pad((string)$row['id'], 6, '0', STR_PAD_LEFT),
        'title' => $row['title'],
        'categoryId' => (int)$row['category_id'],
        'categoryName' => $row['category_name'],
        'amount' => (float)$row['amount'],
        'expenseDate' => substr((string)$row['expense_date'], 0, 10),
        'paymentMethod' => $row['payment_method'],
        'paymentStatus' => $row['payment_status'],
        'vendorName' => $row['vendor_name'],
        'description' => $row['description'] ?? '',
        'receiptName' => $row['receipt_name'] ?? '',
        'receiptUrl' => !empty($row['receipt_name']) ? '/api/expenses/' . (int)$row['id'] . '/receipt' : '',
        'createdBy' => $row['created_by'],
        'createdAt' => $row['created_at']
    ];
}

function findExpenseRecord($pdo, $id) {
    $stmt = $pdo->prepare("SELECT e.*, c.name AS category_name
        FROM expenses e
        INNER JOIN expense_categories c ON c.id = e.category_id
        WHERE e.id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function validExpenseId($value) {
    if (!is_scalar($value) || !preg_match('/^[1-9]\d*$/D', (string)$value)) {
        return null;
    }
    $id = filter_var($value, FILTER_VALIDATE_INT);
    return $id === false ? null : $id;
}

function validateExpenseInput($body) {
    $title = trim((string)($body['title'] ?? ''));
    $vendor = trim((string)($body['vendorName'] ?? ''));
    $categoryId = validExpenseId($body['categoryId'] ?? null);
    $amountText = trim((string)($body['amount'] ?? ''));
    $expenseDate = (string)($body['expenseDate'] ?? '');
    $date = DateTime::createFromFormat('!Y-m-d', $expenseDate);
    $dateErrors = DateTime::getLastErrors();

    if ($title === '' || strlen($title) > 190) {
        return ['error' => 'Expense title is required (maximum 190 characters).'];
    }
    if (!$categoryId) {
        return ['error' => 'Select a valid expense category.'];
    }
    if (!preg_match('/^\d{1,10}(?:\.\d{1,2})?$/D', $amountText) || (float)$amountText <= 0) {
        return ['error' => 'Enter an amount greater than ₹0 with no more than two decimal places.'];
    }
    if (!$date || ($dateErrors && ($dateErrors['warning_count'] || $dateErrors['error_count'])) || $date->format('Y-m-d') !== $expenseDate) {
        return ['error' => 'Enter a valid expense date.'];
    }
    if (!in_array($body['paymentMethod'] ?? '', ['Cash', 'UPI', 'Bank Transfer', 'Card'], true)) {
        return ['error' => 'Select a valid payment method.'];
    }
    if (!in_array($body['paymentStatus'] ?? '', ['Paid', 'Pending'], true)) {
        return ['error' => 'Select a valid payment status.'];
    }
    if ($vendor === '' || strlen($vendor) > 190) {
        return ['error' => 'Paid To / Vendor is required (maximum 190 characters).'];
    }

    return ['expense' => [
        'title' => $title,
        'categoryId' => $categoryId,
        'amount' => (float)$amountText,
        'expenseDate' => $expenseDate,
        'paymentMethod' => $body['paymentMethod'],
        'paymentStatus' => $body['paymentStatus'],
        'vendorName' => $vendor,
        'description' => expenseTextLimit(trim((string)($body['description'] ?? '')), 5000)
    ]];
}

function validateExpenseReceipt($receipt) {
    $allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!is_array($receipt)) {
        return ['error' => 'The receipt upload is invalid.'];
    }

    $mime = strtolower(trim((string)($receipt['mimeType'] ?? '')));
    $base64 = (string)($receipt['data'] ?? '');
    $name = basename(str_replace('\\', '/', (string)($receipt['name'] ?? 'receipt')));
    $name = expenseTextLimit(preg_replace('/[\x00-\x1F\x7F"]/', '', $name), 255);
    if (!in_array($mime, $allowedTypes, true)) {
        return ['error' => 'Receipts must be a PDF, JPEG, PNG, or WebP file.'];
    }
    if ($name === '' || $base64 === '') {
        return ['error' => 'The receipt upload is invalid.'];
    }

    $data = base64_decode($base64, true);
    if ($data === false || strlen($data) === 0 || strlen($data) > 5 * 1024 * 1024) {
        return ['error' => 'Receipt files must be smaller than 5 MB.'];
    }

    $validSignature =
        ($mime === 'application/pdf' && substr($data, 0, 5) === '%PDF-') ||
        ($mime === 'image/jpeg' && substr($data, 0, 3) === "\xFF\xD8\xFF") ||
        ($mime === 'image/png' && substr($data, 0, 8) === "\x89PNG\r\n\x1A\n") ||
        ($mime === 'image/webp' && substr($data, 0, 4) === 'RIFF' && substr($data, 8, 4) === 'WEBP');
    if (!$validSignature) {
        return ['error' => 'The receipt content does not match its file type.'];
    }

    return ['data' => $data, 'mimeType' => $mime, 'name' => $name];
}

function getExpenseCategories($pdo) {
    ensureExpenseTables($pdo);
    $stmt = $pdo->query('SELECT id, name, is_default FROM expense_categories ORDER BY is_default DESC, name ASC');
    $categories = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $categories[] = [
            'id' => (int)$row['id'],
            'name' => $row['name'],
            'isDefault' => (bool)$row['is_default']
        ];
    }
    expenseJson($categories);
}

function createExpenseCategory($pdo, $body) {
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '' || strlen($name) > 120) {
        return expenseJson(['message' => 'Category name is required (maximum 120 characters).'], 400);
    }
    $stmt = $pdo->prepare('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?) LIMIT 1');
    $stmt->execute([$name]);
    if ($stmt->fetchColumn()) {
        return expenseJson(['message' => 'A category with this name already exists.'], 409);
    }
    try {
        $insert = $pdo->prepare('INSERT INTO expense_categories (name, is_default) VALUES (?, 0)');
        $insert->execute([$name]);
    } catch (PDOException $error) {
        if (($error->errorInfo[1] ?? null) === 1062) {
            return expenseJson(['message' => 'A category with this name already exists.'], 409);
        }
        throw $error;
    }
    expenseJson(['id' => (int)$pdo->lastInsertId(), 'name' => $name, 'isDefault' => false], 201);
}

function updateExpenseCategory($pdo, $id, $body) {
    $name = trim((string)($body['name'] ?? ''));
    if ($name === '' || strlen($name) > 120) {
        return expenseJson(['message' => 'Category name is required (maximum 120 characters).'], 400);
    }
    $find = $pdo->prepare('SELECT id, is_default FROM expense_categories WHERE id = ?');
    $find->execute([$id]);
    $category = $find->fetch(PDO::FETCH_ASSOC);
    if (!$category) {
        return expenseJson(['message' => 'Expense category not found.'], 404);
    }
    if ((bool)$category['is_default']) {
        return expenseJson(['message' => 'Predefined categories cannot be edited.'], 403);
    }
    $duplicate = $pdo->prepare('SELECT id FROM expense_categories WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1');
    $duplicate->execute([$name, $id]);
    if ($duplicate->fetchColumn()) {
        return expenseJson(['message' => 'A category with this name already exists.'], 409);
    }
    $update = $pdo->prepare('UPDATE expense_categories SET name = ? WHERE id = ?');
    $update->execute([$name, $id]);
    expenseJson(['id' => (int)$id, 'name' => $name, 'isDefault' => false]);
}

function deleteExpenseCategory($pdo, $id) {
    $find = $pdo->prepare('SELECT id, is_default FROM expense_categories WHERE id = ?');
    $find->execute([$id]);
    $category = $find->fetch(PDO::FETCH_ASSOC);
    if (!$category) {
        return expenseJson(['message' => 'Expense category not found.'], 404);
    }
    if ((bool)$category['is_default']) {
        return expenseJson(['message' => 'Predefined categories cannot be deleted.'], 403);
    }
    $usage = $pdo->prepare('SELECT id FROM expenses WHERE category_id = ? LIMIT 1');
    $usage->execute([$id]);
    if ($usage->fetchColumn()) {
        return expenseJson(['message' => 'This category is used by existing expenses. Reassign them before deleting it.'], 409);
    }
    $delete = $pdo->prepare('DELETE FROM expense_categories WHERE id = ?');
    $delete->execute([$id]);
    http_response_code(204);
}

function getExpenses($pdo, $id = null) {
    ensureExpenseTables($pdo);
    if ($id !== null) {
        $row = findExpenseRecord($pdo, $id);
        if (!$row) {
            return expenseJson(['message' => 'Expense not found.'], 404);
        }
        return expenseJson(normalizeExpenseRecord($row));
    }
    $stmt = $pdo->query("SELECT e.*, c.name AS category_name
        FROM expenses e
        INNER JOIN expense_categories c ON c.id = e.category_id
        ORDER BY e.expense_date DESC, e.id DESC");
    $expenses = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $expenses[] = normalizeExpenseRecord($row);
    }
    expenseJson($expenses);
}

function createExpense($pdo, $body, $user) {
    $validated = validateExpenseInput(is_array($body) ? $body : []);
    if (isset($validated['error'])) {
        return expenseJson(['message' => $validated['error']], 400);
    }
    $expense = $validated['expense'];
    $receipt = null;
    if (isset($body['receipt']) && $body['receipt'] !== null) {
        $receipt = validateExpenseReceipt($body['receipt']);
        if (isset($receipt['error'])) {
            return expenseJson(['message' => $receipt['error']], 400);
        }
    }
    $category = $pdo->prepare('SELECT id FROM expense_categories WHERE id = ?');
    $category->execute([$expense['categoryId']]);
    if (!$category->fetchColumn()) {
        return expenseJson(['message' => 'Select an existing expense category.'], 400);
    }

    $insert = $pdo->prepare("INSERT INTO expenses
        (title, category_id, amount, expense_date, payment_method, payment_status, vendor_name, description,
         receipt_data, receipt_mime, receipt_name, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $insert->execute([
        $expense['title'], $expense['categoryId'], $expense['amount'], $expense['expenseDate'],
        $expense['paymentMethod'], $expense['paymentStatus'], $expense['vendorName'], $expense['description'],
        $receipt['data'] ?? null, $receipt['mimeType'] ?? null, $receipt['name'] ?? null,
        $user['name'] ?? $user['username'] ?? 'Admin'
    ]);
    $row = findExpenseRecord($pdo, (int)$pdo->lastInsertId());
    expenseJson(normalizeExpenseRecord($row), 201);
}

function updateExpense($pdo, $id, $body) {
    $validated = validateExpenseInput(is_array($body) ? $body : []);
    if (isset($validated['error'])) {
        return expenseJson(['message' => $validated['error']], 400);
    }
    $expense = $validated['expense'];
    $current = $pdo->prepare('SELECT id FROM expenses WHERE id = ?');
    $current->execute([$id]);
    if (!$current->fetchColumn()) {
        return expenseJson(['message' => 'Expense not found.'], 404);
    }
    $category = $pdo->prepare('SELECT id FROM expense_categories WHERE id = ?');
    $category->execute([$expense['categoryId']]);
    if (!$category->fetchColumn()) {
        return expenseJson(['message' => 'Select an existing expense category.'], 400);
    }

    if (isset($body['receipt']) && $body['receipt'] !== null) {
        $receipt = validateExpenseReceipt($body['receipt']);
        if (isset($receipt['error'])) {
            return expenseJson(['message' => $receipt['error']], 400);
        }
        $sql = "UPDATE expenses SET title = ?, category_id = ?, amount = ?, expense_date = ?, payment_method = ?,
            payment_status = ?, vendor_name = ?, description = ?, receipt_data = ?, receipt_mime = ?, receipt_name = ?
            WHERE id = ?";
        $params = [
            $expense['title'], $expense['categoryId'], $expense['amount'], $expense['expenseDate'],
            $expense['paymentMethod'], $expense['paymentStatus'], $expense['vendorName'], $expense['description'],
            $receipt['data'], $receipt['mimeType'], $receipt['name'], $id
        ];
    } elseif (($body['removeReceipt'] ?? false) === true) {
        $sql = "UPDATE expenses SET title = ?, category_id = ?, amount = ?, expense_date = ?, payment_method = ?,
            payment_status = ?, vendor_name = ?, description = ?, receipt_data = NULL, receipt_mime = NULL,
            receipt_name = NULL WHERE id = ?";
        $params = [
            $expense['title'], $expense['categoryId'], $expense['amount'], $expense['expenseDate'],
            $expense['paymentMethod'], $expense['paymentStatus'], $expense['vendorName'], $expense['description'], $id
        ];
    } else {
        $sql = "UPDATE expenses SET title = ?, category_id = ?, amount = ?, expense_date = ?, payment_method = ?,
            payment_status = ?, vendor_name = ?, description = ? WHERE id = ?";
        $params = [
            $expense['title'], $expense['categoryId'], $expense['amount'], $expense['expenseDate'],
            $expense['paymentMethod'], $expense['paymentStatus'], $expense['vendorName'], $expense['description'], $id
        ];
    }
    $update = $pdo->prepare($sql);
    $update->execute($params);
    $row = findExpenseRecord($pdo, $id);
    expenseJson(normalizeExpenseRecord($row));
}

function deleteExpense($pdo, $id) {
    $delete = $pdo->prepare('DELETE FROM expenses WHERE id = ?');
    $delete->execute([$id]);
    if (!$delete->rowCount()) {
        return expenseJson(['message' => 'Expense not found.'], 404);
    }
    http_response_code(204);
}

function getExpenseReceipt($pdo, $id) {
    $stmt = $pdo->prepare('SELECT receipt_data, receipt_mime, receipt_name FROM expenses WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row || $row['receipt_data'] === null) {
        return expenseJson(['message' => 'Receipt not found.'], 404);
    }
    $originalName = (string)($row['receipt_name'] ?: 'receipt');
    $fallbackName = preg_replace('/[^ -~]/', '_', $originalName);
    $fallbackName = str_replace(['"', '\\'], '_', $fallbackName);
    header('Content-Type: ' . $row['receipt_mime']);
    header("Content-Disposition: inline; filename=\"{$fallbackName}\"; filename*=UTF-8''" . rawurlencode($originalName));
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    echo $row['receipt_data'];
}
