<?php

declare(strict_types=1);

function jsonResponse(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function loadEnv(string $path): void
{
    if (!file_exists($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);

        if ($trimmed === '' || str_starts_with($trimmed, '#') || !str_contains($trimmed, '=')) {
            continue;
        }

        [$name, $value] = explode('=', $trimmed, 2);
        $name = trim($name);
        $value = trim($value);

        if ($value !== '' && (($value[0] === '"' && str_ends_with($value, '"')) || ($value[0] === "'" && str_ends_with($value, "'")))) {
            $value = substr($value, 1, -1);
        }

        if (getenv($name) === false) {
            putenv($name . '=' . $value);
            $_ENV[$name] = $value;
        }
    }
}

function envValue(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function bearerToken(): string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';

    if (!str_starts_with($header, 'Bearer ')) {
        return '';
    }

    return substr($header, 7);
}

function requestBody(): array
{
    $raw = file_get_contents('php://input');

    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        jsonResponse(400, ['message' => 'Invalid JSON body']);
    }

    return $decoded;
}

function publicUser(array $user): array
{
    return [
        'id' => $user['id'],
        'name' => $user['name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'createdAt' => $user['created_at'],
    ];
}

function validateTodo(array $input): ?string
{
    $title = trim((string) ($input['title'] ?? ''));
    $status = (string) ($input['status'] ?? 'pending');
    $priority = (string) ($input['priority'] ?? 'Medium');

    if ($title === '') {
        return 'Title is required';
    }

    if (!in_array($status, ['pending', 'in-progress', 'completed'], true)) {
        return 'Invalid status';
    }

    if (!in_array($priority, ['Low', 'Medium', 'High', 'Urgent'], true)) {
        return 'Invalid priority';
    }

    return null;
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    loadEnv(dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env');

    $host = envValue('DB_HOST', '127.0.0.1');
    $port = envValue('DB_PORT', '3306');
    $database = envValue('DB_NAME', 'taskflow_app');
    $username = envValue('DB_USER', 'root');
    $password = envValue('DB_PASS', '');

    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $database);

    try {
        $pdo = new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } catch (PDOException $exception) {
        jsonResponse(500, [
            'message' => 'Database connection failed. Check your MySQL settings in .env',
            'details' => $exception->getMessage(),
        ]);
    }

    return $pdo;
}

function currentSession(PDO $pdo): ?array
{
    $token = bearerToken();

    if ($token === '') {
        return null;
    }

    $statement = $pdo->prepare(
        'SELECT s.token, u.id, u.name, u.email, u.role, u.created_at
         FROM sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.token = :token
         LIMIT 1'
    );
    $statement->execute(['token' => $token]);
    $row = $statement->fetch();

    if (!$row) {
        return null;
    }

    return [
        'token' => $row['token'],
        'user' => [
            'id' => $row['id'],
            'name' => $row['name'],
            'email' => $row['email'],
            'role' => $row['role'],
            'created_at' => $row['created_at'],
        ],
    ];
}
