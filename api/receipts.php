<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';
$user = api_require_auth(['admin', 'counselor', 'counsellor']);

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    api_json(['message' => 'Method not allowed.'], 405);
}

$body = api_body();
$paymentId = filter_var($body['paymentId'] ?? $body['payment_id'] ?? null, FILTER_VALIDATE_INT);
if (!$paymentId) {
    api_json(['message' => 'A valid payment id is required.'], 400);
}

try {
    $db = api_db();
    $statement = $db->prepare('SELECT id FROM fees WHERE id = ?');
    $statement->execute([$paymentId]);
    if (!$statement->fetch()) {
        api_json(['message' => 'Payment record not found.'], 404);
    }

    $statement = $db->prepare('SELECT id, receipt_number FROM receipts WHERE payment_id = ? LIMIT 1');
    $statement->execute([$paymentId]);
    $receipt = $statement->fetch();
    if (!$receipt) {
        $receiptNumber = 'LBSTI-' . date('Y') . '-' . str_pad((string) $paymentId, 6, '0', STR_PAD_LEFT);
        try {
            $statement = $db->prepare('INSERT INTO receipts (payment_id, receipt_number, issued_by, issued_at) VALUES (?, ?, ?, ?)');
            $statement->execute([$paymentId, $receiptNumber, $user['name'] ?? 'Admin', date('Y-m-d H:i:s')]);
            $receipt = ['id' => $db->lastInsertId(), 'receipt_number' => $receiptNumber];
        } catch (PDOException $error) {
            if ($error->getCode() !== '23000') {
                throw $error;
            }
            $statement = $db->prepare('SELECT id, receipt_number FROM receipts WHERE payment_id = ? LIMIT 1');
            $statement->execute([$paymentId]);
            $receipt = $statement->fetch();
            if (!$receipt) {
                throw $error;
            }
        }
    }
    api_json(['id' => $receipt['id'], 'paymentId' => $paymentId, 'receiptNumber' => $receipt['receipt_number']]);
} catch (Throwable $error) {
    api_error($error, 'Unable to issue the receipt. Verify that the receipts table is installed.');
}
