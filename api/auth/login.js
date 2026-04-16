import { createId, getNow, hashPassword, readDb, writeDb } from "../_lib/db.js";
import { requireMethod, sendJson, sessionUserPayload } from "../_lib/helpers.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "POST")) {
    return;
  }

  const { email = "", password = "" } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();

  const db = await readDb();
  const user = db.users.find((item) => item.email === normalizedEmail);

  if (!user || user.passwordHash !== hashPassword(String(password))) {
    sendJson(res, 401, { message: "Invalid email or password" });
    return;
  }

  const token = createId();
  db.sessions.push({
    token,
    userId: user.id,
    createdAt: getNow(),
  });

  await writeDb(db);
  sendJson(res, 200, {
    user: sessionUserPayload(user),
    token,
  });
}
