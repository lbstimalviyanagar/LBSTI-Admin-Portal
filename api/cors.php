<?php

$allowedOrigins = [
    'https://shireen-workspace.github.io',
    'https://lbstimn.com',
    'https://www.lbstimn.com',
    'http://127.0.0.1:5500',
    'http://localhost:5500',
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Accept, Content-Type, Authorization');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}
