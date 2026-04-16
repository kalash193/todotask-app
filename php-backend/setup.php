<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

loadEnv(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

$host = envValue('DB_HOST', '127.0.0.1');
$port = envValue('DB_PORT', '3306');
$database = envValue('DB_NAME', 'taskflow_app');
$username = envValue('DB_USER', 'root');
$password = envValue('DB_PASS', '');

$adminHash = '$2y$10$dk9L6xsYMfrQFMuaAH3z6eTtt2F4fdNe44K4gRgS7eTK2WgfWI9uK';
$employeeHash = password_hash('employee123', PASSWORD_DEFAULT);

try {
    $rootDsn = sprintf('mysql:host=%s;port=%s;charset=utf8mb4', $host, $port);
    $pdo = new PDO($rootDsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    $pdo->exec(sprintf(
        'CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
        str_replace('`', '``', $database)
    ));

    $pdo->exec(sprintf('USE `%s`', str_replace('`', '``', $database)));

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(32) PRIMARY KEY,
            name VARCHAR(120) NOT NULL,
            email VARCHAR(190) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
            created_at DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec("UPDATE users SET role = 'employee' WHERE role = 'user'");
    $pdo->exec(
        "ALTER TABLE users
            MODIFY COLUMN role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee'"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS sessions (
            token VARCHAR(48) PRIMARY KEY,
            user_id VARCHAR(32) NOT NULL,
            created_at DATETIME NOT NULL,
            CONSTRAINT fk_sessions_user
                FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS todos (
            id VARCHAR(32) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            priority ENUM('Low', 'Medium', 'High', 'Urgent') NOT NULL DEFAULT 'Medium',
            deadline DATE NULL,
            status ENUM('pending', 'in-progress', 'submitted', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
            assignee_id VARCHAR(32) NOT NULL,
            assignee_name VARCHAR(120) NOT NULL,
            assignee_email VARCHAR(190) NOT NULL,
            created_by_id VARCHAR(32) NOT NULL,
            created_by_name VARCHAR(120) NOT NULL,
            completion_note TEXT NULL,
            admin_feedback TEXT NULL,
            reviewed_at DATETIME NULL,
            reviewed_by_id VARCHAR(32) NULL,
            reviewed_by_name VARCHAR(120) NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            INDEX idx_todos_assignee_id (assignee_id),
            INDEX idx_todos_updated_at (updated_at),
            CONSTRAINT fk_todos_assignee
                FOREIGN KEY (assignee_id) REFERENCES users(id)
                ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    $columns = [
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS assignee_id VARCHAR(32) NULL AFTER status",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS assignee_name VARCHAR(120) NULL AFTER assignee_id",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS assignee_email VARCHAR(190) NULL AFTER assignee_name",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS created_by_id VARCHAR(32) NULL AFTER assignee_email",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(120) NULL AFTER created_by_id",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS completion_note TEXT NULL AFTER created_by_name",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS admin_feedback TEXT NULL AFTER completion_note",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL AFTER admin_feedback",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS reviewed_by_id VARCHAR(32) NULL AFTER reviewed_at",
        "ALTER TABLE todos ADD COLUMN IF NOT EXISTS reviewed_by_name VARCHAR(120) NULL AFTER reviewed_by_id"
    ];

    foreach ($columns as $sql) {
        $pdo->exec($sql);
    }

    $pdo->exec("UPDATE todos SET status = 'submitted' WHERE status = 'completed'");
    $pdo->exec(
        "ALTER TABLE todos
            MODIFY COLUMN status ENUM('pending', 'in-progress', 'submitted', 'verified', 'rejected') NOT NULL DEFAULT 'pending'"
    );

    $pdo->exec(
        "UPDATE todos
         SET assignee_id = COALESCE(assignee_id, owner_id),
             assignee_name = COALESCE(assignee_name, owner_name),
             assignee_email = COALESCE(assignee_email, owner_email),
             created_by_id = COALESCE(created_by_id, 'admin-user'),
             created_by_name = COALESCE(created_by_name, 'TaskFlow Admin'),
             completion_note = COALESCE(completion_note, ''),
             admin_feedback = COALESCE(admin_feedback, '')"
    );

    try {
        $pdo->exec("ALTER TABLE todos DROP FOREIGN KEY fk_todos_user");
    } catch (PDOException) {
    }

    try {
        $pdo->exec("ALTER TABLE todos DROP INDEX idx_todos_owner_id");
    } catch (PDOException) {
    }

    $pdo->exec("ALTER TABLE todos DROP COLUMN IF EXISTS owner_id");
    $pdo->exec("ALTER TABLE todos DROP COLUMN IF EXISTS owner_name");
    $pdo->exec("ALTER TABLE todos DROP COLUMN IF EXISTS owner_email");

    $pdo->exec("ALTER TABLE todos MODIFY COLUMN assignee_id VARCHAR(32) NOT NULL");
    $pdo->exec("ALTER TABLE todos MODIFY COLUMN assignee_name VARCHAR(120) NOT NULL");
    $pdo->exec("ALTER TABLE todos MODIFY COLUMN assignee_email VARCHAR(190) NOT NULL");
    $pdo->exec("ALTER TABLE todos MODIFY COLUMN created_by_id VARCHAR(32) NOT NULL");
    $pdo->exec("ALTER TABLE todos MODIFY COLUMN created_by_name VARCHAR(120) NOT NULL");

    $indexes = [
        "ALTER TABLE todos ADD INDEX IF NOT EXISTS idx_todos_assignee_id (assignee_id)",
        "ALTER TABLE todos ADD INDEX IF NOT EXISTS idx_todos_updated_at (updated_at)",
        "ALTER TABLE todos ADD CONSTRAINT fk_todos_assignee FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE CASCADE"
    ];

    foreach ($indexes as $sql) {
        try {
            $pdo->exec($sql);
        } catch (PDOException) {
        }
    }

    $seed = $pdo->prepare(
        "INSERT INTO users (id, name, email, password_hash, role, created_at)
         VALUES (:id, :name, :email, :password_hash, :role, :created_at)
         ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            password_hash = VALUES(password_hash),
            role = VALUES(role)"
    );
    $seed->execute([
        'id' => 'admin-user',
        'name' => 'TaskFlow Admin',
        'email' => 'admin@taskflow.local',
        'password_hash' => $adminHash,
        'role' => 'admin',
        'created_at' => '2026-04-16 00:00:00',
    ]);
    $seed->execute([
        'id' => 'employee-demo',
        'name' => 'Demo Employee',
        'email' => 'employee@taskflow.local',
        'password_hash' => $employeeHash,
        'role' => 'employee',
        'created_at' => '2026-04-16 00:00:00',
    ]);

    echo "TaskFlow workflow setup completed successfully." . PHP_EOL;
    echo "Database: {$database}" . PHP_EOL;
    echo "Admin login: admin@taskflow.local / admin123" . PHP_EOL;
    echo "Employee login: employee@taskflow.local / employee123" . PHP_EOL;
} catch (PDOException $exception) {
    fwrite(STDERR, 'Setup failed: ' . $exception->getMessage() . PHP_EOL);
    exit(1);
}
