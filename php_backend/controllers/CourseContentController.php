<?php

function ensureCourseContentTables($pdo) {
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `courses` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `name` VARCHAR(190) NOT NULL,
            `code` VARCHAR(50) DEFAULT NULL,
            `duration` VARCHAR(100) DEFAULT NULL,
            `category` VARCHAR(100) DEFAULT 'General',
            `description` TEXT DEFAULT NULL,
            `is_active` TINYINT(1) DEFAULT 1,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            UNIQUE KEY `uq_course_name` (`name`),
            KEY `idx_active` (`is_active`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `course_content` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `course_id` BIGINT UNSIGNED NOT NULL,
            `module_title` VARCHAR(255) NOT NULL,
            `topic_title` VARCHAR(255) DEFAULT NULL,
            `content_order` INT DEFAULT 0,
            `description` TEXT DEFAULT NULL,
            `learning_objectives` TEXT DEFAULT NULL,
            `created_by` VARCHAR(190) DEFAULT 'Admin',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_course_module` (`course_id`, `content_order`),
            CONSTRAINT `fk_content_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `course_syllabus` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `course_id` BIGINT UNSIGNED NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `version` VARCHAR(50) DEFAULT '1.0',
            `summary` TEXT DEFAULT NULL,
            `file_name` VARCHAR(255) DEFAULT NULL,
            `file_url` LONGTEXT DEFAULT NULL,
            `file_size` INT DEFAULT NULL,
            `file_type` VARCHAR(100) DEFAULT NULL,
            `created_by` VARCHAR(190) DEFAULT 'Admin',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_syllabus_course` (`course_id`),
            CONSTRAINT `fk_syllabus_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        $pdo->exec("CREATE TABLE IF NOT EXISTS `course_notes` (
            `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            `course_id` BIGINT UNSIGNED NOT NULL,
            `title` VARCHAR(255) NOT NULL,
            `module_name` VARCHAR(255) DEFAULT NULL,
            `topic` VARCHAR(255) DEFAULT NULL,
            `notes_content` LONGTEXT DEFAULT NULL,
            `file_name` VARCHAR(255) DEFAULT NULL,
            `file_url` LONGTEXT DEFAULT NULL,
            `file_size` INT DEFAULT NULL,
            `file_type` VARCHAR(100) DEFAULT NULL,
            `created_by` VARCHAR(190) DEFAULT 'Admin',
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (`id`),
            KEY `idx_notes_course` (`course_id`),
            CONSTRAINT `fk_notes_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // Seed courses from existing courses if empty
        $count = $pdo->query("SELECT COUNT(*) FROM courses")->fetchColumn();
        if ($count == 0) {
            seedDefaultCourses($pdo);
        }
    } catch (Exception $e) {}
}

function seedDefaultCourses($pdo) {
    $seedCourses = [
        ["ADCA (12 Months)", "ADCA", "12 Months", "Diploma", "Advance Diploma in Computer Applications"],
        ["DIT (12 Months)", "DIT", "12 Months", "Diploma", "Diploma in Information Technology"],
        ["CTT (18 Months)", "CTT", "18 Months", "Certificate", "Computer Teacher Training"],
        ["NPTC (24 Months)", "NPTC", "24 Months", "Certificate", "Nursery Primary Teacher Certificate"],
        ["NTC (12 Months)", "NTC", "12 Months", "Certificate", "Nursery Teacher Certificate"],
        ["PTC (12 Months)", "PTC", "12 Months", "Certificate", "Primary Teacher Certificate"],
        ["DABC (12 Months)", "DABC", "12 Months", "Diploma", "Diploma in Advanced Business Computing"],
        ["DEA (12 Months)", "DEA", "12 Months", "Diploma", "Diploma in Electronic Accounting"],
        ["DMM (12 Months)", "DMM", "12 Months", "Diploma", "Diploma in Multimedia & Animation"],
        ["DWD (12 Months)", "DWD", "12 Months", "Diploma", "Diploma in Web Development"],
        ["DACS (12 Months)", "DACS", "12 Months", "Diploma", "Diploma in Advanced Computer Science"],
        ["Full Stack Developer (8 Months)", "FSD", "8 Months", "Development", "Complete Full Stack Web Development"],
        ["UI/UX Design (8 Months)", "UIUX", "8 Months", "Design", "User Interface and User Experience Design"],
        ["DBC (6 Months)", "DBC", "6 Months", "Diploma", "Diploma in Basic Computing"],
        ["DASD (6 Months)", "DASD", "6 Months", "Diploma", "Diploma in Advanced Software Development"],
        ["DADA (6 Months)", "DADA", "6 Months", "Diploma", "Diploma in Advanced Data Analytics"],
        ["DDM (6 Months)", "DDM", "6 Months", "Diploma", "Diploma in Digital Marketing"],
        ["DAFA (6 Months)", "DAFA", "6 Months", "Diploma", "Diploma in Advanced Financial Accounting"],
        ["DGD (6 Months)", "DGD", "6 Months", "Diploma", "Diploma in Graphic Design"],
        ["DADTP (6 Months)", "DADTP", "6 Months", "Diploma", "Diploma in Desktop Publishing"],
        ["CMM (6 Months)", "CMM", "6 Months", "Certificate", "Certificate in Multimedia"],
        ["CWD (6 Months)", "CWD", "6 Months", "Certificate", "Certificate in Web Design"],
        ["DOM (6 Months)", "DOM", "6 Months", "Certificate", "Certificate in Office Management"],
        ["CACS (6 Months)", "CACS", "6 Months", "Certificate", "Certificate in Advanced Computer Skills"],
        ["English Speaking Course (6 Months)", "ESC", "6 Months", "Language", "Spoken English and Personality Development"],
        ["Frontend Developer (4 Months)", "FED", "4 Months", "Development", "HTML, CSS, JavaScript, React"],
        ["Backend Developer (4 Months)", "BED", "4 Months", "Development", "Node.js, Express, Python, Databases"],
        ["CCO (3 Months)", "CCO", "3 Months", "Certificate", "Certificate in Computer Operations"],
        ["Beautician (1/3 Months)", "BEAUT", "3 Months", "Vocational", "Professional Beautician & Cosmetology"],
        ["MS-Word (1 Month)", "MSW", "1 Month", "Short Term", "Microsoft Word Mastery"],
        ["Advance Excel (2 Months)", "EXCEL", "2 Months", "Short Term", "Formulas, Macros, Dashboards & Pivot Tables"],
        ["VBA (2 Months)", "VBA", "2 Months", "Short Term", "Visual Basic for Excel Automation"],
        ["C Language (1 Month)", "CLANG", "1 Month", "Programming", "C Programming Fundamentals"],
        ["C++ Language (1 Month)", "CPP", "1 Month", "Programming", "C++ Object Oriented Programming"],
        ["Visual Basic (1 Month)", "VB", "1 Month", "Programming", "Visual Basic Development"],
        ["Tally 9.0 with GST (2 Months)", "TALLY9", "2 Months", "Accounting", "Tally 9.0 Accounting & GST Filing"],
        ["Tally Prime (2 Months)", "TPRIME", "2 Months", "Accounting", "Tally Prime ERP & Taxation"],
        ["GST (3 Months)", "GST", "3 Months", "Accounting", "GST Laws, Filing & Taxation Practice"],
        ["Java Core (1 Month)", "JAVAC", "1 Month", "Programming", "Core Java Programming"],
        ["Java Advance / J2EE (2 Months)", "JAVAADV", "2 Months", "Programming", "Advanced Java & Spring"],
        ["HTML / DHTML (45 Days)", "HTML", "45 Days", "Web", "Web Page Authoring"],
        ["JavaScript (1 Month)", "JS", "1 Month", "Web", "Modern JavaScript ES6+"],
        ["Illustrator (1 Month)", "AI", "1 Month", "Design", "Adobe Illustrator Vector Graphics"],
        ["InDesign (1 Month)", "ID", "1 Month", "Design", "Adobe InDesign Layouts & Publishing"],
        ["CorelDraw (1 Month)", "CD", "1 Month", "Design", "CorelDraw Design & Printing"],
        ["Photoshop (1 Month)", "PS", "1 Month", "Design", "Adobe Photoshop Image Editing"],
        ["SQL (1 Month)", "SQL", "1 Month", "Database", "Relational Database & SQL Queries"],
        ["Python (2 Months)", "PY", "2 Months", "Programming", "Python Programming & Applications"],
        ["Premiere Pro (1 Month)", "PR", "1 Month", "Media", "Video Editing with Premiere Pro"],
        ["After Effects (1 Month)", "AE", "1 Month", "Media", "Motion Graphics with After Effects"],
        ["Quark Express (1 Month)", "QE", "1 Month", "Publishing", "Quark Express Page Layouts"],
        ["Busy with GST (1 Month)", "BUSY", "1 Month", "Accounting", "Busy Accounting Software"],
        ["Cam CAD (1 Month)", "CAD", "1 Month", "Design", "Computer Aided Design"],
        ["3D Max (2 Months)", "3DMAX", "2 Months", "Media", "3D Modeling and Animation"],
        ["MERN Stack Development (6 Months)", "MERN", "6 Months", "Development", "MongoDB, Express, React, Node.js"],
        ["Java Full Stack Development (6 Months)", "JFS", "6 Months", "Development", "Java, Spring Boot, React, SQL"],
        ["Python Full Stack Development (6 Months)", "PFS", "6 Months", "Development", "Python, Django, React, Databases"],
        ["Web Development (4 Months)", "WEBDEV", "4 Months", "Development", "Full Responsive Web Development"],
        ["React JS (2 Months)", "REACT", "2 Months", "Development", "React.js Single Page Applications"],
        ["Node JS (2 Months)", "NODE", "2 Months", "Development", "Backend Node.js API Architecture"],
        ["Data Structures & Algorithms (2 Months)", "DSA", "2 Months", "Computer Science", "DSA for Technical Interviews"],
        ["AI & Machine Learning (3 Months)", "AIML", "3 Months", "Advanced Tech", "Machine Learning with Python"],
        ["Data Science (4 Months)", "DS", "4 Months", "Advanced Tech", "Data Analysis, Pandas, Matplotlib & ML"],
        ["SQL & Database (1 Month)", "DB", "1 Month", "Database", "Database Design & Queries"],
        ["DevOps (2 Months)", "DEVOPS", "2 Months", "Cloud", "Git, Docker, CI/CD & Cloud Basics"],
        ["Cyber Security (3 Months)", "CYBER", "3 Months", "Security", "Network & Cyber Security Fundamentals"]
    ];

    $stmt = $pdo->prepare("INSERT IGNORE INTO courses (name, code, duration, category, description, is_active) VALUES (?, ?, ?, ?, ?, 1)");
    foreach ($seedCourses as $sc) {
        try {
            $stmt->execute($sc);
        } catch (Exception $e) {}
    }

    // Also pull distinct courses from enrollments and enquiries if any
    try {
        $extraStmt = $pdo->query("SELECT DISTINCT course FROM enrollments WHERE course IS NOT NULL AND TRIM(course) != ''");
        while ($c = $extraStmt->fetchColumn()) {
            $c = trim($c);
            if ($c) {
                try {
                    $stmt->execute([$c, strtoupper(substr($c, 0, 6)), 'Standard', 'General', $c]);
                } catch (Exception $e2) {}
            }
        }
    } catch (Exception $e) {}
}

function getCourses($pdo) {
    ensureCourseContentTables($pdo);
    try {
        $all = isset($_GET['all']) && $_GET['all'] === 'true';
        $sql = "SELECT c.*,
                       (SELECT COUNT(*) FROM course_content cc WHERE cc.course_id = c.id) as modules_count,
                       (SELECT COUNT(*) FROM course_syllabus cs WHERE cs.course_id = c.id) as syllabus_count,
                       (SELECT COUNT(*) FROM course_notes cn WHERE cn.course_id = c.id) as notes_count
                FROM courses c ";
        if (!$all) {
            $sql .= "WHERE c.is_active = 1 ";
        }
        $sql .= "ORDER BY c.name ASC";

        $stmt = $pdo->query($sql);
        $courses = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($courses);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createCourse($pdo, $body, $user = null) {
    ensureCourseContentTables($pdo);
    $name = trim($body['name'] ?? '');
    if (!$name) {
        http_response_code(400);
        echo json_encode(["message" => "Course name is required."]);
        return;
    }

    $code = trim($body['code'] ?? '') ?: strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $name), 0, 8));
    $duration = trim($body['duration'] ?? '1 Month');
    $category = trim($body['category'] ?? 'General');
    $description = trim($body['description'] ?? '');

    try {
        $stmt = $pdo->prepare("INSERT INTO courses (name, code, duration, category, description, is_active) VALUES (?, ?, ?, ?, ?, 1)");
        $stmt->execute([$name, $code, $duration, $category, $description]);
        $id = $pdo->lastInsertId();

        $fetchStmt = $pdo->prepare("SELECT * FROM courses WHERE id = ?");
        $fetchStmt->execute([$id]);
        echo json_encode($fetchStmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(409);
        echo json_encode(["message" => "A course with this name already exists."]);
    }
}

function updateCourse($pdo, $id, $body) {
    ensureCourseContentTables($pdo);
    $id = (int)$id;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid course ID."]);
        return;
    }

    $fields = [];
    $params = [];

    if (isset($body['name'])) {
        $fields[] = "name = ?";
        $params[] = trim($body['name']);
    }
    if (isset($body['code'])) {
        $fields[] = "code = ?";
        $params[] = trim($body['code']);
    }
    if (isset($body['duration'])) {
        $fields[] = "duration = ?";
        $params[] = trim($body['duration']);
    }
    if (isset($body['category'])) {
        $fields[] = "category = ?";
        $params[] = trim($body['category']);
    }
    if (isset($body['description'])) {
        $fields[] = "description = ?";
        $params[] = trim($body['description']);
    }
    if (isset($body['is_active']) || isset($body['isActive'])) {
        $fields[] = "is_active = ?";
        $params[] = (!empty($body['is_active']) || !empty($body['isActive'])) ? 1 : 0;
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["message" => "No fields to update."]);
        return;
    }

    $params[] = $id;
    try {
        $sql = "UPDATE courses SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $fetchStmt = $pdo->prepare("SELECT * FROM courses WHERE id = ?");
        $fetchStmt->execute([$id]);
        echo json_encode($fetchStmt->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function deleteCourse($pdo, $id) {
    ensureCourseContentTables($pdo);
    $id = (int)$id;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid course ID."]);
        return;
    }

    // Safety: check if referenced in enquiries or enrollments. If so, soft archive (is_active = 0)
    try {
        $nameStmt = $pdo->prepare("SELECT name FROM courses WHERE id = ?");
        $nameStmt->execute([$id]);
        $cName = $nameStmt->fetchColumn();

        if ($cName) {
            $enqCheck = $pdo->prepare("SELECT COUNT(*) FROM enquiries WHERE course = ?");
            $enqCheck->execute([$cName]);
            $enqCount = $enqCheck->fetchColumn();

            $enrCheck = $pdo->prepare("SELECT COUNT(*) FROM enrollments WHERE course = ?");
            $enrCheck->execute([$cName]);
            $enrCount = $enrCheck->fetchColumn();

            if ($enqCount > 0 || $enrCount > 0) {
                // Soft archive to protect foreign records
                $pdo->prepare("UPDATE courses SET is_active = 0 WHERE id = ?")->execute([$id]);
                echo json_encode(["message" => "Course has existing inquiries or admissions and was safely archived rather than deleted.", "archived" => true]);
                return;
            }
        }

        $pdo->prepare("DELETE FROM courses WHERE id = ?")->execute([$id]);
        echo json_encode(["message" => "Course deleted successfully.", "deleted" => true]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

// ----------------- COURSE CONTENT (MODULES & TOPICS) -----------------
function getCourseContent($pdo) {
    ensureCourseContentTables($pdo);
    $courseId = isset($_GET['course_id']) ? (int)$_GET['course_id'] : null;
    try {
        if ($courseId) {
            $stmt = $pdo->prepare("SELECT cc.*, c.name as course_name FROM course_content cc JOIN courses c ON c.id = cc.course_id WHERE cc.course_id = ? ORDER BY cc.content_order ASC, cc.id ASC");
            $stmt->execute([$courseId]);
        } else {
            $stmt = $pdo->query("SELECT cc.*, c.name as course_name FROM course_content cc JOIN courses c ON c.id = cc.course_id ORDER BY c.name ASC, cc.content_order ASC");
        }
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createCourseContent($pdo, $body, $user = null) {
    ensureCourseContentTables($pdo);
    $courseId = (int)($body['course_id'] ?? $body['courseId'] ?? 0);
    $moduleTitle = trim($body['module_title'] ?? $body['moduleTitle'] ?? '');

    if (!$courseId || !$moduleTitle) {
        http_response_code(400);
        echo json_encode(["message" => "Course ID and Module Title are required."]);
        return;
    }

    $topicTitle = trim($body['topic_title'] ?? $body['topicTitle'] ?? '');
    $order = (int)($body['content_order'] ?? $body['contentOrder'] ?? 0);
    $desc = trim($body['description'] ?? '');
    $obj = trim($body['learning_objectives'] ?? $body['learningObjectives'] ?? '');
    $createdBy = !empty($user['name']) ? $user['name'] : (!empty($user['username']) ? $user['username'] : 'Admin');

    try {
        $stmt = $pdo->prepare("INSERT INTO course_content (course_id, module_title, topic_title, content_order, description, learning_objectives, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$courseId, $moduleTitle, $topicTitle, $order, $desc, $obj, $createdBy]);
        $id = $pdo->lastInsertId();

        $f = $pdo->prepare("SELECT * FROM course_content WHERE id = ?");
        $f->execute([$id]);
        echo json_encode($f->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function updateCourseContent($pdo, $id, $body) {
    ensureCourseContentTables($pdo);
    $id = (int)$id;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid content ID."]);
        return;
    }

    $fields = [];
    $params = [];
    if (isset($body['module_title']) || isset($body['moduleTitle'])) {
        $fields[] = "module_title = ?";
        $params[] = trim($body['module_title'] ?? $body['moduleTitle']);
    }
    if (isset($body['topic_title']) || isset($body['topicTitle'])) {
        $fields[] = "topic_title = ?";
        $params[] = trim($body['topic_title'] ?? $body['topicTitle']);
    }
    if (isset($body['content_order']) || isset($body['contentOrder'])) {
        $fields[] = "content_order = ?";
        $params[] = (int)($body['content_order'] ?? $body['contentOrder']);
    }
    if (isset($body['description'])) {
        $fields[] = "description = ?";
        $params[] = trim($body['description']);
    }
    if (isset($body['learning_objectives']) || isset($body['learningObjectives'])) {
        $fields[] = "learning_objectives = ?";
        $params[] = trim($body['learning_objectives'] ?? $body['learningObjectives']);
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["message" => "No fields to update."]);
        return;
    }

    $params[] = $id;
    try {
        $sql = "UPDATE course_content SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $f = $pdo->prepare("SELECT * FROM course_content WHERE id = ?");
        $f->execute([$id]);
        echo json_encode($f->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function deleteCourseContent($pdo, $id) {
    ensureCourseContentTables($pdo);
    $id = (int)$id;
    try {
        $pdo->prepare("DELETE FROM course_content WHERE id = ?")->execute([$id]);
        echo json_encode(["message" => "Course content deleted."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

// ----------------- SYLLABUS MANAGEMENT -----------------
function getCourseSyllabus($pdo) {
    ensureCourseContentTables($pdo);
    $courseId = isset($_GET['course_id']) ? (int)$_GET['course_id'] : null;
    try {
        if ($courseId) {
            $stmt = $pdo->prepare("SELECT cs.*, c.name as course_name FROM course_syllabus cs JOIN courses c ON c.id = cs.course_id WHERE cs.course_id = ? ORDER BY cs.id DESC");
            $stmt->execute([$courseId]);
        } else {
            $stmt = $pdo->query("SELECT cs.*, c.name as course_name FROM course_syllabus cs JOIN courses c ON c.id = cs.course_id ORDER BY c.name ASC, cs.id DESC");
        }
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createCourseSyllabus($pdo, $body, $user = null) {
    ensureCourseContentTables($pdo);
    $courseId = (int)($body['course_id'] ?? $body['courseId'] ?? 0);
    $title = trim($body['title'] ?? '');

    if (!$courseId || !$title) {
        http_response_code(400);
        echo json_encode(["message" => "Course ID and Syllabus Title are required."]);
        return;
    }

    $version = trim($body['version'] ?? '1.0');
    $summary = trim($body['summary'] ?? '');
    $fileName = trim($body['file_name'] ?? $body['fileName'] ?? '');
    $fileUrl = trim($body['file_url'] ?? $body['fileUrl'] ?? '');
    $fileSize = (int)($body['file_size'] ?? $body['fileSize'] ?? 0);
    $fileType = trim($body['file_type'] ?? $body['fileType'] ?? '');

    // Validate size limit (max 10MB)
    if ($fileSize > 10 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(["message" => "File size exceeds permitted 10MB limit."]);
        return;
    }

    $createdBy = !empty($user['name']) ? $user['name'] : (!empty($user['username']) ? $user['username'] : 'Admin');

    try {
        $stmt = $pdo->prepare("INSERT INTO course_syllabus (course_id, title, version, summary, file_name, file_url, file_size, file_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$courseId, $title, $version, $summary, $fileName, $fileUrl, $fileSize, $fileType, $createdBy]);
        $id = $pdo->lastInsertId();

        $f = $pdo->prepare("SELECT cs.*, c.name as course_name FROM course_syllabus cs JOIN courses c ON c.id = cs.course_id WHERE cs.id = ?");
        $f->execute([$id]);
        echo json_encode($f->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function updateCourseSyllabus($pdo, $id, $body) {
    ensureCourseContentTables($pdo);
    $id = (int)$id;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid syllabus ID."]);
        return;
    }

    $fields = [];
    $params = [];
    if (isset($body['title'])) {
        $fields[] = "title = ?";
        $params[] = trim($body['title']);
    }
    if (isset($body['version'])) {
        $fields[] = "version = ?";
        $params[] = trim($body['version']);
    }
    if (isset($body['summary'])) {
        $fields[] = "summary = ?";
        $params[] = trim($body['summary']);
    }
    if (isset($body['file_name']) || isset($body['fileName'])) {
        $fields[] = "file_name = ?";
        $params[] = trim($body['file_name'] ?? $body['fileName']);
    }
    if (isset($body['file_url']) || isset($body['fileUrl'])) {
        $fields[] = "file_url = ?";
        $params[] = trim($body['file_url'] ?? $body['fileUrl']);
    }
    if (isset($body['file_size']) || isset($body['fileSize'])) {
        $fields[] = "file_size = ?";
        $params[] = (int)($body['file_size'] ?? $body['fileSize']);
    }
    if (isset($body['file_type']) || isset($body['fileType'])) {
        $fields[] = "file_type = ?";
        $params[] = trim($body['file_type'] ?? $body['fileType']);
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["message" => "No fields to update."]);
        return;
    }

    $params[] = $id;
    try {
        $sql = "UPDATE course_syllabus SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $f = $pdo->prepare("SELECT cs.*, c.name as course_name FROM course_syllabus cs JOIN courses c ON c.id = cs.course_id WHERE cs.id = ?");
        $f->execute([$id]);
        echo json_encode($f->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function deleteCourseSyllabus($pdo, $id) {
    ensureCourseContentTables($pdo);
    $id = (int)$id;
    try {
        $pdo->prepare("DELETE FROM course_syllabus WHERE id = ?")->execute([$id]);
        echo json_encode(["message" => "Syllabus deleted."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

// ----------------- NOTES MANAGEMENT -----------------
function getCourseNotes($pdo) {
    ensureCourseContentTables($pdo);
    $courseId = isset($_GET['course_id']) ? (int)$_GET['course_id'] : null;
    try {
        if ($courseId) {
            $stmt = $pdo->prepare("SELECT cn.*, c.name as course_name FROM course_notes cn JOIN courses c ON c.id = cn.course_id WHERE cn.course_id = ? ORDER BY cn.id DESC");
            $stmt->execute([$courseId]);
        } else {
            $stmt = $pdo->query("SELECT cn.*, c.name as course_name FROM course_notes cn JOIN courses c ON c.id = cn.course_id ORDER BY c.name ASC, cn.id DESC");
        }
        echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function createCourseNotes($pdo, $body, $user = null) {
    ensureCourseContentTables($pdo);
    $courseId = (int)($body['course_id'] ?? $body['courseId'] ?? 0);
    $title = trim($body['title'] ?? '');

    if (!$courseId || !$title) {
        http_response_code(400);
        echo json_encode(["message" => "Course ID and Note Title are required."]);
        return;
    }

    $moduleName = trim($body['module_name'] ?? $body['moduleName'] ?? '');
    $topic = trim($body['topic'] ?? '');
    $notesContent = trim($body['notes_content'] ?? $body['notesContent'] ?? '');
    $fileName = trim($body['file_name'] ?? $body['fileName'] ?? '');
    $fileUrl = trim($body['file_url'] ?? $body['fileUrl'] ?? '');
    $fileSize = (int)($body['file_size'] ?? $body['fileSize'] ?? 0);
    $fileType = trim($body['file_type'] ?? $body['fileType'] ?? '');

    $createdBy = !empty($user['name']) ? $user['name'] : (!empty($user['username']) ? $user['username'] : 'Admin');

    try {
        $stmt = $pdo->prepare("INSERT INTO course_notes (course_id, title, module_name, topic, notes_content, file_name, file_url, file_size, file_type, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$courseId, $title, $moduleName, $topic, $notesContent, $fileName, $fileUrl, $fileSize, $fileType, $createdBy]);
        $id = $pdo->lastInsertId();

        $f = $pdo->prepare("SELECT cn.*, c.name as course_name FROM course_notes cn JOIN courses c ON c.id = cn.course_id WHERE cn.id = ?");
        $f->execute([$id]);
        echo json_encode($f->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function updateCourseNotes($pdo, $id, $body) {
    ensureCourseContentTables($pdo);
    $id = (int)$id;
    if (!$id) {
        http_response_code(400);
        echo json_encode(["message" => "Invalid note ID."]);
        return;
    }

    $fields = [];
    $params = [];
    if (isset($body['title'])) {
        $fields[] = "title = ?";
        $params[] = trim($body['title']);
    }
    if (isset($body['module_name']) || isset($body['moduleName'])) {
        $fields[] = "module_name = ?";
        $params[] = trim($body['module_name'] ?? $body['moduleName']);
    }
    if (isset($body['topic'])) {
        $fields[] = "topic = ?";
        $params[] = trim($body['topic']);
    }
    if (isset($body['notes_content']) || isset($body['notesContent'])) {
        $fields[] = "notes_content = ?";
        $params[] = trim($body['notes_content'] ?? $body['notesContent']);
    }
    if (isset($body['file_name']) || isset($body['fileName'])) {
        $fields[] = "file_name = ?";
        $params[] = trim($body['file_name'] ?? $body['fileName']);
    }
    if (isset($body['file_url']) || isset($body['fileUrl'])) {
        $fields[] = "file_url = ?";
        $params[] = trim($body['file_url'] ?? $body['fileUrl']);
    }
    if (isset($body['file_size']) || isset($body['fileSize'])) {
        $fields[] = "file_size = ?";
        $params[] = (int)($body['file_size'] ?? $body['fileSize']);
    }
    if (isset($body['file_type']) || isset($body['fileType'])) {
        $fields[] = "file_type = ?";
        $params[] = trim($body['file_type'] ?? $body['fileType']);
    }

    if (empty($fields)) {
        http_response_code(400);
        echo json_encode(["message" => "No fields to update."]);
        return;
    }

    $params[] = $id;
    try {
        $sql = "UPDATE course_notes SET " . implode(", ", $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        $f = $pdo->prepare("SELECT cn.*, c.name as course_name FROM course_notes cn JOIN courses c ON c.id = cn.course_id WHERE cn.id = ?");
        $f->execute([$id]);
        echo json_encode($f->fetch(PDO::FETCH_ASSOC));
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

function deleteCourseNotes($pdo, $id) {
    ensureCourseContentTables($pdo);
    $id = (int)$id;
    try {
        $pdo->prepare("DELETE FROM course_notes WHERE id = ?")->execute([$id]);
        echo json_encode(["message" => "Note deleted."]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["message" => "Database error: " . $e->getMessage()]);
    }
}

