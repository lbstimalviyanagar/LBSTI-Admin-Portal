<?php

declare(strict_types=1);

$apiPrivateSettings = [];
$apiPrivateSettingsPath = dirname(__DIR__, 2) . '/lbsti-private-config.php';
if (is_file($apiPrivateSettingsPath)) {
    $loadedSettings = require $apiPrivateSettingsPath;
    if (is_array($loadedSettings)) {
        $apiPrivateSettings = $loadedSettings;
    }
}

function api_env(string $name, string $default = ''): string
{
    global $apiPrivateSettings;
    $value = getenv($name);
    if ($value !== false) {
        return trim($value);
    }
    $settingNames = [
        'LBSTI_DB_HOST' => 'db_host',
        'LBSTI_DB_NAME' => 'db_name',
        'LBSTI_DB_USER' => 'db_user',
        'LBSTI_DB_PASSWORD' => 'db_password',
        'LBSTI_API_SECRET' => 'api_secret',
        'LBSTI_USERS_TABLE' => 'users_table',
    ];
    $settingName = $settingNames[$name] ?? '';
    return $settingName !== '' && isset($apiPrivateSettings[$settingName])
        ? trim((string) $apiPrivateSettings[$settingName])
        : $default;
}

function api_db(): PDO
{
    static $connection = null;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $host = api_env('LBSTI_DB_HOST', 'localhost');
    $database = api_env('LBSTI_DB_NAME', 'u807619393_lbstiadmin');
    $username = api_env('LBSTI_DB_USER');
    $password = api_env('LBSTI_DB_PASSWORD');
    if ($username === '' || $password === '') {
        throw new RuntimeException('Database credentials are not configured on the server.');
    }

    $dsn = 'mysql:host=' . $host . ';dbname=' . $database . ';charset=utf8mb4';
    $connection = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $connection;
}

function api_json($data, int $status = 200): void
{
    http_response_code($status);
    if ($status === 204) {
        exit;
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function api_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return $_POST ?: [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        api_json(['message' => 'Request body must be a JSON object.'], 400);
    }
    return $data;
}

function api_error(Throwable $error, string $message = 'The request could not be completed.', int $status = 500): void
{
    error_log('[LBSTI API] ' . $error->getMessage());
    api_json(['message' => $message], $status);
}

function api_table_columns(string $table): array
{
    if (!preg_match('/^[A-Za-z0-9_]+$/', $table)) {
        throw new RuntimeException('Invalid configured table name.');
    }
    $statement = api_db()->query('SHOW COLUMNS FROM `' . $table . '`');
    return array_column($statement->fetchAll(), 'Field');
}

function api_token_secret(): string
{
    $secret = api_env('LBSTI_API_SECRET');
    if (strlen($secret) < 32) {
        throw new RuntimeException('A server-side API signing secret of at least 32 characters is required.');
    }
    return $secret;
}

function api_b64url_encode(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function api_b64url_decode(string $value)
{
    $decoded = base64_decode(strtr($value, '-_', '+/') . str_repeat('=', (4 - strlen($value) % 4) % 4), true);
    return $decoded === false ? null : $decoded;
}

function api_issue_token(array $user): string
{
    $payload = api_b64url_encode(json_encode([
        'sub' => (string) $user['id'],
        'name' => (string) $user['name'],
        'role' => (string) $user['role'],
        'exp' => time() + 28800,
    ], JSON_UNESCAPED_SLASHES));
    $signature = hash_hmac('sha256', $payload, api_token_secret(), true);
    return $payload . '.' . api_b64url_encode($signature);
}

function api_current_user(): ?array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if (!preg_match('/^Bearer\s+([A-Za-z0-9_.-]+)$/i', $header, $match)) {
        return null;
    }
    $parts = explode('.', $match[1]);
    if (count($parts) !== 2) {
        return null;
    }
    try {
        $expected = hash_hmac('sha256', $parts[0], api_token_secret(), true);
    } catch (Throwable $error) {
        return null;
    }
    $signature = api_b64url_decode($parts[1]);
    $payload = api_b64url_decode($parts[0]);
    if ($signature === null || $payload === null || !hash_equals($expected, $signature)) {
        return null;
    }
    $claims = json_decode($payload, true);
    if (!is_array($claims) || empty($claims['sub']) || (int) ($claims['exp'] ?? 0) <= time()) {
        return null;
    }
    return $claims;
}

function api_require_auth(array $roles = []): array
{
    $user = api_current_user();
    if ($user === null) {
        api_json(['message' => 'Sign in to continue.'], 401);
    }
    if ($roles && !in_array(strtolower((string) $user['role']), $roles, true)) {
        api_json(['message' => 'Your account does not have permission for this action.'], 403);
    }
    return $user;
}

function api_enquiry_row(array $row): array
{
    return [
        'id' => $row['id'] ?? null,
        'name' => $row['name'] ?? '',
        'phone' => $row['phone'] ?? '',
        'email' => $row['email'] ?? '',
        'city' => $row['city'] ?? '',
        'course' => $row['course'] ?? '',
        'batch' => $row['batch'] ?? '',
        'source' => $row['source'] ?? '',
        'status' => $row['status'] ?? 'New',
        'assignedTo' => $row['assigned_to'] ?? '',
        'followUpDate' => $row['follow_up_date'] ?? '',
        'notes' => $row['notes'] ?? '',
        'createdAt' => $row['created_at'] ?? '',
        'updatedAt' => $row['updated_at'] ?? ($row['created_at'] ?? ''),
    ];
}

function api_fee_row(array $row): array
{
    return [
        'id' => $row['id'] ?? null,
        'enquiryId' => $row['enquiry_id'] ?? null,
        'studentName' => $row['student_name'] ?? '',
        'amount' => (float) ($row['amount'] ?? 0),
        'totalFee' => (float) ($row['total_fee'] ?? 0),
        'paymentDate' => $row['payment_date'] ?? '',
        'mode' => $row['mode'] ?? 'Cash',
        'notes' => $row['notes'] ?? '',
        'receivedBy' => $row['received_by'] ?? '',
        'createdAt' => $row['created_at'] ?? '',
    ];
}
