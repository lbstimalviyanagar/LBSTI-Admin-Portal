<?php
require 'config.php';

$queries = [
    "CREATE TABLE IF NOT EXISTS `staff_attendance` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `staff_id` BIGINT UNSIGNED NOT NULL,
        `date` DATE NOT NULL,
        `clock_in` DATETIME NOT NULL,
        `clock_out` DATETIME DEFAULT NULL,
        `total_hours` DECIMAL(5,2) DEFAULT 0.00,
        `status` ENUM('Present', 'Absent', 'Half Day', 'Leave') DEFAULT 'Present',
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        FOREIGN KEY (`staff_id`) REFERENCES `portal_users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",

    "CREATE TABLE IF NOT EXISTS `staff_tasks` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `assigned_to` BIGINT UNSIGNED NOT NULL,
        `assigned_by` BIGINT UNSIGNED NOT NULL,
        `title` VARCHAR(255) NOT NULL,
        `description` TEXT DEFAULT NULL,
        `status` ENUM('Pending', 'In Progress', 'Completed') DEFAULT 'Pending',
        `remarks` TEXT DEFAULT NULL,
        `due_date` DATE DEFAULT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        FOREIGN KEY (`assigned_to`) REFERENCES `portal_users`(`id`) ON DELETE CASCADE,
        FOREIGN KEY (`assigned_by`) REFERENCES `portal_users`(`id`) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;",

    "CREATE TABLE IF NOT EXISTS `institute_batches` (
        `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        `batch_time` VARCHAR(100) NOT NULL,
        `instructor_id` BIGINT UNSIGNED DEFAULT NULL,
        `course_name` VARCHAR(255) NOT NULL,
        `topic` VARCHAR(255) DEFAULT NULL,
        `student_count` INT DEFAULT 0,
        `status` ENUM('Upcoming', 'Ongoing', 'Completed') DEFAULT 'Upcoming',
        `date` DATE NOT NULL,
        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (`id`),
        FOREIGN KEY (`instructor_id`) REFERENCES `portal_users`(`id`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;"
];

foreach ($queries as $q) {
    try {
        $pdo->exec($q);
        echo "Executed query successfully.\n";
    } catch (PDOException $e) {
        echo "Error executing query: " . $e->getMessage() . "\n";
    }
}
echo "Setup complete.\n";
