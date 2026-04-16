import {
  createId,
  getNow,
  hashPassword,
  readDb,
  sanitizeUser,
  writeDb,
} from "../_lib/db.js";
import { requireMethod, sendJson } from "../_lib/helpers.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) {
    return;
  }

  const { name = "", email = "", password = "" } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();

  if (!String(name).trim() || !normalizedEmail || String(password).length < 6) {
    sendJson(res, 400, {
      message: "Name, email, and a password with at least 6 characters are required",
    });
    return;
  }

  const db = await readDb();
  const existing = db.users.find((user) => user.email === normalizedEmail);
  if (existing) {
    sendJson(res, 409, { message: "Email is already registered" });
    return;
  }

  const now = getNow();
  const user = {
    id: createId(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(String(password)),
    role: "employee",
    createdAt: now,
  };
  const token = createId();

  db.users.push(user);
  db.sessions.push({
    token,
    userId: user.id,
    createdAt: now,
  });

  await writeDb(db);
  sendJson(res, 201, { user: sanitizeUser(user), token });
}
