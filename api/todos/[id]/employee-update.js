import { getNow, writeDb } from "../../_lib/db.js";
import { formatTask, getSession, sendJson } from "../../_lib/helpers.js";

export default async function handler(req, res) {
  const session = await getSession(req);
  if (!session) {
    sendJson(res, 401, { message: "Unauthorized" });
    return;
  }

  if (req.method !== "PUT") {
    sendJson(res, 405, { message: "Method not allowed" });
    return;
  }

  const task = session.db.tasks.find((item) => item.id === req.query.id);
  if (!task) {
    sendJson(res, 404, { message: "Task not found" });
    return;
  }

  if (session.user.role !== "employee" || task.assigneeId !== session.user.id) {
    sendJson(res, 403, {
      message: "Only the assigned employee can update this task",
    });
    return;
  }

  const { status = "", completionNote = "" } = req.body || {};

  if (!["in-progress", "submitted"].includes(String(status))) {
    sendJson(res, 400, {
      message: "Employees can only move tasks to in-progress or submitted",
    });
    return;
  }

  if (String(status) === "submitted" && !String(completionNote).trim()) {
    sendJson(res, 400, {
      message: "Add a completion note before submitting to admin",
    });
    return;
  }

  task.status = String(status);
  task.completionNote = String(completionNote).trim();
  if (task.status === "submitted") {
    task.adminFeedback = "";
    task.reviewedAt = null;
    task.reviewedById = null;
    task.reviewedByName = null;
  }
  task.updatedAt = getNow();

  await writeDb(session.db);
  sendJson(res, 200, { todo: formatTask(task) });
}
