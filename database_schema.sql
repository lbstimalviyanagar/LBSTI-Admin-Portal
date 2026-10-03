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
