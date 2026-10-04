<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);
require "config.php";

$studentsCsv = <<<CSV

CSV;

$enrollmentsCsv = <<<CSV

CSV;

try {
    $pdo->query("CREATE TABLE IF NOT EXISTS students (
      id INT(11) PRIMARY KEY AUTO_INCREMENT,
      student_id VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      guardian_name VARCHAR(255),
      phone VARCHAR(50),
      email VARCHAR(255),
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");

    $pdo->query("CREATE TABLE IF NOT EXISTS enrollments (
      id INT(11) PRIMARY KEY AUTO_INCREMENT,
      enrollment_id VARCHAR(50) UNIQUE NOT NULL,
      student_id VARCHAR(50) NOT NULL,
      doa DATE,
      course VARCHAR(255),
      status VARCHAR(50) DEFAULT 'Active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;");
    
    $lines = explode("\n", trim($studentsCsv));
    $stmt = $pdo->prepare("INSERT INTO students (student_id, name, guardian_name, phone) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), guardian_name=VALUES(guardian_name), phone=VALUES(phone)");
    for ($i = 1; $i < count($lines); $i++) {
        $cols = str_getcsv($lines[$i]);
        if (count($cols) >= 4) {
            $stmt->execute([trim($cols[0]), trim($cols[1]), trim($cols[2]), trim($cols[3])]);
        }
    }
    
    $elines = explode("\n", trim($enrollmentsCsv));
    $estmt = $pdo->prepare("INSERT INTO enrollments (enrollment_id, student_id, doa, course, status) VALUES (?, ?, STR_TO_DATE(?, '%d-%b-%y'), ?, ?) ON DUPLICATE KEY UPDATE student_id=VALUES(student_id), doa=VALUES(doa), course=VALUES(course), status=VALUES(status)");
    for ($i = 1; $i < count($elines); $i++) {
        $cols = str_getcsv($elines[$i]);
        if (count($cols) >= 5) {
            $estmt->execute([trim($cols[0]), trim($cols[1]), trim($cols[2]), trim($cols[3]), trim($cols[4])]);
        }
    }
    
    echo "<h1>Import Successful!</h1><p>Students and Enrollments have been forcibly uploaded!</p>";
} catch (PDOException $e) {
    echo "<h1>Error</h1><p>" . $e->getMessage() . "</p>";
}
