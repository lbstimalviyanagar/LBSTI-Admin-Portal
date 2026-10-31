-- LBSTIMN Admin Portal schema for the existing Hostinger database.
-- This script creates structure only; it inserts no accounts, students, enquiries, or payments.

CREATE TABLE IF NOT EXISTS `enquiries` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  `phone` VARCHAR(40) NOT NULL,
  `email` VARCHAR(254) DEFAULT NULL,
  `city` VARCHAR(190) DEFAULT NULL,
  `course` VARCHAR(190) DEFAULT NULL,
  `batch` VARCHAR(120) DEFAULT NULL,
  `source` VARCHAR(120) DEFAULT NULL,
  `status` VARCHAR(48) NOT NULL DEFAULT 'New',
  `assigned_to` VARCHAR(190) DEFAULT NULL,
  `follow_up_date` DATE DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_enquiries_created_at` (`created_at`),
  KEY `idx_enquiries_status_created` (`status`, `created_at`),
  KEY `idx_enquiries_assigned_to` (`assigned_to`),
  KEY `idx_enquiries_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `portal_users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(100) NOT NULL,
  `full_name` VARCHAR(190) NOT NULL,
  `password_salt` CHAR(32) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `role` ENUM('admin', 'counselor', 'user') NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_portal_users_username` (`username`),
  KEY `idx_portal_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `remarks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `enquiry_id` BIGINT UNSIGNED NOT NULL,
  `text` TEXT NOT NULL,
  `author` VARCHAR(190) NOT NULL DEFAULT 'Admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_remarks_enquiry_created` (`enquiry_id`, `created_at`, `id`),
  CONSTRAINT `fk_remarks_enquiry`
    FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `fees` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `enquiry_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `total_fee` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_date` DATE DEFAULT NULL,
  `mode` VARCHAR(40) NOT NULL DEFAULT 'Cash',
  `notes` TEXT DEFAULT NULL,
  `receipt_details` LONGTEXT DEFAULT NULL,
  `received_by` VARCHAR(190) NOT NULL DEFAULT 'Admin',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fees_enquiry` (`enquiry_id`),
  KEY `idx_fees_payment_date` (`payment_date`, `id`),
  KEY `idx_fees_received_by` (`received_by`),
  CONSTRAINT `fk_fees_enquiry`
    FOREIGN KEY (`enquiry_id`) REFERENCES `enquiries` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `fees` ADD COLUMN IF NOT EXISTS `receipt_details` LONGTEXT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS `receipts` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_id` BIGINT UNSIGNED NOT NULL,
  `receipt_number` VARCHAR(64) NOT NULL,
  `issued_by` VARCHAR(190) NOT NULL,
  `issued_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_receipts_payment` (`payment_id`),
  UNIQUE KEY `uq_receipts_number` (`receipt_number`),
  CONSTRAINT `fk_receipts_payment`
    FOREIGN KEY (`payment_id`) REFERENCES `fees` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Students are confirmed/enrolled enquiry records in this portal, not a second copy.
CREATE OR REPLACE VIEW `students` AS
SELECT
  `id`, `name`, `phone`, `email`, `city`, `course`, `batch`, `assigned_to`,
  `status`, `created_at`, `updated_at`
FROM `enquiries`
WHERE LOWER(`status`) IN ('confirmed', 'enrolled', 'admitted');

-- Module 1: Staff Attendance
CREATE TABLE IF NOT EXISTS `staff_attendance` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module 2: Staff & Student Task Management with Deadline Tracking & Notifications
CREATE TABLE IF NOT EXISTS `staff_tasks` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `assigned_to` BIGINT UNSIGNED DEFAULT 0,
  `assigned_by` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Pending',
  `remarks` TEXT DEFAULT NULL,
  `due_date` DATETIME DEFAULT NULL,
  `assignee_type` VARCHAR(20) DEFAULT 'user',
  `assignee_name` VARCHAR(255) DEFAULT NULL,
  `assignee_email` VARCHAR(255) DEFAULT NULL,
  `assignee_phone` VARCHAR(50) DEFAULT NULL,
  `assignee_student_id` VARCHAR(50) DEFAULT NULL,
  `approaching_alert_sent` TINYINT(1) DEFAULT 0,
  `overdue_alert_sent` TINYINT(1) DEFAULT 0,
  `submitted_at` DATETIME DEFAULT NULL,
  `submission_notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`assigned_by`) REFERENCES `portal_users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module 2b: Automated Task Deadline Notifications Log
