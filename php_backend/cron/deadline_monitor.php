<?php
/**
 * LBSTI Task Deadline Monitoring Cron Job
 *
 * This script monitors active task deadlines, checks for approaching (<= 2 hours)
 * and overdue tasks, and triggers:
 * 1. In-App Alerts
 * 2. Automated Emails
 * 3. WhatsApp Business API Webhooks
 *
 * Can be run via CLI / Cron:
 * php /path/to/php_backend/cron/deadline_monitor.php
 */

chdir(__DIR__ . '/..');
require_once 'config.php';
require_once 'controllers/TaskController.php';

echo "[" . date("Y-m-d H:i:s") . "] LBSTI Task Deadline Monitor starting...\n";

try {
    $alerts = checkTaskDeadlinesInternal($pdo);
    $count = count($alerts);
    echo "[" . date("Y-m-d H:i:s") . "] Completed deadline check. Triggered {$count} alert(s).\n";
    foreach ($alerts as $a) {
        echo " - [{$a['type']}] Task #{$a['taskId']}: '{$a['taskTitle']}' -> Recipient: {$a['recipient']} ({$a['phone']} / {$a['email']})\n";
    }
} catch (Exception $e) {
    echo "[" . date("Y-m-d H:i:s") . "] ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
echo "[" . date("Y-m-d H:i:s") . "] Finished successfully.\n";

