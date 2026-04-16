CREATE DATABASE IF NOT EXISTS taskflow_app
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE taskflow_app;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
  created_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(48) PRIMARY KEY,
  user_id VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS todos (
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
);
