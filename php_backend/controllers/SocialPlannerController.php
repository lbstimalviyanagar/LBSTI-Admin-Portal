<?php

date_default_timezone_set('Asia/Kolkata');

function ensureSocialPlannerTable($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `social_media_planner` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `title` VARCHAR(255) NOT NULL,
            `platform` VARCHAR(50) NOT NULL DEFAULT 'Instagram',
            `content_type` VARCHAR(50) NOT NULL DEFAULT 'Post',
            `scheduled_date` DATE NOT NULL,
            `scheduled_time` VARCHAR(20) DEFAULT '10:00 AM',
            `status` VARCHAR(50) NOT NULL DEFAULT 'Draft',
            `caption_text` LONGTEXT DEFAULT NULL,
            `hashtags` TEXT DEFAULT NULL,
            `media_url` LONGTEXT DEFAULT NULL,
            `assigned_to` VARCHAR(190) DEFAULT NULL,
            `notes` TEXT DEFAULT NULL,
            `created_by` VARCHAR(190) DEFAULT 'Admin',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_scheduled_date` (`scheduled_date`),
            KEY `idx_platform` (`platform`),
            KEY `idx_status` (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // Seed sample default posts if table is empty
        $count = $pdo->query("SELECT COUNT(*) FROM social_media_planner")->fetchColumn();
        if ($count == 0) {
            $samplePosts = [
                [
                    "New Batch Announcement: Full Stack & Python",
                    "Instagram",
                    "Reel",
                    date('Y-m-d', strtotime('+1 day')),
                    "11:00 AM",
                    "Scheduled",
                    "🚀 Launch your tech career with our new Full Stack Developer & Python batch starting this Monday at LBSTI Malviya Nagar!\n\n💡 Hands-on live projects\n💡 Placement assistance\n💡 1-on-1 mentorship\n\nDM us or call +91-9990352721 to reserve your seat!",
                    "#LBSTI #FullStackDeveloper #PythonProgramming #CodingInstitute #DelhiTech #LearnCoding",
                    "Admissions Team"
                ],
                [
                    "Student Achievement Spotlight: ADCA Certified",
                    "LinkedIn",
                    "Post",
                    date('Y-m-d', strtotime('+3 days')),
                    "02:00 PM",
                    "In Review",
                    "Congratulations to our student Aryan Sharma for completing the Advance Diploma in Computer Applications (ADCA) with top grades and securing an internship!\n\nAt LBSTI, we focus on industry-ready digital and computing skills.",
                    "#StudentSuccess #ADCA #CareerGrowth #SkillDevelopment #LBSTIMalviyaNagar",
                    "Academic Counselor"
                ],
                [
                    "Top 5 Excel Hacks Every Accountant Must Know",
                    "YouTube",
                    "Video",
                    date('Y-m-d', strtotime('+5 days')),
                    "05:00 PM",
                    "Draft",
                    "Watch these 5 essential Advance Excel & VBA tricks to automate your daily reports in minutes. Full tutorial covering VLOOKUP, XLOOKUP, Pivot Tables and conditional formatting.",
                    "#ExcelTutorial #AdvanceExcel #AccountingTips #TallyPrime #VBA #LBSTI",
                    "Faculty - Excel"
                ]
            ];

            $stmt = $pdo->prepare("INSERT INTO social_media_planner (title, platform, content_type, scheduled_date, scheduled_time, status, caption_text, hashtags, assigned_to, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'System')");
            foreach ($samplePosts as $sp) {
                try {
                    $stmt->execute($sp);
                } catch (Exception $e) {}
            }
        }
    } catch (Exception $e) {}
}

function getSocialPosts($pdo) {
    ensureSocialPlannerTable($pdo);
    try {
        $platform = $_GET['platform'] ?? null;
        $status = $_GET['status'] ?? null;
        $month = $_GET['month'] ?? null;
        $q = $_GET['q'] ?? null;

        $conditions = [];
        $params = [];

        if (!empty($platform) && strtolower($platform) !== 'all') {
            $conditions[] = "LOWER(TRIM(platform)) = LOWER(TRIM(?))";
            $params[] = $platform;
        }

        if (!empty($status) && strtolower($status) !== 'all') {
            $conditions[] = "LOWER(TRIM(status)) = LOWER(TRIM(?))";
            $params[] = $status;
        }

        if (!empty($month) && strtolower($month) !== 'all') {
            $conditions[] = "DATE_FORMAT(scheduled_date, '%Y-%m') = ?";
            $params[] = $month;
        }

        if (!empty($q)) {
            $like = "%" . trim($q) . "%";
            $conditions[] = "(title LIKE ? OR caption_text LIKE ? OR hashtags LIKE ? OR assigned_to LIKE ?)";
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
            $params[] = $like;
        }

        $whereClause = !empty($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";

        $stmt = $pdo->prepare("SELECT * FROM social_media_planner {$whereClause} ORDER BY scheduled_date ASC, id ASC");
        $stmt->execute($params);
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createSocialPost($pdo, $body, $user = null) {
    ensureSocialPlannerTable($pdo);
    $title = trim($body['title'] ?? '');
    $date = trim($body['scheduled_date'] ?? $body['scheduledDate'] ?? date('Y-m-d'));

    if (!$title) {
        http_response_code(400);
        echo json_encode(["message" => "Post title is required."]);
        return;
    }

    $platform = trim($body['platform'] ?? 'Instagram');
    $contentType = trim($body['content_type'] ?? $body['contentType'] ?? 'Post');
    $time = trim($body['scheduled_time'] ?? $body['scheduledTime'] ?? '10:00 AM');
    $status = trim($body['status'] ?? 'Draft');
    $caption = trim($body['caption_text'] ?? $body['captionText'] ?? '');
    $hashtags = trim($body['hashtags'] ?? '');
    $mediaUrl = trim($body['media_url'] ?? $body['mediaUrl'] ?? '');
    $assignedTo = trim($body['assigned_to'] ?? $body['assignedTo'] ?? '');
    $notes = trim($body['notes'] ?? '');
    $createdBy = !empty($user['name']) ? $user['name'] : (!empty($user['username']) ? $user['username'] : 'Admin');

    try {
        $stmt = $pdo->prepare("INSERT INTO social_media_planner 
            (title, platform, content_type, scheduled_date, scheduled_time, status, caption_text, hashtags, media_url, assigned_to, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$title, $platform, $contentType, $date, $time, $status, $caption, $hashtags, $mediaUrl, $assignedTo, $notes, $createdBy]);
        $id = $pdo->lastInsertId();

        $fetchStmt = $pdo->prepare("SELECT * FROM social_media_planner WHERE id = ?");
        $fetchStmt->execute([$id]);
        echo json_encode($fetchStmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function updateSocialPost($pdo, $id, $body) {
    ensureSocialPlannerTable($pdo);
    $id = (int)$id;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid post ID."]);
        return;
    }

    $fields = [];
    $params = [];

    if (isset($body['title'])) {
        $fields[] = "title = ?";
        $params[] = trim($body['title']);
    }
    if (isset($body['platform'])) {
        $fields[] = "platform = ?";
        $params[] = trim($body['platform']);
    }
    if (isset($body['content_type']) || isset($body['contentType'])) {
        $fields[] = "content_type = ?";
        $params[] = trim($body['content_type'] ?? $body['contentType']);
    }
    if (isset($body['scheduled_date']) || isset($body['scheduledDate'])) {
        $fields[] = "scheduled_date = ?";
        $params[] = trim($body['scheduled_date'] ?? $body['scheduledDate']);
    }
    if (isset($body['scheduled_time']) || isset($body['scheduledTime'])) {
        $fields[] = "scheduled_time = ?";
        $params[] = trim($body['scheduled_time'] ?? $body['scheduledTime']);
    }
    if (isset($body['status'])) {
        $fields[] = "status = ?";
        $params[] = trim($body['status']);
    }
    if (isset($body['caption_text']) || isset($body['captionText'])) {
        $fields[] = "caption_text = ?";
        $params[] = trim($body['caption_text'] ?? $body['captionText']);
    }
    if (isset($body['hashtags'])) {
        $fields[] = "hashtags = ?";
        $params[] = trim($body['hashtags']);
    }
    if (isset($body['media_url']) || isset($body['mediaUrl'])) {
        $fields[] = "media_url = ?";
        $params[] = trim($body['media_url'] ?? $body['mediaUrl']);
    }
    if (isset($body['assigned_to']) || isset($body['assignedTo'])) {
        $fields[] = "assigned_to = ?";
        $params[] = trim($body['assigned_to'] ?? $body['assignedTo']);
    }
    if (isset($body['notes'])) {
        $fields[] = "notes = ?";
        $params[] = trim($body['notes']);
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["message" => "No fields to update."]);
        return;
    }

    $params[] = $id;
    try {
        $sql = "UPDATE social_media_planner SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $fetchStmt = $pdo->prepare("SELECT * FROM social_media_planner WHERE id = ?");
        $fetchStmt->execute([$id]);
        echo json_encode($fetchStmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function deleteSocialPost($pdo, $id) {
    ensureSocialPlannerTable($pdo);
    $id = (int)$id;
    try {
        $pdo->prepare("DELETE FROM social_media_planner WHERE id = ?")->execute([$id]);
        echo json_encode(["message" => "Post deleted."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

