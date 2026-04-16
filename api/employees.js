import { getSession, requireAdmin, requireMethod, sendJson } from "./_lib/helpers.js";
import { sanitizeUser } from "./_lib/db.js";

export default async function handler(req, res) {
  if (!requireMethod(req, res, "GET")) {
    return;
  }

  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  if (!requireAdmin(res, session.user)) {
    return;
  }

  const employees = session.db.users
    .filter((user) => user.role === "employee")
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(sanitizeUser);

  sendJson(res, 200, { employees });
}
