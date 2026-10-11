<?php
function normalizeUser($row) {
    $role = trim($row['role'] ?? '');
    if (empty($role)) {
        $role = strtolower($row['username'] ?? '') === 'palwasha' ? 'teacher' : 'counselor';
    }
    
    $permissions = [];
    if (!empty($row['menu_permissions'])) {
        $decoded = json_decode($row['menu_permissions'], true);
        if (is_array($decoded)) {
            $permissions = $decoded;
        }
    }

    return [
        "id" => (int)$row['id'],
        "username" => $row['username'],
        "fullName" => $row['full_name'],
        "role" => $role,
        "menuPermissions" => $permissions,
        "profilePhotoUrl" => $row['profile_photo'] ?? null,
        "createdAt" => $row['created_at']
    ];
}

function hasMenuPermissionsColumn($pdo) {
    try {
        $c = $pdo->query("SHOW COLUMNS FROM `portal_users` LIKE 'menu_permissions'");
        return $c && $c->rowCount() > 0;
    } catch (Exception $e) {
        return false;
    }
}

function getUsers($pdo) {
    $stmt = $pdo->query("SELECT * FROM portal_users ORDER BY created_at DESC");
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
    $profilePhoto = $body['profilePhotoUrl'] ?? null;
    $menuPermissions = isset($body['menuPermissions']) && is_array($body['menuPermissions']) 
        ? json_encode(array_values(array_unique($body['menuPermissions']))) 
        : null;
    
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
    
    if (hasMenuPermissionsColumn($pdo)) {
        $stmt = $pdo->prepare("INSERT INTO portal_users (username, full_name, password_hash, role, menu_permissions, profile_photo, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$username, $fullName, $hash, $role, $menuPermissions, $profilePhoto, $now]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO portal_users (username, full_name, password_hash, role, profile_photo, created_at) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$username, $fullName, $hash, $role, $profilePhoto, $now]);
    }
    $id = $pdo->lastInsertId();
    
    $stmt = $pdo->prepare("SELECT * FROM portal_users WHERE id = ?");
    $stmt->execute([$id]);
    
    http_response_code(201);
    echo json_encode(normalizeUser($stmt->fetch()));
}

function updateUser($pdo, $id, $body) {
    $fullName = $body['fullName'] ?? null;
    $role = $body['role'] ?? null;
    $password = $body['password'] ?? null;
    $profilePhoto = $body['profilePhotoUrl'] ?? null;
    $menuPermissions = array_key_exists('menuPermissions', $body) 
        ? (is_array($body['menuPermissions']) ? json_encode(array_values(array_unique($body['menuPermissions']))) : null) 
        : null;
    
    $updates = [];
    $params = [];
    
    if ($fullName !== null) {
        $updates[] = "full_name = ?";
        $params[] = $fullName;
    }
    if ($role !== null) {
        $updates[] = "role = ?";
        $params[] = $role;
    }
    if (array_key_exists('menuPermissions', $body) && hasMenuPermissionsColumn($pdo)) {
        $updates[] = "menu_permissions = ?";
        $params[] = $menuPermissions;
    }
    if ($password) {
        $updates[] = "password_hash = ?";
        $params[] = password_hash($password, PASSWORD_DEFAULT);
    }
    if (array_key_exists('profilePhotoUrl', $body)) {
        $updates[] = "profile_photo = ?";
        $params[] = $profilePhoto;
    }
    
    if (count($updates) > 0) {
        $params[] = $id;
        $sql = "UPDATE portal_users SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }
    
    $stmt = $pdo->prepare("SELECT * FROM portal_users WHERE id = ?");
    $stmt->execute([$id]);
    
    echo json_encode(normalizeUser($stmt->fetch()));
}

function deleteUser($pdo, $id) {
    $stmt = $pdo->prepare("DELETE FROM portal_users WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(["message" => "User deleted."]);
}