CREATE TABLE IF NOT EXISTS `task_notifications` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `task_id` BIGINT UNSIGNED NOT NULL,
  `recipient_name` VARCHAR(255) DEFAULT NULL,
  `recipient_email` VARCHAR(255) DEFAULT NULL,
  `recipient_phone` VARCHAR(50) DEFAULT NULL,
  `alert_type` ENUM('approaching', 'overdue', 'assigned', 'submitted') NOT NULL,
  `channel` ENUM('in_app', 'email', 'whatsapp') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `message` TEXT NOT NULL,
  `status` ENUM('sent', 'failed', 'logged') DEFAULT 'sent',
  `response_payload` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_task` (`task_id`),
  INDEX `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module 3: Daily Batch Management
CREATE TABLE IF NOT EXISTS `institute_batches` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- Module 4: Course Content & Catalog Management
ALTER TABLE `enquiries` ADD COLUMN IF NOT EXISTS `inquiry_date` DATE DEFAULT NULL AFTER `assigned_to`;

CREATE TABLE IF NOT EXISTS `courses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(190) NOT NULL,
  `code` VARCHAR(50) DEFAULT NULL,
  `category` VARCHAR(100) DEFAULT 'General',
  `duration` VARCHAR(100) DEFAULT '3 Months',
  `description` TEXT DEFAULT NULL,
  `is_active` TINYINT(1) DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_courses_name` (`name`),
  KEY `idx_courses_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_content` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` BIGINT UNSIGNED NOT NULL,
  `module_no` INT DEFAULT 1,
  `title` VARCHAR(255) NOT NULL,
  `topic` VARCHAR(255) DEFAULT NULL,
  `content` TEXT DEFAULT NULL,
  `order_index` INT DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_content_course` (`course_id`),
  CONSTRAINT `fk_content_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_syllabus` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `version` VARCHAR(50) DEFAULT '1.0',
  `document_url` VARCHAR(500) DEFAULT NULL,
  `description` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_syllabus_course` (`course_id`),
  CONSTRAINT `fk_syllabus_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `course_notes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` BIGINT UNSIGNED NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `topic` VARCHAR(255) DEFAULT NULL,
  `content` TEXT DEFAULT NULL,
  `attachment_url` VARCHAR(500) DEFAULT NULL,
  `file_type` VARCHAR(50) DEFAULT 'pdf',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notes_course` (`course_id`),
  CONSTRAINT `fk_notes_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module 5: Student Daily Attendance Management
CREATE TABLE IF NOT EXISTS `student_attendance` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `student_id` BIGINT UNSIGNED NOT NULL,
  `student_name` VARCHAR(190) NOT NULL,
  `course_name` VARCHAR(190) DEFAULT NULL,
  `batch_time` VARCHAR(100) DEFAULT NULL,
  `date` DATE NOT NULL,
  `status` ENUM('Present', 'Absent', 'Leave') NOT NULL DEFAULT 'Present',
  `remarks` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_student_date_batch` (`student_id`, `date`, `batch_time`),
  KEY `idx_student_att_date` (`date`),
  KEY `idx_student_att_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Module 6: Social Media Marketing & Content Planner
CREATE TABLE IF NOT EXISTS `social_media_planner` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `platform` ENUM('Instagram', 'Facebook', 'YouTube', 'LinkedIn', 'X', 'Website', 'Other') NOT NULL DEFAULT 'Instagram',
  `caption` TEXT NOT NULL,
  `hashtags` TEXT DEFAULT NULL,
  `media_url` VARCHAR(500) DEFAULT NULL,
  `cta` VARCHAR(255) DEFAULT NULL,
  `scheduled_at` DATETIME DEFAULT NULL,
  `status` ENUM('Draft', 'Scheduled', 'Published', 'Archived') NOT NULL DEFAULT 'Draft',
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_social_scheduled` (`scheduled_at`),
  KEY `idx_social_platform_status` (`platform`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
