<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';
api_require_auth();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    api_json(['message' => 'Method not allowed.'], 405);
}

try {
    $columns = api_table_columns('enquiries');
    if (!in_array('status', $columns, true)) {
        api_json(['message' => 'The existing enquiries table has no status column.'], 503);
    }
    $rows = api_db()->query("SELECT * FROM enquiries WHERE LOWER(COALESCE(status, '')) IN ('confirmed', 'enrolled', 'admitted') ORDER BY id DESC")->fetchAll();
    api_json(array_map('api_enquiry_row', $rows));
} catch (Throwable $error) {
    api_error($error, 'Unable to load students from the existing enquiries records.');
}
