<?php
function normalizeUser($row) {
    return [
        "id" => (int)$row['id'],
        "username" => $row['username'],
        "fullName" => $row['full_name'],
        "role" => $row['role'],
        "createdAt" => $row['created_at']
    ];
}

function getUsers($pdo) {
    $stmt = $pdo->query("SELECT id, username, full_name, role, created_at FROM portal_users ORDER BY created_at DESC");
    $users = [];
    while ($row = $stmt->fetch()) {
        $users[] = normalizeUser($row);
    }
    echo json_encode($users);
}

function createUser($pdo, $body) {
    $username = $body['username'] ?? '';
    $fullName = $body['fullName'] ?? '';
    $role = $body['role'] ?? '';
    $password = $body['password'] ?? '';
    
    if (!$username || !$fullName || !$role || !$password) {
        http_response_code(400);
        die(json_encode(["message" => "All fields required."]));
    }
    
    $stmt = $pdo->prepare("SELECT id FROM portal_users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        http_response_code(409);
        die(json_encode(["message" => "User already exists."]));
    }
    
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $now = date('Y-m-d H:i:s');
    
    $stmt = $pdo->prepare("INSERT INTO portal_users (username, full_name, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([$username, $fullName, $hash, $role, $now]);
    $id = $pdo->lastInsertId();
    
    $stmt = $pdo->prepare("SELECT id, username, full_name, role, created_at FROM portal_users WHERE id = ?");
    $stmt->execute([$id]);
    
    http_response_code(201);
    echo json_encode(normalizeUser($stmt->fetch()));
}

function updateUser($pdo, $id, $body) {
    // Basic implementation for update user
    http_response_code(501);
    echo json_encode(["message" => "Not fully implemented in this preview."]);
}

function deleteUser($pdo, $id) {
    $stmt = $pdo->prepare("DELETE FROM portal_users WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(["message" => "User deleted."]);
}
