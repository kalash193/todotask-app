USE taskflow_app;

INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES (
  'admin-user',
  'TaskFlow Admin',
  'admin@taskflow.local',
  '$2y$10$dk9L6xsYMfrQFMuaAH3z6eTtt2F4fdNe44K4gRgS7eTK2WgfWI9uK',
  'admin',
  '2026-04-16 00:00:00'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  role = VALUES(role);

INSERT INTO users (id, name, email, password_hash, role, created_at)
VALUES (
  'employee-demo',
  'Demo Employee',
  'employee@taskflow.local',
  '$2y$10$/Prmg9.wjPYSQ7eMNwr/c.UAn2oNYjLIDZLeEVTg94m5q8gfD6pDa',
  'employee',
  '2026-04-16 00:00:00'
)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  password_hash = VALUES(password_hash),
  role = VALUES(role);
