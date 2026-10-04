const fs = require("fs");
const logsDir = `C:/Users/Shail/.gemini/antigravity-ide/brain/81abcc27-4f79-4822-9b6e-9d6026c48890/.system_generated/logs`;
const logLines = fs.readFileSync(logsDir + "/transcript.jsonl", "utf8").split("\n");

let userMessage = "";
for (let i = logLines.length - 1; i >= 0; i--) {
  if (!logLines[i]) continue;
  try {
    const log = JSON.parse(logLines[i]);
    if (log.source === "USER_EXPLICIT" && log.type === "USER_INPUT") {
      userMessage = log.content;
      break;
    }
  } catch(e) {}
}

const lines = userMessage.split("\n");
let studentsCsv = [];
let enrollmentsCsv = [];
let mode = 0;

for (let line of lines) {
    if (line.includes("Student Id,Name,Guardian,Phone")) {
        mode = 1;
    } else if (line.includes("REG NO,STUDENT_ID,DOA,COURSE,STATUS")) {
        mode = 2;
    }
    
    if (mode === 1 && line.trim() && !line.includes("USER_REQUEST") && !line.includes("ADDITIONAL_METADATA")) {
        studentsCsv.push(line.trim());
    } else if (mode === 2 && line.trim() && !line.includes("USER_REQUEST") && !line.includes("ADDITIONAL_METADATA")) {
        enrollmentsCsv.push(line.trim());
    }
}

while (enrollmentsCsv.length > 0 && !enrollmentsCsv[enrollmentsCsv.length - 1].includes(",")) {
    enrollmentsCsv.pop();
}

const phpCode = `<?php
error_reporting(E_ALL);
ini_set("display_errors", 1);
require "config.php";

$studentsCsv = <<<CSV
${studentsCsv.join("\n")}
CSV;

$enrollmentsCsv = <<<CSV
${enrollmentsCsv.join("\n")}
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
    
    $lines = explode("\\n", trim($studentsCsv));
    $stmt = $pdo->prepare("INSERT INTO students (student_id, name, guardian_name, phone) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), guardian_name=VALUES(guardian_name), phone=VALUES(phone)");
    for ($i = 1; $i < count($lines); $i++) {
        $cols = str_getcsv($lines[$i]);
        if (count($cols) >= 4) {
            $stmt->execute([trim($cols[0]), trim($cols[1]), trim($cols[2]), trim($cols[3])]);
        }
    }
    
    $elines = explode("\\n", trim($enrollmentsCsv));
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
`;

fs.writeFileSync("php_backend/import_students_enrollments.php", phpCode);
