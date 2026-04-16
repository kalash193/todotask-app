import { getNow, writeDb } from "../_lib/db.js";
import {
  formatTask,
  getSession,
  requireAdmin,
  sendJson,
  validateTaskInput,
} from "../_lib/helpers.js";

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  const task = session.db.tasks.find((item) => item.id === req.query.id);
  if (!task) {
    sendJson(res, 404, { message: "Task not found" });
    return;
  }

  if (req.method === "DELETE") {
    if (!requireAdmin(res, session.user)) {
      return;
    }

    session.db.tasks = session.db.tasks.filter((item) => item.id !== req.query.id);
    await writeDb(session.db);
    sendJson(res, 200, { message: "Task deleted" });
    return;
  }

  if (req.method !== "PUT") {
    sendJson(res, 405, { message: "Method not allowed" });
    return;
  }

  if (!requireAdmin(res, session.user)) {
    return;
  }

  const body = req.body || {};
  const error = validateTaskInput({
    title: String(body.title || ""),
    priority: String(body.priority || "Medium"),
  });

  if (error) {
    sendJson(res, 400, { message: error });
    return;
  }

  if (
    !["pending", "in-progress", "submitted", "verified", "rejected"].includes(
      String(body.status || task.status),
    )
  ) {
    sendJson(res, 400, { message: "Invalid status" });
    return;
  }

  const assignee = session.db.users.find(
    (user) => user.id === String(body.assigneeId || "") && user.role === "employee",
  );

  if (!assignee) {
    sendJson(res, 404, { message: "Employee not found" });
    return;
  }

  task.title = String(body.title).trim();
  task.description = String(body.description || "").trim();
  task.priority = String(body.priority || "Medium");
  task.deadline = String(body.deadline || "").trim();
  task.status = String(body.status || task.status);
  task.assigneeId = assignee.id;
  task.assigneeName = assignee.name;
  task.assigneeEmail = assignee.email;
  task.updatedAt = getNow();

  await writeDb(session.db);
  sendJson(res, 200, { todo: formatTask(task) });
}
