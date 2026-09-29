<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    api_json(['message' => 'Method not allowed.'], 405);
}

try {
    $db = api_db();
    $requiredTables = ['enquiries', 'remarks', 'fees', 'portal_users', 'receipts'];
    $statement = $db->query('SHOW TABLES');
    $available = array_flip(array_map('strtolower', array_column($statement->fetchAll(PDO::FETCH_NUM), 0)));
    $tables = [];
    foreach ($requiredTables as $table) {
        $tables[$table] = isset($available[strtolower($table)]);
    }
    api_json([
        'ok' => true,
        'database' => api_env('LBSTI_DB_NAME', 'u807619393_lbstiadmin'),
        'tables' => $tables,
    ]);
} catch (Throwable $error) {
    api_error($error, 'MySQL connection failed or server credentials are not configured.', 503);
}
