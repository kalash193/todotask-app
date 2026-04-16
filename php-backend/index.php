<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function formatTask(array $task): array
{
    return [
        'id' => $task['id'],
        'title' => $task['title'],
        'description' => $task['description'],
        'priority' => $task['priority'],
        'deadline' => $task['deadline'] ?? '',
        'status' => $task['status'],
        'assigneeId' => $task['assignee_id'],
        'assigneeName' => $task['assignee_name'],
        'assigneeEmail' => $task['assignee_email'],
        'createdById' => $task['created_by_id'],
        'createdByName' => $task['created_by_name'],
        'completionNote' => $task['completion_note'] ?? '',
        'adminFeedback' => $task['admin_feedback'] ?? '',
        'reviewedAt' => $task['reviewed_at'],
        'reviewedById' => $task['reviewed_by_id'],
        'reviewedByName' => $task['reviewed_by_name'],
        'createdAt' => $task['created_at'],
        'updatedAt' => $task['updated_at'],
    ];
}

function requireAdmin(array $user): void
{
    if (($user['role'] ?? '') !== 'admin') {
        jsonResponse(403, ['message' => 'Admin access required']);
    }
}

function fetchTask(PDO $pdo, string $taskId): ?array
{
    $statement = $pdo->prepare(
        'SELECT id, title, description, priority, deadline, status,
                assignee_id, assignee_name, assignee_email,
                created_by_id, created_by_name,
                completion_note, admin_feedback,
                reviewed_at, reviewed_by_id, reviewed_by_name,
                created_at, updated_at
         FROM todos
         WHERE id = :id
         LIMIT 1'
    );
    $statement->execute(['id' => $taskId]);
    $task = $statement->fetch();

    return $task ?: null;
}

$pdo = db();
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST' && $path === '/api/auth/register') {
    $body = requestBody();
    $name = trim((string) ($body['name'] ?? ''));
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');

    if ($name === '' || $email === '' || strlen($password) < 6) {
        jsonResponse(400, ['message' => 'Name, email, and a password with at least 6 characters are required']);
    }

    $check = $pdo->prepare('SELECT id FROM users WHERE email = :email LIMIT 1');
    $check->execute(['email' => $email]);

    if ($check->fetch()) {
        jsonResponse(409, ['message' => 'Email is already registered']);
    }

    $userId = bin2hex(random_bytes(16));
    $token = bin2hex(random_bytes(24));
    $now = gmdate('Y-m-d H:i:s');

    $insertUser = $pdo->prepare(
        'INSERT INTO users (id, name, email, password_hash, role, created_at)
         VALUES (:id, :name, :email, :password_hash, :role, :created_at)'
    );
    $insertUser->execute([
        'id' => $userId,
        'name' => $name,
        'email' => $email,
        'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        'role' => 'employee',
        'created_at' => $now,
    ]);

    $insertSession = $pdo->prepare(
        'INSERT INTO sessions (token, user_id, created_at)
         VALUES (:token, :user_id, :created_at)'
    );
    $insertSession->execute([
        'token' => $token,
        'user_id' => $userId,
        'created_at' => $now,
    ]);

    jsonResponse(201, [
        'user' => [
            'id' => $userId,
            'name' => $name,
            'email' => $email,
            'role' => 'employee',
            'createdAt' => $now,
        ],
        'token' => $token,
    ]);
}

if ($method === 'POST' && $path === '/api/auth/login') {
    $body = requestBody();
    $email = strtolower(trim((string) ($body['email'] ?? '')));
    $password = (string) ($body['password'] ?? '');

    $statement = $pdo->prepare(
        'SELECT id, name, email, password_hash, role, created_at
         FROM users
         WHERE email = :email
         LIMIT 1'
    );
    $statement->execute(['email' => $email]);
    $user = $statement->fetch();

    if (!$user || !password_verify($password, (string) $user['password_hash'])) {
        jsonResponse(401, ['message' => 'Invalid email or password']);
    }

    $token = bin2hex(random_bytes(24));
    $sessionInsert = $pdo->prepare(
        'INSERT INTO sessions (token, user_id, created_at)
         VALUES (:token, :user_id, :created_at)'
    );
    $sessionInsert->execute([
        'token' => $token,
        'user_id' => $user['id'],
        'created_at' => gmdate('Y-m-d H:i:s'),
    ]);

    jsonResponse(200, [
        'user' => publicUser($user),
        'token' => $token,
    ]);
}

if ($method === 'GET' && $path === '/api/auth/me') {
    $session = currentSession($pdo);

    if ($session === null) {
        jsonResponse(401, ['message' => 'Unauthorized']);
    }

    jsonResponse(200, ['user' => publicUser($session['user'])]);
}

if ($method === 'GET' && $path === '/api/employees') {
    $session = currentSession($pdo);

    if ($session === null) {
        jsonResponse(401, ['message' => 'Unauthorized']);
    }

    requireAdmin($session['user']);

    $statement = $pdo->query(
        "SELECT id, name, email, role, created_at
         FROM users
         WHERE role = 'employee'
         ORDER BY name ASC"
    );

    $employees = array_map(static fn(array $user): array => publicUser($user), $statement->fetchAll());
    jsonResponse(200, ['employees' => $employees]);
}

