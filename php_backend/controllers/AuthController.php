<?php
function login($pdo, $body, $secret) {
    $username = trim($body['username'] ?? $body['email'] ?? '');
    $password = $body['password'] ?? '';
    
    if (!$username || !$password) {
        http_response_code(400);
        die(json_encode(["message" => "Username and password required"]));
    }
    
    $stmt = $pdo->prepare("SELECT * FROM portal_users WHERE LOWER(username) = LOWER(?)");
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    
    if (!$user) {
        http_response_code(401);
        die(json_encode(["message" => "Incorrect username or password"]));
    }
    
    // PHP Native verification (fallback to scrypt isn't standard, we assume passwords will be hashed via password_hash)
    // For completely new DB, password_hash is perfect.
    if (!password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        die(json_encode(["message" => "Incorrect username or password"]));
    }
    
    $payload = [
        "sub" => $user['id'],
        "username" => $user['username'],
        "name" => $user['full_name'],
        "role" => $user['role']
    ];
    
    $token = JwtHandler::encode($payload, $secret);
    
    $permissions = [];
    if (!empty($user['menu_permissions'])) {
        $decoded = json_decode($user['menu_permissions'], true);
        if (is_array($decoded)) {
            $permissions = $decoded;
        }
    }
    
    echo json_encode([
        "ok" => true,
        "token" => $token,
        "user" => [
            "id" => $user['id'],
            "username" => $user['username'],
            "name" => $user['full_name'],
            "role" => $user['role'],
            "profilePhotoUrl" => $user['profile_photo'] ?? null,
            "menuPermissions" => $permissions
        ]
    ]);
}
