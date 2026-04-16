import { getNow, writeDb } from "../../_lib/db.js";
import {
  formatTask,
  getSession,
  requireAdmin,
  sendJson,
} from "../../_lib/helpers.js";

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

  if (!requireAdmin(res, session.user)) {
    return;
  }

  const task = session.db.tasks.find((item) => item.id === req.query.id);
  if (!task) {
    sendJson(res, 404, { message: "Task not found" });
    return;
  }

  const { decision = "", adminFeedback = "" } = req.body || {};

  if (!["verified", "rejected"].includes(String(decision))) {
    sendJson(res, 400, {
      message: "Decision must be verified or rejected",
    });
    return;
  }

  if (task.status !== "submitted") {
    sendJson(res, 400, { message: "Only submitted tasks can be reviewed" });
    return;
  }

  if (String(decision) === "rejected" && !String(adminFeedback).trim()) {
    sendJson(res, 400, {
      message: "Add feedback when rejecting a task",
    });
    return;
  }

  task.status = String(decision);
  task.adminFeedback = String(adminFeedback).trim();
  task.reviewedAt = getNow();
  task.reviewedById = session.user.id;
  task.reviewedByName = session.user.name;
  task.updatedAt = getNow();

  await writeDb(session.db);
  sendJson(res, 200, { todo: formatTask(task) });
}
