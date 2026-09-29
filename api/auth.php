<?php

declare(strict_types=1);

require_once __DIR__ . '/cors.php';
require_once __DIR__ . '/config.php';

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    api_json(['message' => 'Method not allowed.'], 405);
}

$body = api_body();
$username = trim((string) ($body['username'] ?? $body['email'] ?? ''));
$password = $body['password'] ?? null;
if ($username === '' || !is_string($password) || $password === '') {
    api_json(['message' => 'Username and password are required.'], 400);
}

try {
    $table = api_env('LBSTI_USERS_TABLE', 'portal_users');
    $columns = api_table_columns($table);
    foreach (['id', 'username', 'full_name', 'password_hash', 'role'] as $required) {
        if (!in_array($required, $columns, true)) {
            throw new RuntimeException('The configured users table does not match the PHP password-hash schema.');
        }
    }
    $statement = api_db()->prepare('SELECT `id`, `username`, `full_name`, `password_hash`, `role` FROM `' . $table . '` WHERE `username` = ? LIMIT 1');
    $statement->execute([$username]);
    $record = $statement->fetch();
    if (!$record || !password_verify($password, (string) $record['password_hash'])) {
        api_json(['message' => 'Incorrect username or password.'], 401);
    }
    $role = strtolower((string) $record['role']);
    if (!in_array($role, ['admin', 'counselor', 'counsellor', 'user'], true)) {
        api_json(['message' => 'This account has an unsupported role.'], 403);
    }
    $user = ['id' => $record['id'], 'name' => $record['full_name'] ?: $record['username'], 'role' => $role];
    api_json(['token' => api_issue_token($user), 'user' => $user]);
} catch (Throwable $error) {
    api_error($error, 'Unable to sign in. Check the MySQL user table configuration.', 503);
}