if (str_starts_with($path, '/api/todos')) {
    $session = currentSession($pdo);

    if ($session === null) {
        jsonResponse(401, ['message' => 'Unauthorized']);
    }

    $user = $session['user'];

    if ($method === 'GET' && $path === '/api/todos') {
        if ($user['role'] === 'admin') {
            $statement = $pdo->query(
                'SELECT id, title, description, priority, deadline, status,
                        assignee_id, assignee_name, assignee_email,
                        created_by_id, created_by_name,
                        completion_note, admin_feedback,
                        reviewed_at, reviewed_by_id, reviewed_by_name,
                        created_at, updated_at
                 FROM todos
                 ORDER BY updated_at DESC'
            );
        } else {
            $statement = $pdo->prepare(
                'SELECT id, title, description, priority, deadline, status,
                        assignee_id, assignee_name, assignee_email,
                        created_by_id, created_by_name,
                        completion_note, admin_feedback,
                        reviewed_at, reviewed_by_id, reviewed_by_name,
                        created_at, updated_at
                 FROM todos
                 WHERE assignee_id = :assignee_id
                 ORDER BY updated_at DESC'
            );
            $statement->execute(['assignee_id' => $user['id']]);
        }

        $tasks = array_map(static fn(array $task): array => formatTask($task), $statement->fetchAll());
        jsonResponse(200, ['todos' => $tasks]);
    }

    if ($method === 'POST' && $path === '/api/todos') {
        requireAdmin($user);

        $body = requestBody();
        $title = trim((string) ($body['title'] ?? ''));
        $assigneeId = trim((string) ($body['assigneeId'] ?? ''));
        $priority = (string) ($body['priority'] ?? 'Medium');
        $deadline = trim((string) ($body['deadline'] ?? ''));

        if ($title === '' || $assigneeId === '') {
            jsonResponse(400, ['message' => 'Title and assignee are required']);
        }

        if (!in_array($priority, ['Low', 'Medium', 'High', 'Urgent'], true)) {
            jsonResponse(400, ['message' => 'Invalid priority']);
        }

        $employeeStatement = $pdo->prepare(
            "SELECT id, name, email
             FROM users
             WHERE id = :id AND role = 'employee'
             LIMIT 1"
        );
        $employeeStatement->execute(['id' => $assigneeId]);
        $employee = $employeeStatement->fetch();

        if (!$employee) {
            jsonResponse(404, ['message' => 'Employee not found']);
        }

        $now = gmdate('Y-m-d H:i:s');
        $taskId = bin2hex(random_bytes(16));
        $insert = $pdo->prepare(
            'INSERT INTO todos (
                id, title, description, priority, deadline, status,
                assignee_id, assignee_name, assignee_email,
                created_by_id, created_by_name,
                completion_note, admin_feedback,
                reviewed_at, reviewed_by_id, reviewed_by_name,
                created_at, updated_at
             ) VALUES (
                :id, :title, :description, :priority, :deadline, :status,
                :assignee_id, :assignee_name, :assignee_email,
                :created_by_id, :created_by_name,
                :completion_note, :admin_feedback,
                :reviewed_at, :reviewed_by_id, :reviewed_by_name,
                :created_at, :updated_at
             )'
        );

        $insert->execute([
            'id' => $taskId,
            'title' => $title,
            'description' => trim((string) ($body['description'] ?? '')),
            'priority' => $priority,
            'deadline' => $deadline !== '' ? $deadline : null,
            'status' => 'pending',
            'assignee_id' => $employee['id'],
            'assignee_name' => $employee['name'],
            'assignee_email' => $employee['email'],
            'created_by_id' => $user['id'],
            'created_by_name' => $user['name'],
            'completion_note' => '',
            'admin_feedback' => '',
            'reviewed_at' => null,
            'reviewed_by_id' => null,
            'reviewed_by_name' => null,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $task = fetchTask($pdo, $taskId);
        jsonResponse(201, ['todo' => formatTask($task)]);
    }

    $parts = explode('/', trim($path, '/'));
    $taskId = $parts[2] ?? '';
    $action = $parts[3] ?? '';
    $task = fetchTask($pdo, $taskId);

    if (!$task) {
        jsonResponse(404, ['message' => 'Task not found']);
    }

    if ($method === 'PUT' && $action === 'employee-update') {
        if ($user['role'] !== 'employee' || $task['assignee_id'] !== $user['id']) {
            jsonResponse(403, ['message' => 'Only the assigned employee can update this task']);
        }

        $body = requestBody();
        $status = (string) ($body['status'] ?? '');
        $completionNote = trim((string) ($body['completionNote'] ?? ''));

        if (!in_array($status, ['in-progress', 'submitted'], true)) {
            jsonResponse(400, ['message' => 'Employees can only move tasks to in-progress or submitted']);
        }

        if ($status === 'submitted' && $completionNote === '') {
            jsonResponse(400, ['message' => 'Add a completion note before submitting to admin']);
        }

        $update = $pdo->prepare(
            'UPDATE todos
             SET status = :status,
                 completion_note = :completion_note,
                 admin_feedback = CASE WHEN :status = "submitted" THEN "" ELSE admin_feedback END,
                 reviewed_at = CASE WHEN :status = "submitted" THEN NULL ELSE reviewed_at END,
                 reviewed_by_id = CASE WHEN :status = "submitted" THEN NULL ELSE reviewed_by_id END,
                 reviewed_by_name = CASE WHEN :status = "submitted" THEN NULL ELSE reviewed_by_name END,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $update->execute([
            'id' => $taskId,
            'status' => $status,
            'completion_note' => $completionNote,
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ]);

        $updatedTask = fetchTask($pdo, $taskId);
        jsonResponse(200, ['todo' => formatTask($updatedTask)]);
    }

    if ($method === 'PUT' && $action === 'review') {
        requireAdmin($user);

        $body = requestBody();
        $decision = (string) ($body['decision'] ?? '');
        $adminFeedback = trim((string) ($body['adminFeedback'] ?? ''));

        if (!in_array($decision, ['verified', 'rejected'], true)) {
            jsonResponse(400, ['message' => 'Decision must be verified or rejected']);
        }

        if ($task['status'] !== 'submitted') {
            jsonResponse(400, ['message' => 'Only submitted tasks can be reviewed']);
        }

        if ($decision === 'rejected' && $adminFeedback === '') {
            jsonResponse(400, ['message' => 'Add feedback when rejecting a task']);
        }

        $update = $pdo->prepare(
            'UPDATE todos
             SET status = :status,
                 admin_feedback = :admin_feedback,
                 reviewed_at = :reviewed_at,
                 reviewed_by_id = :reviewed_by_id,
                 reviewed_by_name = :reviewed_by_name,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $update->execute([
            'id' => $taskId,
            'status' => $decision,
            'admin_feedback' => $adminFeedback,
            'reviewed_at' => gmdate('Y-m-d H:i:s'),
            'reviewed_by_id' => $user['id'],
            'reviewed_by_name' => $user['name'],
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ]);

        $updatedTask = fetchTask($pdo, $taskId);
        jsonResponse(200, ['todo' => formatTask($updatedTask)]);
    }

    if ($method === 'PUT' && $action === '') {
        requireAdmin($user);

        $body = requestBody();
        $title = trim((string) ($body['title'] ?? ''));
        $assigneeId = trim((string) ($body['assigneeId'] ?? ''));
        $priority = (string) ($body['priority'] ?? 'Medium');
        $status = (string) ($body['status'] ?? $task['status']);
        $deadline = trim((string) ($body['deadline'] ?? ''));

        if ($title === '' || $assigneeId === '') {
            jsonResponse(400, ['message' => 'Title and assignee are required']);
        }

        if (!in_array($priority, ['Low', 'Medium', 'High', 'Urgent'], true)) {
            jsonResponse(400, ['message' => 'Invalid priority']);
        }

        if (!in_array($status, ['pending', 'in-progress', 'submitted', 'verified', 'rejected'], true)) {
            jsonResponse(400, ['message' => 'Invalid status']);
        }

        $employeeStatement = $pdo->prepare(
            "SELECT id, name, email
             FROM users
             WHERE id = :id AND role = 'employee'
             LIMIT 1"
        );
        $employeeStatement->execute(['id' => $assigneeId]);
        $employee = $employeeStatement->fetch();

        if (!$employee) {
            jsonResponse(404, ['message' => 'Employee not found']);
        }

        $update = $pdo->prepare(
            'UPDATE todos
             SET title = :title,
                 description = :description,
                 priority = :priority,
                 deadline = :deadline,
                 status = :status,
                 assignee_id = :assignee_id,
                 assignee_name = :assignee_name,
                 assignee_email = :assignee_email,
                 updated_at = :updated_at
             WHERE id = :id'
        );
        $update->execute([
            'id' => $taskId,
            'title' => $title,
            'description' => trim((string) ($body['description'] ?? '')),
            'priority' => $priority,
            'deadline' => $deadline !== '' ? $deadline : null,
            'status' => $status,
            'assignee_id' => $employee['id'],
            'assignee_name' => $employee['name'],
            'assignee_email' => $employee['email'],
            'updated_at' => gmdate('Y-m-d H:i:s'),
        ]);

        $updatedTask = fetchTask($pdo, $taskId);
        jsonResponse(200, ['todo' => formatTask($updatedTask)]);
    }

    if ($method === 'DELETE' && $action === '') {
        requireAdmin($user);

        $delete = $pdo->prepare('DELETE FROM todos WHERE id = :id');
        $delete->execute(['id' => $taskId]);
        jsonResponse(200, ['message' => 'Task deleted']);
    }
}

jsonResponse(404, ['message' => 'Route not found']);
