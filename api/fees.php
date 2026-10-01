<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';
$user = api_require_auth(['admin', 'counselor', 'counsellor']);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);

try {
    $db = api_db();
    $feeColumns = api_table_columns('fees');
    if ($method === 'GET' && !$id) {
        $order = in_array('payment_date', $feeColumns, true) ? 'f.payment_date' : 'f.id';
        $rows = $db->query('SELECT f.*, e.name AS student_name FROM fees f LEFT JOIN enquiries e ON e.id = f.enquiry_id ORDER BY ' . $order . ' DESC, f.id DESC')->fetchAll();
        api_json(array_map('api_fee_row', $rows));
    }

    if ($method === 'POST' && !$id) {
        $body = api_body();
        $enquiryId = filter_var($body['enquiryId'] ?? $body['enquiry_id'] ?? null, FILTER_VALIDATE_INT);
        $amount = filter_var($body['amount'] ?? $body['fee_amount'] ?? null, FILTER_VALIDATE_FLOAT);
        if (!$enquiryId || $amount === false || $amount <= 0) {
            api_json(['message' => 'A valid student and payment amount are required.'], 400);
        }
        $statement = $db->prepare('SELECT id FROM enquiries WHERE id = ?');
        $statement->execute([$enquiryId]);
        if (!$statement->fetch()) {
            api_json(['message' => 'Student/enquiry record not found.'], 404);
        }
        $values = [
            'enquiry_id' => $enquiryId,
            'amount' => $amount,
            'payment_date' => ($body['paymentDate'] ?? $body['payment_date'] ?? '') ?: date('Y-m-d'),
            'mode' => $body['mode'] ?? $body['payment_mode'] ?? 'Cash',
            'notes' => $body['notes'] ?? '',
            'receipt_details' => json_encode($body['receiptDetails'] ?? $body['receipt_details'] ?? [], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
            'received_by' => $user['name'] ?? 'Admin',
            'created_at' => date('Y-m-d H:i:s'),
        ];
        if (in_array('total_fee', $feeColumns, true) && (isset($body['totalFee']) || isset($body['total_fee']))) {
            $values['total_fee'] = (float) ($body['totalFee'] ?? $body['total_fee']);
        }
        $values = array_filter($values, static function ($value, $column) use ($feeColumns): bool {
            return in_array($column, $feeColumns, true);
        }, ARRAY_FILTER_USE_BOTH);
        $names = array_keys($values);
        $quoted = array_map(static function (string $name): string { return '`' . $name . '`'; }, $names);
        $statement = $db->prepare('INSERT INTO fees (' . implode(', ', $quoted) . ') VALUES (' . implode(', ', array_fill(0, count($names), '?')) . ')');
        $statement->execute(array_values($values));
        $statement = $db->prepare('SELECT f.*, e.name AS student_name FROM fees f LEFT JOIN enquiries e ON e.id = f.enquiry_id WHERE f.id = ?');
        $statement->execute([$db->lastInsertId()]);
        api_json(api_fee_row($statement->fetch()), 201);
    }

    if ($method === 'DELETE' && $id) {
        $statement = $db->prepare('DELETE FROM fees WHERE id = ?');
        $statement->execute([$id]);
        api_json(null, 204);
    }

    api_json(['message' => 'Method not allowed or invalid payment id.'], 405);
} catch (Throwable $error) {
    api_error($error, 'Unable to process the fee payment request.');
}
