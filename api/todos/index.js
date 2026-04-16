import { createId, getNow, writeDb } from "../_lib/db.js";
import {
  formatTask,
  getSession,
  requireAdmin,
  sendJson,
  sortTasks,
  validateTaskInput,
} from "../_lib/helpers.js";

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  if (req.method === "GET") {
    const tasks =
      session.user.role === "admin"
        ? sortTasks(session.db.tasks)
        : sortTasks(
            session.db.tasks.filter(
              (task) => task.assigneeId === session.user.id,
            ),
          );

    sendJson(res, 200, { todos: tasks.map(formatTask) });
    return;
  }

  if (req.method !== "POST") {
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

  const assignee = session.db.users.find(
    (user) => user.id === String(body.assigneeId || "") && user.role === "employee",
  );

  if (!assignee) {
    sendJson(res, 404, { message: "Employee not found" });
    return;
  }

  const now = getNow();
  const task = {
    id: createId(),
    title: String(body.title).trim(),
    description: String(body.description || "").trim(),
    priority: String(body.priority || "Medium"),
    deadline: String(body.deadline || "").trim(),
    status: "pending",
    assigneeId: assignee.id,
    assigneeName: assignee.name,
    assigneeEmail: assignee.email,
    createdById: session.user.id,
    createdByName: session.user.name,
    completionNote: "",
    adminFeedback: "",
    reviewedAt: null,
    reviewedById: null,
    reviewedByName: null,
    createdAt: now,
    updatedAt: now,
  };

  session.db.tasks.unshift(task);
  await writeDb(session.db);
  sendJson(res, 201, { todo: formatTask(task) });
}
