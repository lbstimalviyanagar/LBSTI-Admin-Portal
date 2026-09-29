<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';

$user = api_require_auth();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$id = filter_var($_GET['id'] ?? null, FILTER_VALIDATE_INT);
$resource = (string) ($_GET['resource'] ?? '');
$action = (string) ($_GET['action'] ?? '');

try {
    $db = api_db();
    $enquiryColumns = api_table_columns('enquiries');

    if ($resource === 'remarks') {
        if (!$id || !in_array($method, ['GET', 'POST'], true)) {
            api_json(['message' => 'Invalid remark request.'], 400);
        }
        if (!in_array('remarks', array_map('strtolower', $db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN)), true)) {
            api_json(['message' => 'The remarks table is not available in this database.'], 503);
        }
        if ($method === 'GET') {
            $statement = $db->prepare('SELECT id, enquiry_id, text, author, created_at FROM remarks WHERE enquiry_id = ? ORDER BY created_at ASC, id ASC');
            $statement->execute([$id]);
            $rows = array_map(static function (array $row): array {
                return ['id' => $row['id'], 'text' => $row['text'], 'author' => $row['author'] ?? 'Admin', 'createdAt' => $row['created_at'] ?? ''];
            }, $statement->fetchAll());
            api_json($rows);
        }
        $body = api_body();
        $text = trim((string) ($body['remark'] ?? $body['text'] ?? $body['message'] ?? ''));
        if ($text === '') {
            api_json(['message' => 'Remark text is required.'], 400);
        }
        $statement = $db->prepare('SELECT id FROM enquiries WHERE id = ?');
        $statement->execute([$id]);
        if (!$statement->fetch()) {
            api_json(['message' => 'Enquiry not found.'], 404);
        }
        $createdAt = date('Y-m-d H:i:s');
        $statement = $db->prepare('INSERT INTO remarks (enquiry_id, text, author, created_at) VALUES (?, ?, ?, ?)');
        $statement->execute([$id, $text, $user['name'] ?? 'Admin', $createdAt]);
        api_json(['id' => $db->lastInsertId(), 'text' => $text, 'author' => $user['name'] ?? 'Admin', 'createdAt' => $createdAt], 201);
    }

    if ($action === 'confirm') {
        if (!$id || $method !== 'POST') {
            api_json(['message' => 'Invalid confirmation request.'], 400);
        }
        $statement = $db->prepare('UPDATE enquiries SET status = ?, updated_at = ? WHERE id = ?');
        $statement->execute(['Confirmed', date('Y-m-d H:i:s'), $id]);
        $statement = $db->prepare('SELECT * FROM enquiries WHERE id = ?');
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!$row) {
            api_json(['message' => 'Enquiry not found.'], 404);
        }
        api_json(api_enquiry_row($row));
    }

    if ($method === 'GET') {
        if ($id) {
            $statement = $db->prepare('SELECT * FROM enquiries WHERE id = ?');
            $statement->execute([$id]);
            $row = $statement->fetch();
            if (!$row) {
                api_json(['message' => 'Enquiry not found.'], 404);
            }
            api_json(api_enquiry_row($row));
        }
        $order = in_array('created_at', $enquiryColumns, true) ? 'created_at' : 'id';
        $rows = $db->query('SELECT * FROM enquiries ORDER BY `' . $order . '` DESC')->fetchAll();
        api_json(array_map('api_enquiry_row', $rows));
    }

    if ($method === 'POST') {
        $body = api_body();
        $fields = [
            'name' => $body['name'] ?? '',
            'phone' => $body['phone'] ?? '',
            'city' => $body['city'] ?? '',
            'course' => $body['course'] ?? '',
            'batch' => $body['batch'] ?? '',
            'source' => $body['source'] ?? '',
            'status' => $body['status'] ?? 'New',
            'assigned_to' => $body['assignedTo'] ?? $body['assigned_to'] ?? '',
            'follow_up_date' => ($body['followUpDate'] ?? $body['follow_up_date'] ?? '') ?: null,
            'notes' => $body['notes'] ?? '',
        ];
        if (trim((string) $fields['name']) === '' || trim((string) $fields['phone']) === '') {
            api_json(['message' => 'Student name and phone are required.'], 400);
        }
        $now = date('Y-m-d H:i:s');
        $fields['created_at'] = $now;
        $fields['updated_at'] = $now;
        $fields = array_filter($fields, static function ($value, $key) use ($enquiryColumns): bool {
            return in_array($key, $enquiryColumns, true);
        }, ARRAY_FILTER_USE_BOTH);
        $names = array_keys($fields);
        $quoted = array_map(static function (string $name): string { return '`' . $name . '`'; }, $names);
        $sql = 'INSERT INTO enquiries (' . implode(', ', $quoted) . ') VALUES (' . implode(', ', array_fill(0, count($names), '?')) . ')';
        $statement = $db->prepare($sql);
        $statement->execute(array_values($fields));
        $statement = $db->prepare('SELECT * FROM enquiries WHERE id = ?');
        $statement->execute([$db->lastInsertId()]);
        api_json(api_enquiry_row($statement->fetch()), 201);
    }

    if ($method === 'PATCH' && $id) {
        $body = api_body();
        $allowed = [
            'name' => 'name', 'phone' => 'phone', 'city' => 'city', 'course' => 'course',
            'batch' => 'batch', 'source' => 'source', 'status' => 'status', 'assignedTo' => 'assigned_to',
            'followUpDate' => 'follow_up_date', 'notes' => 'notes',
        ];
        $updates = [];
        $values = [];
        foreach ($allowed as $input => $column) {
            if (array_key_exists($input, $body) || array_key_exists($column, $body)) {
                if (in_array($column, $enquiryColumns, true)) {
                    $updates[] = '`' . $column . '` = ?';
                    $value = $body[$input] ?? $body[$column];
                    if ($column === 'follow_up_date' && ($value === '' || $value === null)) {
                        $value = null;
                    }
                    $values[] = $value;
                }
            }
        }
        if (in_array('updated_at', $enquiryColumns, true)) {
            $updates[] = '`updated_at` = ?';
            $values[] = date('Y-m-d H:i:s');
        }
        if (!$updates) {
            api_json(['message' => 'No supported enquiry fields were supplied.'], 400);
        }
        $values[] = $id;
        $statement = $db->prepare('UPDATE enquiries SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $statement->execute($values);
        $statement = $db->prepare('SELECT * FROM enquiries WHERE id = ?');
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!$row) {
            api_json(['message' => 'Enquiry not found.'], 404);
        }
        api_json(api_enquiry_row($row));
    }

    if ($method === 'DELETE' && $id) {
        $db->beginTransaction();
        foreach (['remarks', 'fees'] as $dependent) {
            try {
                $statement = $db->prepare('DELETE FROM `' . $dependent . '` WHERE enquiry_id = ?');
                $statement->execute([$id]);
            } catch (PDOException $error) {
                if ($error->getCode() !== '42S02') {
                    throw $error;
                }
            }
        }
        $statement = $db->prepare('DELETE FROM enquiries WHERE id = ?');
        $statement->execute([$id]);
        $db->commit();
        api_json(null, 204);
    }

    api_json(['message' => 'Method not allowed or invalid enquiry id.'], 405);
} catch (Throwable $error) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    api_error($error, 'Unable to process the enquiry request.');
}
