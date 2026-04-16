import { readDb, sanitizeUser } from "./db.js";

export function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

export function getToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return "";
  }
  return header.slice(7);
}

export async function getSession(req) {
  const token = getToken(req);
  if (!token) {
    return null;
  }

  const db = await readDb();
  const session = db.sessions.find((item) => item.token === token);
  if (!session) {
    return null;
  }

  const user = db.users.find((item) => item.id === session.userId);
  if (!user) {
    return null;
  }

  return { db, token, user };
}

export function requireMethod(req, res, method) {
  if (req.method !== method) {
    sendJson(res, 405, { message: "Method not allowed" });
    return false;
  }

  return true;
}

export function requireAdmin(res, user) {
  if (user.role !== "admin") {
    sendJson(res, 403, { message: "Admin access required" });
    return false;
  }

  return true;
}

export function formatTask(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    priority: task.priority,
    deadline: task.deadline || "",
    status: task.status,
    assigneeId: task.assigneeId,
    assigneeName: task.assigneeName,
    assigneeEmail: task.assigneeEmail,
    createdById: task.createdById,
    createdByName: task.createdByName,
    completionNote: task.completionNote || "",
    adminFeedback: task.adminFeedback || "",
    reviewedAt: task.reviewedAt || null,
    reviewedById: task.reviewedById || null,
    reviewedByName: task.reviewedByName || null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

export function validateTaskInput(task) {
  if (!task.title?.trim()) {
    return "Title is required";
  }

  if (!["Low", "Medium", "High", "Urgent"].includes(task.priority)) {
    return "Invalid priority";
  }

  return null;
}

export function sortTasks(tasks) {
  return [...tasks].sort(
    (left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

export function sessionUserPayload(user) {
  return sanitizeUser(user);
}
